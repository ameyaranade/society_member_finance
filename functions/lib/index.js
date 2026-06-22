"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ping = void 0;
const app_1 = require("firebase-admin/app");
const ping_1 = require("./callable/ping");
Object.defineProperty(exports, "ping", { enumerable: true, get: function () { return ping_1.ping; } });
(0, app_1.initializeApp)();
