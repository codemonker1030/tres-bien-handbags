// Hand-written TypeScript types matching the Zod schemas in
// @workspace/schemas (the backend's source of truth). Kept in sync by hand —
// if you add/change a field on the backend, mirror it here.

export interface HealthStatus {
  status: string;
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface SizeQuantity {
  size: string;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  /** @nullable */
  brand?: string | null;
  /** @nullable */
  description?: string | null;
  /** @nullable */
  imageUrl?: string | null;
  /** @nullable */
  images?: string[] | null;
  /** @nullable */
  buyingPrice?: number | null;
  price: number;
  /** @nullable */
  expectedSellingPrice?: number | null;
  stock: number;
  lowStockThreshold?: number;
  /** @nullable */
  supplier?: string | null;
  /** @nullable */
  purchaseDate?: string | null;
  /** @nullable */
  transportCost?: number | null;
  /** @nullable */
  otherCosts?: number | null;
  /** @nullable */
  sku?: string | null;
  /** @nullable */
  barcode?: string | null;
  /** @nullable */
  sizes?: string[] | null;
  /** @nullable */
  material?: string | null;
  /** @nullable */
  color?: string | null;
  /** @nullable */
  style?: string | null;
  /** @nullable */
  closureType?: string | null;
  /** @nullable */
  compartments?: number | null;
  /** @nullable */
  colorVariants?: string[] | null;
  /** @nullable */
  pattern?: string | null;
  /** @nullable */
  sleeveType?: string | null;
  /** @nullable */
  fit?: string | null;
  /** @nullable */
  season?: string | null;
  /** @nullable */
  shoeType?: string | null;
  /** @nullable */
  sizeQuantities?: SizeQuantity[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  category: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  buyingPrice?: number;
  price: number;
  expectedSellingPrice?: number;
  stock: number;
  lowStockThreshold?: number;
  supplier?: string;
  purchaseDate?: string;
  transportCost?: number;
  otherCosts?: number;
  sku?: string;
  barcode?: string;
  sizes?: string[];
  material?: string;
  color?: string;
  style?: string;
  closureType?: string;
  compartments?: number;
  colorVariants?: string[];
  pattern?: string;
  sleeveType?: string;
  fit?: string;
  season?: string;
  shoeType?: string;
  sizeQuantities?: SizeQuantity[];
}

export interface ProductUpdate {
  name?: string;
  category?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  buyingPrice?: number;
  price?: number;
  expectedSellingPrice?: number;
  stock?: number;
  lowStockThreshold?: number;
  supplier?: string;
  purchaseDate?: string;
  transportCost?: number;
  otherCosts?: number;
  sku?: string;
  barcode?: string;
  sizes?: string[];
  material?: string;
  color?: string;
  style?: string;
  closureType?: string;
  compartments?: number;
  colorVariants?: string[];
  pattern?: string;
  sleeveType?: string;
  fit?: string;
  season?: string;
  shoeType?: string;
  sizeQuantities?: SizeQuantity[];
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export const SalePaymentMethod = { cash: "cash", mpesa: "mpesa" } as const;
export type SalePaymentMethod = (typeof SalePaymentMethod)[keyof typeof SalePaymentMethod];

export interface Sale {
  id: number;
  productId: number;
  exactSellingPrice: number;
  paymentMethod: SalePaymentMethod;
  /** @nullable */
  debtAmount?: number | null;
  /** @nullable */
  customerName?: string | null;
  /** @nullable */
  debtId?: number | null;
  /** @nullable */
  debtRemaining?: number | null;
  /** @nullable */
  notes?: string | null;
  soldAt: string;
  createdAt: string;
}

export interface SaleWithProduct extends Sale {
  productName: string;
  /** @nullable */
  productImageUrl?: string | null;
}

export interface SaleInput {
  exactSellingPrice: number;
  paymentMethod: SalePaymentMethod;
  debtAmount?: number;
  customerName?: string;
  notes?: string;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  /** @nullable */
  vendor?: string | null;
  date: string;
  /** @nullable */
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  category: string;
  vendor?: string;
  date: string;
  notes?: string;
}

export interface ExpenseUpdate {
  description?: string;
  amount?: number;
  category?: string;
  vendor?: string;
  date?: string;
  notes?: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const TaskStatus = { todo: "todo", in_progress: "in_progress", done: "done" } as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = { low: "low", medium: "medium", high: "high" } as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export interface Task {
  id: number;
  title: string;
  /** @nullable */
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** @nullable */
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalProducts: number;
  lowStockCount: number;
  outstandingDebts: number;
  totalOwedToYou: number;
  openTasksCount: number;
}

export const ActivityItemType = { debt: "debt", expense: "expense", product: "product", task: "task" } as const;
export type ActivityItemType = (typeof ActivityItemType)[keyof typeof ActivityItemType];

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  description: string;
  /** @nullable */
  amount?: number | null;
  timestamp: string;
}

export interface MonthlySales {
  month: string;
  revenue: number;
  expenses: number;
}

export const GetSalesByMonthMonths = { NUMBER_1: 1, NUMBER_3: 3, NUMBER_6: 6, NUMBER_12: 12 } as const;
export type GetSalesByMonthMonths = (typeof GetSalesByMonthMonths)[keyof typeof GetSalesByMonthMonths];

export interface GetSalesByMonthParams {
  /** Number of past months to include (1, 3, 6, or 12) */
  months?: GetSalesByMonthMonths;
}
