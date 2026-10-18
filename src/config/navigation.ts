import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck, BarChart3, Bell, Boxes, Building2, ClipboardList, Factory, LayoutDashboard, Pill, Receipt, ScrollText, Settings, ShieldCheck, ShoppingCart, Tags, Truck,
  Users, Wallet,
} from 'lucide-react';
import type { PermissionRequirement } from '@/api/permissions';
import type { Capability } from './businessCapabilities';

export interface NavItem {
  label: string;
  href: string;
  permission?: PermissionRequirement;
  requires?: Capability;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** A single link (no children). */
  href?: string;
  permission?: PermissionRequirement;
  requires?: Capability;
  /** Shown only when the pharmacy menu is on (§6). */
  pharmacy?: boolean;
  items?: NavItem[];
}

// §6. Every item declares the permission that shows it; the API enforces the same permission.
export const navigation: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', permission: 'Dashboard.View' },
  {
    label: 'Point of Sale',
    icon: ShoppingCart,
    items: [
      { label: 'New Sale', href: '/pos', permission: 'Sales.Create' },
      { label: 'Sales', href: '/sales', permission: 'Sales.View' },
      { label: 'Returns', href: '/sales/returns', permission: 'Sales.View' },
      { label: 'M-Pesa Payments', href: '/mpesa', permission: 'Mpesa.View' },
    ],
  },
  {
    label: 'Pharmacy',
    icon: Pill,
    pharmacy: true,
    items: [
      { label: 'Prescription Register', href: '/pharmacy/prescriptions', permission: 'Prescriptions.View' },
      { label: 'Batches & Expiry', href: '/inventory/batches', permission: 'Stock.View' },
    ],
  },
  {
    label: 'Customers',
    icon: Users,
    items: [
      { label: 'Customers', href: '/customers', permission: 'Customers.View' },
      { label: 'Receivables', href: '/reports/customer-aging', permission: 'CustomerReports.View' },
    ],
  },
  {
    label: 'Catalog',
    icon: Tags,
    items: [
      { label: 'Products', href: '/products', permission: 'Products.View' },
      { label: 'Categories', href: '/categories', permission: 'Categories.View' },
      { label: 'Units of Measure', href: '/units', permission: 'Units.View' },
      { label: 'Bulk Import', href: '/bulk-import', permission: ['Products.BulkImport', 'Categories.BulkImport'] },
    ],
  },
  {
    label: 'Inventory',
    icon: Boxes,
    items: [
      { label: 'Stock Levels', href: '/inventory/stock', permission: 'Stock.View' },
      { label: 'Stock Adjustments', href: '/inventory/adjustments', permission: 'Stock.Adjust' },
      { label: 'Stock Valuation', href: '/inventory/valuation', permission: 'Costing.View' },
      { label: 'Revaluations', href: '/inventory/revaluations', permission: 'Costing.Revalue' },
    ],
  },
  {
    label: 'Purchasing',
    icon: Truck,
    items: [
      { label: 'Purchase Orders', href: '/purchase-orders', permission: 'PurchaseOrders.View' },
      { label: 'Suppliers', href: '/suppliers', permission: 'Suppliers.View' },
      { label: 'Payables', href: '/payables', permission: 'Suppliers.ViewLedger' },
    ],
  },
  {
    label: 'Production',
    icon: Factory,
    requires: 'production',
    items: [
      { label: 'Formulas', href: '/production/formulas', permission: 'Formulas.View' },
      { label: 'Production Runs', href: '/production/runs', permission: 'Production.View' },
    ],
  },
  {
    label: 'Expenses',
    icon: Wallet,
    items: [
      { label: 'Expenses', href: '/expenses', permission: 'Expenses.View' },
      { label: 'Expense Categories', href: '/expenses/categories', permission: 'ExpenseCategories.View' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    items: [
      { label: 'Sales', href: '/reports/sales', permission: 'SalesReports.View' },
      { label: 'Profit & Loss', href: '/reports/profit-and-loss', permission: 'Costing.View' },
      { label: 'Profit by Product', href: '/reports/profit', permission: 'Costing.View' },
      { label: 'Margins', href: '/reports/margins', permission: 'Costing.View' },
      { label: 'Customer Aging', href: '/reports/customer-aging', permission: 'CustomerReports.View' },
      { label: 'Stock Status', href: '/reports/stock-status', permission: 'InventoryReports.View' },
      { label: 'Stock Movements', href: '/reports/stock-movements', permission: 'InventoryReports.View' },
      { label: 'Stock Adjustments', href: '/reports/stock-adjustments', permission: 'InventoryReports.View' },
      { label: 'Expiry', href: '/reports/expiry', permission: 'InventoryReports.View' },
      { label: 'Prescription Register', href: '/pharmacy/prescriptions', permission: 'Prescriptions.View' },
      { label: 'Purchases', href: '/reports/purchases', permission: 'PurchaseReports.View' },
      { label: 'Open Orders', href: '/reports/open-orders', permission: 'PurchaseReports.View' },
      { label: 'Price Trends', href: '/reports/price-trends', permission: 'PurchaseReports.View' },
      { label: 'Payables', href: '/payables', permission: 'Suppliers.ViewLedger' },
      { label: 'Production Costs', href: '/reports/production-costs', permission: 'ProductionReports.View', requires: 'production' },
      { label: 'Expense Summary', href: '/reports/expenses', permission: 'Expenses.View' },
    ],
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      { label: 'Business Profile', href: '/admin/business', permission: 'Businesses.Update' },
      { label: 'Licence', href: '/settings/license', permission: 'Businesses.View' },
      { label: 'Users', href: '/admin/users', permission: 'Users.View' },
      { label: 'Roles & Permissions', href: '/admin/roles', permission: 'Roles.View' },
      { label: 'M-Pesa Setup', href: '/admin/mpesa', permission: 'Mpesa.Configure' },
      { label: 'Audit Log', href: '/admin/audit-log', permission: 'AuditLog.View' },
    ],
  },
  { label: 'Notifications', icon: Bell, href: '/notifications' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

/** The Super User area (/platform). Never mixed with the business navigation. */
export const platformNavigation: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/platform', permission: 'Platform.Dashboard.View' },
  { label: 'Businesses', icon: Building2, href: '/platform/businesses', permission: 'Businesses.ViewAll' },
  { label: 'Licences', icon: BadgeCheck, href: '/platform/licenses', permission: 'Licenses.View' },
  { label: 'Super Users', icon: ShieldCheck, href: '/platform/super-users', permission: 'Platform.Users.Manage' },
  { label: 'Platform Audit Log', icon: ScrollText, href: '/platform/audit-log', permission: 'Platform.Support' },
  { label: 'Notifications', icon: Bell, href: '/platform/notifications' },
];

export const quickLinks: { label: string; href: string; icon: LucideIcon; permission?: PermissionRequirement }[] = [
  { label: 'New sale', href: '/pos', icon: Receipt, permission: 'Sales.Create' },
  { label: 'New purchase order', href: '/purchase-orders/new', icon: ClipboardList, permission: 'PurchaseOrders.Create' },
];
