"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_PAYMENT_MODES = void 0;
exports.requirePositivePaise = requirePositivePaise;
exports.requireDateString = requireDateString;
exports.requirePaymentMode = requirePaymentMode;
const https_1 = require("firebase-functions/v2/https");
exports.VALID_PAYMENT_MODES = new Set(['cash', 'upi', 'cheque', 'bank']);
function requirePositivePaise(value, field) {
    if (!Number.isInteger(value) || value <= 0)
        throw new https_1.HttpsError('invalid-argument', `${field} must be a positive integer.`);
}
function requireDateString(value, field) {
    if (!value?.match(/^\d{4}-\d{2}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', `${field} must be "YYYY-MM-DD".`);
}
function requirePaymentMode(value, field) {
    if (!exports.VALID_PAYMENT_MODES.has(value))
        throw new https_1.HttpsError('invalid-argument', `${field} must be cash, upi, cheque, or bank.`);
}
