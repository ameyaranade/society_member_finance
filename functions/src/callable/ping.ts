import { onCall } from 'firebase-functions/v2/https';

export const ping = onCall(async () => {
  return { message: 'pong', timestamp: Date.now() };
});
