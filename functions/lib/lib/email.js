"use strict";
/**
 * Transactional email adapter.
 *
 * The interface is stable; swap out the provider by changing `activeAdapter`.
 *
 * testMode societies: the stub adapter logs the payload but does not send.
 * Real societies: wire a real provider (e.g. Firebase "Trigger Email" extension,
 * SendGrid, Resend, etc.) behind EmailAdapter.
 *
 * TODO: replace logEmailAdapter with a real implementation and set it as activeAdapter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEmailAdapter = void 0;
exports.resolveEmailAdapter = resolveEmailAdapter;
exports.sendEmailSafe = sendEmailSafe;
/** Logs the email payload without sending anything. Used for testMode societies and local dev. */
exports.logEmailAdapter = {
    async send(msg) {
        console.log('[email:stub] would send:', JSON.stringify({
            to: msg.to,
            subject: msg.subject,
            text: msg.text?.slice(0, 120),
        }));
    },
};
/**
 * Resolve the adapter to use for a given society.
 * Test-mode societies always get the stub so they never send real email.
 *
 * @param testMode - pass `societySnap.data()?.config?.testMode === true`
 */
function resolveEmailAdapter(testMode) {
    if (testMode)
        return exports.logEmailAdapter;
    // TODO: return realEmailAdapter once a provider is configured.
    // e.g. return sendgridAdapter;
    return exports.logEmailAdapter; // temporary: stub until provider is wired
}
/**
 * Fire-and-forget email send. Email failures must never block the main operation.
 * Callers should use this wrapper rather than calling adapter.send() directly.
 */
function sendEmailSafe(adapter, msg) {
    void adapter.send(msg).catch(e => console.error('[email] send error:', e));
}
