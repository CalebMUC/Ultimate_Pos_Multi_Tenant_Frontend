// Generated from UltimatePos.Application/Identity/PermissionCatalog.cs. Keep in step with it.
// Platform permissions are held only by Super Users, who belong to no business.
export const PLATFORM_PERMISSIONS = [
  'Businesses.Register', 'Businesses.ViewAll', 'Businesses.Deactivate', 'Businesses.Suspend',
  'Licenses.View', 'Licenses.Manage', 'Platform.Dashboard.View', 'Platform.Support', 'Platform.Users.Manage',
] as const;

export const BUSINESS_PERMISSIONS = [
  'Users.Create', 'Users.View', 'Users.Update', 'Users.AssignRoles', 'Users.Deactivate', 'Users.Lock', 'Users.ResetPassword',
  'Roles.View', 'Roles.Create', 'Roles.Update', 'Roles.Deactivate', 'Roles.AssignPermissions', 'Permissions.View',
  'Businesses.View', 'Businesses.Update',
  'Customers.Register', 'Customers.View', 'Customers.Update', 'Customers.Deactivate', 'Customers.ViewLedger', 'Customers.RecordPayment',
  'Categories.View', 'Categories.Create', 'Categories.Update', 'Categories.Deactivate', 'Categories.BulkImport',
  'Units.View', 'Units.Create', 'Units.Update', 'Units.Deactivate',
  'Products.View', 'Products.Create', 'Products.Update', 'Products.Deactivate', 'Products.ManagePricing', 'Products.BulkImport',
  'Products.ManageUnitConversions',
  'Suppliers.Register', 'Suppliers.View', 'Suppliers.Update', 'Suppliers.Deactivate', 'Suppliers.ViewLedger', 'Suppliers.RecordPayment',
  'PurchaseOrders.Create', 'PurchaseOrders.View', 'PurchaseOrders.Receive', 'PurchaseOrders.Cancel',
  'Stock.View', 'Stock.Adjust',
  'Formulas.Create', 'Formulas.View', 'Formulas.Deactivate', 'Production.Run', 'Production.View',
  'Sales.Create', 'Sales.View', 'Sales.Void', 'Sales.Return', 'Sales.ApplyDiscount', 'Sales.OverrideCreditLimit',
  'Prescriptions.Dispense', 'Prescriptions.View',
  'Mpesa.Configure', 'Mpesa.View',
  'Costing.View', 'Costing.Revalue',
  'ExpenseCategories.Create', 'ExpenseCategories.View', 'ExpenseCategories.Update', 'ExpenseCategories.Deactivate',
  'Expenses.Create', 'Expenses.View', 'Expenses.Update', 'Expenses.Void',
  'Dashboard.View', 'SalesReports.View', 'CustomerReports.View', 'ProductionReports.View', 'InventoryReports.View', 'PurchaseReports.View',
  'AuditLog.View',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type BusinessPermission = (typeof BUSINESS_PERMISSIONS)[number];
export type Permission = PlatformPermission | BusinessPermission;

/** One permission, or a list meaning "any of these". */
export type PermissionRequirement = Permission | readonly Permission[];
