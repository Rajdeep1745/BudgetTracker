import type { Dispatch, SetStateAction } from "react";

export type GroupName = "Personal" | "Household";

export type Category = {
  id: string;
  name: string;
  group_name: GroupName;
  color: string;
  spent: number;
};

export type BudgetGroup = {
  name: GroupName;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
};

export type FixedCostType = {
  id: string;
  name: string;
};

export type BudgetFixedCost = FixedCostType & {
  amount: number;
};

export type BudgetFixedCostInput = FixedCostType & {
  amount: string;
};

export type DashboardData = {
  month: string;
  totals: { budget: number; spent: number; remaining: number };
  budget: {
    allowance: number;
    fixedCosts: BudgetFixedCost[];
    fixedCostTotal: number;
    carryIn: number;
    carryInEnabled: boolean;
    alreadySaved: number;
    savingsTarget: number;
    effectiveAllowance: number;
    spendableBudget: number;
    personalPercent: number;
  };
  groups: BudgetGroup[];
  categories: Category[];
  daily: { date: string; amount: number }[];
  groupDaily: { group_name: GroupName; date: string; amount: number }[];
};

export type Transaction = {
  id: string;
  category_id: string;
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  group_name: GroupName;
  color: string;
  created_at?: string;
};

export type TransactionFilters = {
  search: string;
  categoryId: string;
  from: string;
  to: string;
};

export type TransactionSort = {
  sortBy: "date" | "category" | "description" | "amount";
  sortDirection: "asc" | "desc";
};

export type TransactionInput = {
  categoryId: string;
  description: string;
  amount: number;
  transactionDate: string;
};

export type TransactionFormValues = {
  categoryId: string;
  description: string;
  amount: string;
  transactionDate: string;
};

export type TransactionBrowserProps = {
  transactions: Transaction[];
  categories: Category[];
  filters: TransactionFilters;
  onApplyFilters: (filters: TransactionFilters) => void;
  sort: TransactionSort;
  onSort: (key: TransactionSort["sortBy"]) => void;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, transaction: TransactionInput) => Promise<boolean>;
  formatMoney: (value: number) => string;
};

export type TransactionFormProps = {
  categories: Category[];
  form: TransactionFormValues;
  setForm: Dispatch<SetStateAction<TransactionFormValues>>;
  onSubmit: (event: React.FormEvent) => void;
};

export type Tab = "Dashboard" | "Budget" | "Reports" | "Settings";
