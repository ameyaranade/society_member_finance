"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = exports.db = void 0;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const _db = (0, firestore_1.getFirestore)();
_db.settings({ ignoreUndefinedProperties: true });
exports.db = _db;
exports.adminAuth = (0, auth_1.getAuth)();
