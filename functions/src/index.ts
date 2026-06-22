import { initializeApp } from 'firebase-admin/app';
import { ping } from './callable/ping';

initializeApp();

export { ping };
