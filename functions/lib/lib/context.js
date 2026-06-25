"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCaller = requireCaller;
exports.assertSameSociety = assertSameSociety;
const https_1 = require("firebase-functions/v2/https");
/**
 * Extracts and validates caller identity from a Cloud Functions request.
 * Throws unauthenticated/failed-precondition if uid or societyId is absent.
 */
function requireCaller(request) {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role ?? '';
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    return { uid, societyId, role };
}
/** Throws permission-denied if a document's societyId doesn't match the caller's. */
function assertSameSociety(docSocietyId, callerSocietyId) {
    if (docSocietyId !== callerSocietyId)
        throw new https_1.HttpsError('permission-denied', 'Cross-society access denied.');
}
