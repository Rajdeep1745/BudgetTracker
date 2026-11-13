"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Settings,
  Wallet,
} from "lucide-react";
import BudgetTab from "../budget/BudgetTab";
import DashboardTab from "../dashboard/DashboardTab";
import ReportsTab from "../reports/ReportsTab";
import SettingsTab from "../settings/SettingsTab";
import { apiRequest } from "../../lib/api";
import { localToday } from "../../lib/format";
import { openPickerFromLabel } from "../../lib/openPickerFromLabel";
import { useToast } from "../../components/ToastProvider";
import type {
  BudgetFixedCostInput,
  DashboardData,
  FixedCostType,
  GroupName,
  Tab,
  Transaction,
  TransactionBrowserProps,
  TransactionFilters,
  TransactionFormValues,
  TransactionInput,
  TransactionSort,
} from "../../types";

const currentMonth = localToday().slice(0, 7);
const emptyTransactionFilters: TransactionFilters = {
  search: "",
  categoryId: "",
  from: "",
  to: "",
};
const navItems: { name: Tab; icon: typeof LayoutDashboard }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Budget", icon: Wallet },
  { name: "Reports", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];

export default function HomePage() {
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [selectedReportDay, setSelectedReportDay] = useState(
    () => Number(localToday().slice(-2)),
  );
  const [data, setData] = useState<DashboardData>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    emptyTransactionFilters,
  );
  const [transactionSort, setTransactionSort] = useState<TransactionSort>({
    sortBy: "date",
    sortDirection: "desc",
  });
  const { showToast } = useToast();
  const [currency, setCurrency] = useState("INR");
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [allowanceInput, setAllowanceInput] = useState("");
  const [fixedCostsInput, setFixedCostsInput] = useState<
    BudgetFixedCostInput[]
  >([]);
  const [carryInInput, setCarryInInput] = useState("0");
  const [alreadySavedInput, setAlreadySavedInput] = useState("");
  const [savingsTargetInput, setSavingsTargetInput] = useState("");
  const [personalPercent, setPersonalPercent] = useState(40);
  const [dismissedAlertMonth, setDismissedAlertMonth] = useState("");
  const [fixedCostTypes, setFixedCostTypes] = useState<FixedCostType[]>([]);
  const [fixedCostName, setFixedCostName] = useState("");
  const [settingsCarryInEnabled, setSettingsCarryInEnabled] = useState(true);
  const [isSavingCarryIn, setIsSavingCarryIn] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState<GroupName>("Personal");
  const [form, setForm] = useState<TransactionFormValues>({
    categoryId: "",
    description: "",
    amount: "",
    transactionDate: localToday(),
  });

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency],
  );
  const formatMoney = (value: number) => money.format(value || 0);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await apiRequest(`/dashboard?month=${month}`);
      const dashboard: DashboardData = await response.json();
      setData(dashboard);
      setAllowanceInput(String(dashboard.budget.allowance));
      setFixedCostsInput(
        dashboard.budget.fixedCosts.map((cost) => ({
          ...cost,
          amount: String(cost.amount),
        })),
      );
      setCarryInInput(String(dashboard.budget.carryIn));
      setAlreadySavedInput(String(dashboard.budget.alreadySaved));
      setSavingsTargetInput(String(dashboard.budget.savingsTarget));
      setPersonalPercent(dashboard.budget.personalPercent);
      setForm((value) => ({
        ...value,
        categoryId: value.categoryId || dashboard.categories[0]?.id || "",
      }));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error instanceof TypeError
            ? `${error.message} Check that PostgreSQL and the backend are running.`
            : error.message
          : "Could not load your budget data.",
        "error",
      );
    }
  }, [month, showToast]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await apiRequest(`/settings?month=${currentMonth}`);
      const settings: {
        fixedCosts: FixedCostType[];
        carryInEnabled: boolean;
      } = await response.json();
      setFixedCostTypes(settings.fixedCosts);
      setSettingsCarryInEnabled(settings.carryInEnabled);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not load settings.",
        "error",
      );
    }
  }, [showToast]);

  const loadTransactions = useCallback(
    async (requestedPage = transactionPage) => {
      try {
        const query = new URLSearchParams({
          month,
          page: String(requestedPage),
          pageSize: "10",
          sortBy: transactionSort.sortBy,
          sortDirection: transactionSort.sortDirection,
        });
        if (transactionFilters.search.trim())
          query.set("search", transactionFilters.search.trim());
        if (transactionFilters.categoryId)
          query.set("categoryId", transactionFilters.categoryId);
        if (transactionFilters.from) query.set("from", transactionFilters.from);
        if (transactionFilters.to) query.set("to", transactionFilters.to);
        const response = await apiRequest(`/transactions?${query}`);
        const result: {
          items: Transaction[];
          total: number;
          page: number;
        } = await response.json();
        const lastPage = Math.max(1, Math.ceil(result.total / 10));
        if (requestedPage > lastPage) {
          setTransactionPage(lastPage);
          return;
        }
        setTransactions(result.items);
        setTransactionTotal(result.total);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Could not load transactions.",
          "error",
        );
      }
    },
    [month, transactionPage, transactionFilters, transactionSort, showToast],
  );

  const refresh = async (requestedPage = transactionPage) => {
    await Promise.all([loadDashboard(), loadTransactions(requestedPage)]);
  };

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void loadTransactions(),
      transactionFilters.search ? 250 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [loadTransactions, transactionFilters.search]);

  useEffect(() => {
    const now = new Date();
    const isCurrentMonth =
      month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setSelectedReportDay(
      isCurrentMonth
        ? now.getDate()
        : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate(),
    );
    setTransactionPage(1);
  }, [month]);

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem("pocketplan.currency");
    const savedThreshold = window.localStorage.getItem("pocketplan.alertThreshold");
    if (savedCurrency) setCurrency(savedCurrency);
    if (savedThreshold) setAlertThreshold(Number(savedThreshold));
  }, []);

  const submitTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm((value) => ({
        ...value,
        description: "",
        amount: "",
        transactionDate: localToday(),
      }));
      await refresh(1);
      setTransactionPage(1);
      showToast("Transaction added.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save this transaction.",
        "error",
      );
    }
  };

  const saveBudget = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest("/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          allowance: Number(allowanceInput),
          personalPercent,
          fixedCosts: fixedCostsInput.map((cost) => ({
            id: cost.id,
            amount: Number(cost.amount),
          })),
          carryIn: Number(carryInInput),
          carryInEnabled:
            data?.budget.carryInEnabled ?? settingsCarryInEnabled,
          alreadySaved: Number(alreadySavedInput),
          savingsTarget: Number(savingsTargetInput),
        }),
      });
      await loadDashboard();
      showToast("Budget saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not update this budget.",
        "error",
      );
    }
  };

  const removeTransaction = async (id: string) => {
    try {
      await apiRequest(`/transactions/${id}`, { method: "DELETE" });
      await refresh();
      showToast("Transaction deleted.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not delete this transaction.",
        "error",
      );
    }
  };

  const saveTransaction = async (
    id: string,
    transaction: TransactionInput,
  ): Promise<boolean> => {
    try {
      await apiRequest(`/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });
      await refresh();
      showToast("Transaction updated.");
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not update this transaction.",
        "error",
      );
      return false;
    }
  };

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          groupName: newCategoryGroup,
        }),
      });
      setNewCategoryName("");
      await loadDashboard();
      showToast("Category added.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not add this category.",
        "error",
      );
    }
  };

  const addFixedCost = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest("/settings/fixed-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fixedCostName,
          effectiveMonth: currentMonth,
        }),
      });
      setFixedCostName("");
      await Promise.all([loadSettings(), loadDashboard()]);
      showToast("Fixed cost added.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not add this fixed cost.",
        "error",
      );
    }
  };

  const deleteFixedCost = async (id: string) => {
    try {
      await apiRequest(
        `/settings/fixed-costs/${id}?month=${currentMonth}`,
        { method: "DELETE" },
      );
      await Promise.all([loadSettings(), loadDashboard()]);
      showToast("Fixed cost deleted. Past months are unchanged.");
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not delete this fixed cost.",
        "error",
      );
      return false;
    }
  };

  const updateCarryInSetting = async (enabled: boolean) => {
    setIsSavingCarryIn(true);
    try {
      await apiRequest("/settings/carry-in", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, effectiveMonth: currentMonth }),
      });
      await Promise.all([loadSettings(), loadDashboard()]);
      showToast(`Carry in ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not update the carry-in setting.",
        "error",
      );
    } finally {
      setIsSavingCarryIn(false);
    }
  };

  const changeFixedCostAmount = (id: string, amount: string) => {
    setFixedCostsInput((current) =>
      current.map((cost) => (cost.id === id ? { ...cost, amount } : cost)),
    );
  };

  const applyTransactionFilters = (filters: TransactionFilters) => {
    setTransactionFilters(filters);
    setTransactionPage(1);
  };

  const updateTransactionSort = (sortBy: TransactionSort["sortBy"]) => {
    setTransactionSort((current) => ({
      sortBy,
      sortDirection:
        current.sortBy === sortBy && current.sortDirection === "desc"
          ? "asc"
          : "desc",
    }));
    setTransactionPage(1);
  };

  const saveCurrency = (value: string) => {
    setCurrency(value);
    window.localStorage.setItem("pocketplan.currency", value);
  };

  const saveAlertThreshold = (value: number) => {
    setAlertThreshold(value);
    window.localStorage.setItem("pocketplan.alertThreshold", String(value));
  };

  const transactionProps: TransactionBrowserProps = {
    transactions,
    categories: data?.categories ?? [],
    filters: transactionFilters,
    onApplyFilters: applyTransactionFilters,
    sort: transactionSort,
    onSort: updateTransactionSort,
    page: transactionPage,
    total: transactionTotal,
    onPageChange: setTransactionPage,
    onDelete: removeTransaction,
    onEdit: saveTransaction,
    formatMoney,
  };

  const budgetAlertActive = Boolean(
    data &&
      data.totals.budget > 0 &&
      data.groups.some(
        (group) =>
          group.budget > 0 &&
          Math.min(100, Math.round((group.spent / group.budget) * 100)) >=
            alertThreshold,
      ),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setTab("Dashboard")}>
          <span className="brand-mark"><Wallet size={19} /></span>
          <span>PocketPlan</span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              className={`nav-item ${tab === name ? "active" : ""}`}
              key={name}
              onClick={() => setTab(name)}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{name}</span>
              {tab === name && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon"><CircleHelp size={17} /></span>
          <p>One monthly budget, split your way.</p>
          <button type="button" onClick={() => setTab("Budget")}>Manage budget <span>→</span></button>
        </div>
        <div className="sidebar-foot">
          <span className="avatar">P</span>
          <span><strong>My finances</strong><small>Personal workspace</small></span>
          <ChevronDown size={16} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Wallet size={18} /></span> PocketPlan</div>
          <label className="month-picker" onClick={openPickerFromLabel}>
            <CalendarDays size={16} />
            <input
              aria-label="Choose month"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setTransactionPage(1);
              }}
            />
          </label>
        </header>

        <div className="page-content">
          {tab === "Dashboard" && (
            <DashboardTab
              data={data}
              month={month}
              currency={currency}
              formatMoney={formatMoney}
              alertThreshold={alertThreshold}
              alertActive={budgetAlertActive}
              dismissedAlert={dismissedAlertMonth === month}
              onDismissAlert={() => setDismissedAlertMonth(month)}
              form={form}
              setForm={setForm}
              onSubmit={submitTransaction}
              onNavigate={setTab}
              transactionProps={transactionProps}
            />
          )}
          {tab === "Budget" && (
            <BudgetTab
              month={month}
              currency={currency}
              allowanceInput={allowanceInput}
              setAllowanceInput={setAllowanceInput}
              fixedCosts={fixedCostsInput}
              onFixedCostChange={changeFixedCostAmount}
              carryInInput={carryInInput}
              setCarryInInput={setCarryInInput}
              carryInEnabled={
                data?.budget.carryInEnabled ?? settingsCarryInEnabled
              }
              alreadySavedInput={alreadySavedInput}
              setAlreadySavedInput={setAlreadySavedInput}
              savingsTargetInput={savingsTargetInput}
              setSavingsTargetInput={setSavingsTargetInput}
              personalPercent={personalPercent}
              setPersonalPercent={setPersonalPercent}
              groups={data?.groups ?? []}
              formatMoney={formatMoney}
              onSave={saveBudget}
            />
          )}
          {tab === "Reports" && (
            <ReportsTab
              data={data}
              month={month}
              currency={currency}
              selectedDay={selectedReportDay}
              onSelectDay={setSelectedReportDay}
              transactionCount={transactionTotal}
              transactionProps={transactionProps}
              formatMoney={formatMoney}
            />
          )}
          {tab === "Settings" && (
            <SettingsTab
              currency={currency}
              onCurrencyChange={saveCurrency}
              alertThreshold={alertThreshold}
              onAlertThresholdChange={saveAlertThreshold}
              categoryName={newCategoryName}
              onCategoryNameChange={setNewCategoryName}
              categoryGroup={newCategoryGroup}
              onCategoryGroupChange={setNewCategoryGroup}
              onAddCategory={addCategory}
              fixedCostTypes={fixedCostTypes}
              fixedCostName={fixedCostName}
              onFixedCostNameChange={setFixedCostName}
              onAddFixedCost={addFixedCost}
              onDeleteFixedCost={deleteFixedCost}
              carryInEnabled={settingsCarryInEnabled}
              onCarryInEnabledChange={updateCarryInSetting}
              isSavingCarryIn={isSavingCarryIn}
            />
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ name, icon: Icon }) => (
          <button className={tab === name ? "active" : ""} key={name} onClick={() => setTab(name)} type="button">
            <Icon size={19} /><span>{name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
