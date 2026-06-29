"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockBatch, mockMemberDocs, mockDb } = vitest_1.vi.hoisted(() => {
    const mockBatch = {
        set: vitest_1.vi.fn().mockReturnThis(),
        commit: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    const mockMemberDocs = [];
    const memberChain = {
        where: vitest_1.vi.fn().mockReturnThis(),
        get: vitest_1.vi.fn(async () => ({ docs: mockMemberDocs })),
    };
    let notifDocCounter = 0;
    const notifChain = {
        doc: vitest_1.vi.fn(() => ({ id: `notif_${notifDocCounter++}` })),
    };
    // doc() is called for: society doc (testMode check) + user profile docs (email lookup)
    const mockDoc = vitest_1.vi.fn(() => ({
        get: vitest_1.vi.fn().mockResolvedValue({
            data: () => ({ config: { testMode: true }, email: 'member@test.com' }),
        }),
    }));
    const mockDb = {
        collection: vitest_1.vi.fn((path) => (path === 'memberships' ? memberChain : notifChain)),
        batch: vitest_1.vi.fn(() => mockBatch),
        doc: mockDoc,
    };
    return { mockBatch, mockMemberDocs, memberChain, mockDb };
});
vitest_1.vi.mock('./admin', () => ({ db: mockDb }));
vitest_1.vi.mock('./email', () => ({
    resolveEmailAdapter: vitest_1.vi.fn(() => ({ send: vitest_1.vi.fn().mockResolvedValue(undefined) })),
    sendEmailSafe: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('firebase-admin/app', () => ({ initializeApp: vitest_1.vi.fn() }));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));
const notify_1 = require("./notify");
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    mockMemberDocs.length = 0;
    mockBatch.set.mockReturnThis();
    mockBatch.commit.mockResolvedValue(undefined);
});
(0, vitest_1.describe)('dispatchNotification', () => {
    (0, vitest_1.it)('fans out to all active members with the specified role', async () => {
        mockMemberDocs.push({ data: () => ({ uid: 'mc1' }) });
        mockMemberDocs.push({ data: () => ({ uid: 'mc2' }) });
        await (0, notify_1.dispatchNotification)({
            societyId: 'soc1',
            type: 'expense_request_submitted',
            payload: { requestId: 'req1' },
            toRole: 'mc',
        });
        (0, vitest_1.expect)(mockBatch.set).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(mockBatch.commit).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('sends directly to specific UIDs when toUids is provided', async () => {
        await (0, notify_1.dispatchNotification)({
            societyId: 'soc1',
            type: 'expense_request_approved',
            payload: { requestId: 'req1' },
            toUids: ['fm1'],
        });
        (0, vitest_1.expect)(mockBatch.set).toHaveBeenCalledTimes(1);
        // notification doc contains the right shape
        const [, notifData] = mockBatch.set.mock.calls[0];
        (0, vitest_1.expect)(notifData).toMatchObject({
            societyId: 'soc1',
            toUid: 'fm1',
            type: 'expense_request_approved',
            readAt: null,
        });
    });
    (0, vitest_1.it)('writes to the correct society-scoped collection path', async () => {
        await (0, notify_1.dispatchNotification)({
            societyId: 'soc1',
            type: 'expense_request_completed',
            payload: {},
            toUids: ['uid1'],
        });
        (0, vitest_1.expect)(mockDb.collection).toHaveBeenCalledWith('societies/soc1/notifications');
    });
    (0, vitest_1.it)('returns without writing when there are no recipients', async () => {
        // No members returned, no toUids
        await (0, notify_1.dispatchNotification)({
            societyId: 'soc1',
            type: 'expense_request_submitted',
            payload: {},
            toRole: 'mc',
        });
        (0, vitest_1.expect)(mockBatch.commit).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('skips members with no uid field', async () => {
        mockMemberDocs.push({ data: () => ({}) }); // no uid
        mockMemberDocs.push({ data: () => ({ uid: 'mc1' }) });
        await (0, notify_1.dispatchNotification)({
            societyId: 'soc1',
            type: 'expense_request_submitted',
            payload: {},
            toRole: 'mc',
        });
        (0, vitest_1.expect)(mockBatch.set).toHaveBeenCalledTimes(1);
    });
});
