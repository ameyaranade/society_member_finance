import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'asia-south1' });

export { ping }             from './callable/ping';
export { refreshClaims }    from './callable/refreshClaims';
export { createSociety }    from './callable/createSociety';
export { inviteUser }       from './callable/inviteUser';
export { updateMembership } from './callable/updateMembership';
export { recordPayment }    from './callable/recordPayment';
export { recomputeBalances } from './trigger/recomputeBalances';
export { scheduledRecurring, generateRecurringInstances } from './scheduled/scheduledRecurring';
export { markInstancePaid }             from './callable/markInstancePaid';
export { createMaintenanceRequest }    from './callable/createMaintenanceRequest';
export { submitExpenseRequest }        from './callable/submitExpenseRequest';
export { scheduleSnag }                from './callable/scheduleSnag';
export { withdrawExpenseRequest }      from './callable/withdrawExpenseRequest';
export { recordApproval }              from './callable/recordApproval';
export { recordDisbursement }          from './callable/recordDisbursement';
export { closeExpenseRequest }         from './callable/closeExpenseRequest';
export { applyChargeModel }            from './callable/applyChargeModel';
export { importCollections }           from './callable/importCollections';
export { seedDashboardData }           from './callable/seedDashboardData';
