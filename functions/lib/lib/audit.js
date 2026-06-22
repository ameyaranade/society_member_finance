"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAudit = writeAudit;
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("./admin");
/** Append an immutable audit entry. Clients cannot write auditLogs (rules: write: if false). */
async function writeAudit(params) {
    await admin_1.db.collection(`societies/${params.societyId}/auditLogs`).add({
        ...params,
        at: firestore_1.FieldValue.serverTimestamp(),
        societyId: params.societyId,
    });
}
