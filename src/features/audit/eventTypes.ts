// Mirrors UltimatePos.Application/Notifications/SystemEventTypes.cs. Keep in step with it.
// Business users load the list from GET /audit-log/event-types; Super Users can't (it needs AuditLog.View), so the platform uses this.
export const SYSTEM_EVENT_TYPES = [
  'Batch.Expired', 'Batch.ExpiringSoon',
  'Business.Closed', 'Business.OwnerAdded', 'Business.ProfileUpdated', 'Business.Reactivated', 'Business.Registered', 'Business.Reopened', 'Business.Suspended',
  'Customer.PaymentRecorded', 'Expense.Voided',
  'License.Cancelled', 'License.Expired', 'License.ExpiringSoon', 'License.Issued',
  'Mpesa.StkPaymentFailed', 'Mpesa.TillPaymentUnmatched',
  'Platform.SuperUserActivated', 'Platform.SuperUserCreated', 'Platform.SuperUserDeactivated', 'Platform.SupportPasswordReset', 'Platform.SupportUserUnlocked',
  'PurchaseOrder.Cancelled', 'PurchaseOrder.Overdue', 'PurchaseOrder.Received',
  'Role.Created', 'Role.PermissionsChanged',
  'Sale.CreditLimitOverridden', 'Sale.Returned', 'Sale.Voided',
  'Stock.Adjusted', 'Stock.BelowReorderLevel', 'Stock.OutOfStock', 'Stock.Replenished', 'Stock.Revalued',
  'Supplier.PaymentRecorded',
  'User.AccountLocked', 'User.Activated', 'User.Created', 'User.Deactivated', 'User.Locked', 'User.LoggedIn', 'User.LoggedOut', 'User.LoginFailed',
  'User.PasswordChanged', 'User.PasswordReset', 'User.RolesChanged', 'User.SwitchedBusiness', 'User.Unlocked', 'User.Updated',
] as const;
