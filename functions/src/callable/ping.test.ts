import { describe, it, expect, vi, beforeEach } from 'vitest';

type PingResult = { message: string; timestamp: number };
type PingHandler = (req: unknown) => Promise<PingResult>;

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((optsOrHandler: unknown, maybeHandler?: PingHandler) => (maybeHandler ?? optsOrHandler) as PingHandler),
}));

vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));

describe('ping handler', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns pong with a timestamp', async () => {
    const { ping } = await import('./ping');
    const result = await (ping as unknown as PingHandler)({});
    expect(result).toMatchObject({ message: 'pong' });
    expect(typeof result.timestamp).toBe('number');
  });
});
