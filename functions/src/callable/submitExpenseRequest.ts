import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { assertSameSociety, requireCaller } from '../lib/context';
import { requirePositivePaise } from '../lib/validate';
import { writeAudit } from '../lib/audit';
import { dispatchNotificationSafe } from '../lib/notify';
import { resolveRequiredApprovers } from '../lib/tierHelpers';
import type { Quotation } from '../lib/types';

interface QuotationInput {
  vendorId: string;
  amountPaise: number;
  scopeNotes: string;
  documentRefs?: string[];
}

interface SubmitExpenseRequestInput {
  requestId: string;
  quotations: QuotationInput[]; // required for snag take-up
}

export const submitExpenseRequest = onCall(async (request): Promise<{ ok: true }> => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'fm')
      throw new HttpsError('permission-denied', 'Only FM can take up a request.');

    const input = request.data as SubmitExpenseRequestInput;

    if (!input.requestId?.trim())
      throw new HttpsError('invalid-argument', 'requestId is required.');
    if (!Array.isArray(input.quotations) || input.quotations.length === 0)
      throw new HttpsError('invalid-argument', 'At least one quotation is required.');
    for (const q of input.quotations) {
      if (!q.vendorId?.trim())
        throw new HttpsError('invalid-argument', 'Each quotation must have a vendorId.');
      requirePositivePaise(q.amountPaise, 'amountPaise');
      if (!q.scopeNotes?.trim())
        throw new HttpsError('invalid-argument', 'Each quotation must have scopeNotes.');
    }

    // ── Fetch and validate the expense request ───────────────────────────────
    const requestRef = db.doc(`societies/${societyId}/expenseRequests/${input.requestId}`);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists)
      throw new HttpsError('not-found', 'Expense request not found.');

    const data = requestSnap.data()!;

    assertSameSociety(data.societyId as string, societyId);
    if (data.type !== 'snag')
      throw new HttpsError('invalid-argument', 'submitExpenseRequest is for snag take-up only.');
    if (data.status !== 'scheduled')
      throw new HttpsError('failed-precondition', `Cannot take up a snag in status "${data.status}".`);

    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const requiredApprovers = await resolveRequiredApprovers(societyId, data.estCostPaise as number);

    // ── Write atomically ─────────────────────────────────────────────────────
    const batch = db.batch();

    batch.update(requestRef, {
      status: 'requested',
      requiredApprovers,
      submittedAt: FieldValue.serverTimestamp(),
    });

    for (const q of input.quotations) {
      const quoteRef = requestRef.collection('quotations').doc();
      const quoteData: Omit<Quotation, 'id'> = {
        societyId,
        requestId: input.requestId,
        vendorId: q.vendorId.trim(),
        amountPaise: q.amountPaise,
        scopeNotes: q.scopeNotes.trim(),
        ...(Array.isArray(q.documentRefs) && q.documentRefs.length > 0
          ? { documentRefs: q.documentRefs.map((r: string) => r.trim()).filter(Boolean) }
          : {}),
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.set(quoteRef, quoteData);
    }

    await batch.commit();

    await writeAudit({
      societyId,
      actorUid: uid,
      actorRole: role,
      action: 'expense_request_submitted',
      targetType: 'expenseRequest',
      targetId: input.requestId,
      after: { status: 'requested', requiredApprovers },
    });

    dispatchNotificationSafe({
      societyId,
      type: 'expense_request_submitted',
      toRole: 'mc',
      payload: { requestId: input.requestId, title: data.title as string, requestType: 'snag' },
    });

    return { ok: true };
  },
);
