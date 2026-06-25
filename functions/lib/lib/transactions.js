"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTransaction = buildTransaction;
const firestore_1 = require("firebase-admin/firestore");
function buildTransaction(p) {
    const doc = {
        id: p.txnId,
        societyId: p.societyId,
        direction: p.direction,
        amountPaise: p.amountPaise,
        accountId: p.accountId,
        fundHead: p.fundHead,
        mode: p.mode,
        description: p.description,
        occurredAt: p.occurredAt,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        createdBy: p.createdBy,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (p.referenceNo?.trim())
        doc.referenceNo = p.referenceNo.trim();
    if (p.notes?.trim())
        doc.notes = p.notes.trim();
    return doc;
}
