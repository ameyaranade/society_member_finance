"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ping = void 0;
const https_1 = require("firebase-functions/v2/https");
exports.ping = (0, https_1.onCall)({ region: 'asia-south1' }, async () => {
    return { message: 'pong', timestamp: Date.now() };
});
