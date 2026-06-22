import { onCall } from 'firebase-functions/v2/https';

export const ping = onCall({ region: 'asia-south1' }, async () => {
  return { message: 'pong', timestamp: Date.now() };
});
