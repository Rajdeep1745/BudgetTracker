"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  ShoppingBasket,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3101/api";
type GroupName = "Personal" | "Grocery";
type Category = {
  id: string;
  name: string;
  group_name: GroupName;
  color: string;
  spent: number;
};
type BudgetGroup = {
  name: GroupName;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
};
type Dashboard = {
  month: string;
  totals: { budget: number; spent: number; remaining: number };
  budget: {
    allowance: number;
    rent: number;
    didiFees: number;
    carryIn: number;
    alreadySaved: number;
    savingsTarget: number;
    effectiveAllowance: number;
    spendableBudget: number;
    personalPercent: number;
  };
  groups: BudgetGroup[];
  categories: Category[];
  daily: { date: string; amount: number }[];
};
type Transaction = {
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
type Tab = "Dashboard" | "Budget" | "Reports" | "Settings";

const navItems: { name: Tab; icon: typeof LayoutDashboard }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Budget", icon: Wallet },
  { name: "Reports", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];
const localToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const currentMonth = localToday().slice(0, 7);
const parseTransactionDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(Number.NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};
const formatTransactionDate = (value: string) => {
  const date = parseTransactionDate(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

export default function Home() {
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [selectedReportDay, setSelectedReportDay] = useState(
    () => Number(localToday().slice(-2)),
  );
  const [data, setData] = useState<Dashboard>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [message, setMessage] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [allowanceInput, setAllowanceInput] = useState("");
  const [rentInput, setRentInput] = useState("");
  const [didiFeesInput, setDidiFeesInput] = useState("");
  const [carryInInput, setCarryInInput] = useState("0");
  const [alreadySavedInput, setAlreadySavedInput] = useState("");
  const [savingsTargetInput, setSavingsTargetInput] = useState("");
  const [personalPercent, setPersonalPercent] = useState(40);
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [form, setForm] = useState({
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

  const load = async () => {
    try {
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        fetch(`${api}/dashboard?month=${month}`),
        fetch(`${api}/transactions?month=${month}`),
      ]);
      if (!dashboardResponse.ok || !transactionsResponse.ok) {
        throw new Error("Could not load your budget data.");
      }
      const dashboard: Dashboard = await dashboardResponse.json();
      setData(dashboard);
      setTransactions(await transactionsResponse.json());
      setAllowanceInput(String(dashboard.budget.allowance));
      setRentInput(String(dashboard.budget.rent));
      setDidiFeesInput(String(dashboard.budget.didiFees));
      setCarryInInput(String(dashboard.budget.carryIn));
      setAlreadySavedInput(String(dashboard.budget.alreadySaved));
      setSavingsTargetInput(String(dashboard.budget.savingsTarget));
      setPersonalPercent(dashboard.budget.personalPercent);
      setForm((value) => ({
        ...value,
        categoryId: value.categoryId || dashboard.categories[0]?.id || "",
      }));
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${error.message} Check that PostgreSQL and the backend are running.`
          : "Could not load your budget data.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, [month]);

  useEffect(() => {
    const now = new Date();
    const isCurrentMonth =
      month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setSelectedReportDay(
      isCurrentMonth
        ? now.getDate()
        : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate(),
    );
  }, [month]);

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem("pocketplan.currency");
    const savedThreshold = window.localStorage.getItem(
      "pocketplan.alertThreshold",
    );
    if (savedCurrency) setCurrency(savedCurrency);
    if (savedThreshold) setAlertThreshold(Number(savedThreshold));
  }, []);

  const chart = useMemo(() => {
    if (!data) return [];
    const days = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
    ).getDate();
    const dailySpend = new Map(
      data.daily.map((entry) => [
        Number(entry.date.slice(-2)),
        Number(entry.amount),
      ]),
    );
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const daysElapsed =
      month < currentMonthKey ? days : month === currentMonthKey ? now.getDate() : 0;
    const spentToDate = [...dailySpend.entries()]
      .filter(([day]) => day <= daysElapsed)
      .reduce((sum, [, amount]) => sum + amount, 0);
    const averageDailySpend = daysElapsed > 0 ? spentToDate / daysElapsed : 0;
    let running = 0;
    return Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      running += dailySpend.get(day) ?? 0;
      return {
        day,
        actual: day <= daysElapsed ? running : null,
        expected:
          daysElapsed > 0 && day >= daysElapsed
            ? spentToDate + averageDailySpend * (day - daysElapsed)
            : null,
        ideal: (Math.max(data.totals.budget, 0) * day) / days,
      };
    });
  }, [data, month]);
  const dailyPace = useMemo(() => {
    const now = new Date();
    const selectedYear = Number(month.slice(0, 4));
    const selectedMonth = Number(month.slice(5));
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const selectedKey = selectedYear * 12 + selectedMonth;
    const currentKey = now.getFullYear() * 12 + now.getMonth() + 1;
    const daysElapsed =
      selectedKey < currentKey
        ? daysInMonth
        : selectedKey === currentKey
          ? now.getDate()
          : 0;
    const spentToDate = (data?.daily ?? [])
      .filter((entry) => Number(entry.date.slice(-2)) <= daysElapsed)
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
    const averageDailySpend = daysElapsed > 0 ? spentToDate / daysElapsed : 0;
    const idealDailySpend =
      daysInMonth > 0 ? Math.max(data?.totals.budget ?? 0, 0) / daysInMonth : 0;

    return {
      averageDailySpend,
      idealDailySpend,
      difference: idealDailySpend - averageDailySpend,
      daysElapsed,
    };
  }, [data, month]);
  const daysInReportMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const reportThroughDay = Math.min(
    Math.max(selectedReportDay, 1),
    daysInReportMonth,
  );
  const cumulativeByGroup = useMemo(
    () =>
      (["Personal", "Grocery"] as const).map((name) => {
        const group = data?.groups.find((entry) => entry.name === name);
        const spent = transactions
          .filter(
            (transaction) =>
              transaction.group_name === name &&
              Number(transaction.transaction_date.slice(8, 10)) <=
                reportThroughDay,
          )
          .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
        const spentOnDay = transactions
          .filter(
            (transaction) =>
              transaction.group_name === name &&
              Number(transaction.transaction_date.slice(8, 10)) ===
                reportThroughDay,
          )
          .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
        const remaining = Math.max((group?.budget ?? 0) - spent, 0);
        const daysRemaining = Math.max(daysInReportMonth - reportThroughDay, 0);
        return {
          name,
          budget: group?.budget ?? 0,
          spent,
          spentOnDay,
          remaining,
          daysRemaining,
          dailyAllowed: daysRemaining > 0 ? remaining / daysRemaining : 0,
          averageDaily: spent / reportThroughDay,
          idealDaily: (group?.budget ?? 0) / daysInReportMonth,
        };
      }),
    [data, transactions, reportThroughDay, daysInReportMonth],
  );
  const groupPaceCharts = useMemo(
    () =>
      (["Personal", "Grocery"] as const).map((name) => {
        const group = data?.groups.find((entry) => entry.name === name);
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const daysElapsed =
          month < currentMonthKey
            ? daysInReportMonth
            : month === currentMonthKey
              ? now.getDate()
              : 0;
        const dailyAmounts = new Map<number, number>();
        transactions.forEach((transaction) => {
          if (transaction.group_name !== name) return;
          const day = Number(transaction.transaction_date.slice(8, 10));
          dailyAmounts.set(
            day,
            (dailyAmounts.get(day) ?? 0) + Number(transaction.amount),
          );
        });
        const spentToDate = [...dailyAmounts.entries()]
          .filter(([day]) => day <= daysElapsed)
          .reduce((sum, [, amount]) => sum + amount, 0);
        const averageDailySpend =
          daysElapsed > 0 ? spentToDate / daysElapsed : 0;
        let running = 0;
        const chartData = Array.from(
          { length: daysInReportMonth },
          (_, index) => {
            const day = index + 1;
            running += dailyAmounts.get(day) ?? 0;
            return {
              day,
              actual: day <= daysElapsed ? running : null,
              expected:
                daysElapsed > 0 && day >= daysElapsed
                  ? spentToDate + averageDailySpend * (day - daysElapsed)
                  : null,
              ideal:
                ((group?.budget ?? 0) * day) / daysInReportMonth,
            };
          },
        );
        return { name, budget: group?.budget ?? 0, chartData };
      }),
    [data, transactions, daysInReportMonth, month],
  );
  const topFiveByGroup = useMemo(
    () =>
      (["Personal", "Grocery"] as const).map((name) => ({
        name,
        expenses: transactions
          .filter((transaction) => transaction.group_name === name)
          .slice()
          .sort((a, b) => Number(b.amount) - Number(a.amount))
          .slice(0, 5),
      })),
    [transactions],
  );

  const submitTransaction = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      const response = await fetch(`${api}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not save this transaction.");
      }
      setForm((value) => ({
        ...value,
        description: "",
        amount: "",
        transactionDate: localToday(),
      }));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save this transaction.",
      );
    }
  };

  const saveBudget = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setBudgetSaved(false);
    try {
      const response = await fetch(`${api}/budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          allowance: Number(allowanceInput),
          personalPercent,
          rent: Number(rentInput),
          didiFees: Number(didiFeesInput),
          carryIn: Number(carryInInput),
          alreadySaved: Number(alreadySavedInput),
          savingsTarget: Number(savingsTargetInput),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not update this budget.");
      }
      await load();
      setBudgetSaved(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update this budget.",
      );
    }
  };

  const removeTransaction = async (id: string) => {
    try {
      const response = await fetch(`${api}/transactions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete this transaction.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not delete this transaction.",
      );
    }
  };

  const saveCurrency = (value: string) => {
    setCurrency(value);
    window.localStorage.setItem("pocketplan.currency", value);
  };
  const saveAlertThreshold = (value: number) => {
    setAlertThreshold(value);
    window.localStorage.setItem("pocketplan.alertThreshold", String(value));
  };
  const percent = (value: number, total: number) =>
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const calculatedEffectiveAllowance =
    (Number(allowanceInput) || 0) -
    (Number(rentInput) || 0) -
    (Number(didiFeesInput) || 0) +
    (Number(carryInInput) || 0);
  const calculatedSpendableBudget =
    calculatedEffectiveAllowance - (Number(savingsTargetInput) || 0);
  const personalGroup = data?.groups.find((group) => group.name === "Personal");
  const groceryGroup = data?.groups.find((group) => group.name === "Grocery");
  const topCategories = [...(data?.categories ?? [])]
    .sort((a, b) => b.spent - a.spent)
    .filter((category) => category.spent > 0);
  const recentTransactions = transactions
    .filter((transaction) => {
      const query = transactionSearch.trim().toLocaleLowerCase();
      if (!query) return true;
      return [
        transaction.category_name,
        transaction.description,
        transaction.group_name,
        transaction.transaction_date,
        formatTransactionDate(transaction.transaction_date),
        String(transaction.amount),
      ].some((value) => value.toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => {
      const dateDifference =
        parseTransactionDate(b.transaction_date).getTime() -
        parseTransactionDate(a.transaction_date).getTime();
      if (dateDifference) return dateDifference;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

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
          <div className="breadcrumb">Workspace <span>/</span> <strong>{tab}</strong></div>
          <label className="month-picker">
            <CalendarDays size={16} />
            <input
              aria-label="Choose month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        </header>

        <div className="page-content">
          {message && <div className="notice" role="alert">{message}</div>}
          {tab === "Dashboard" && (
            <>
              <PageHeading
                eyebrow="YOUR MONEY, AT A GLANCE"
                title="Dashboard"
                description={`Here's your financial overview for ${monthLabel(month)}.`}
              />
              <section className="stats-grid">
                <Stat icon={<Wallet />} label="Spendable budget" value={formatMoney(data?.totals.budget ?? 0)} tone="violet" />
                <Stat icon={<CreditCard />} label="Spent this month" value={formatMoney(data?.totals.spent ?? 0)} tone="rose" />
                <Stat icon={<ArrowDownRight />} label="Left to spend" value={formatMoney(data?.totals.remaining ?? 0)} tone="green" />
                <Stat
                  icon={<BarChart3 />}
                  label="Daily pace"
                  value={dailyPace.daysElapsed ? `${formatMoney(Math.abs(dailyPace.difference))}/day` : "—"}
                  detail={
                    dailyPace.daysElapsed
                      ? `${dailyPace.difference === 0 ? "On" : dailyPace.difference > 0 ? "Under" : "Over"} pace · avg ${formatMoney(dailyPace.averageDailySpend)} / ideal ${formatMoney(dailyPace.idealDailySpend)}`
                      : "Starts when the selected month begins"
                  }
                  tone={dailyPace.difference >= 0 ? "green" : "rose"}
                />
              </section>

              {data && data.totals.budget > 0 &&
                data.groups.some((group) => group.budget > 0 && percent(group.spent, group.budget) >= alertThreshold) && (
                  <div className="notice alert-notice">
                    <span>Budget alert</span> One of your budget groups has used {alertThreshold}% or more of its allocation.
                  </div>
                )}

              <section className="dashboard-grid">
                <article className="card pace-card">
                  <div className="card-heading">
                    <div><h2>Spending pace</h2><p>Actual spending compared with your ideal monthly pace</p></div>
                    <span className="period-pill">{monthLabel(month)}</span>
                  </div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spendingFill" x1="0" x2="0" y1="0" y2="1">
                            <stop stopColor="#6558d3" stopOpacity={0.24} />
                            <stop offset="1" stopColor="#6558d3" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#edf0f5" />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#858b9f", fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${currency === "INR" ? "₹" : ""}${value}`} tickLine={false} axisLine={false} tick={{ fill: "#858b9f", fontSize: 12 }} width={60} />
                        <Tooltip formatter={(value) => formatMoney(Number(value))} />
                        <Legend />
                        <Area type="monotone" name="Actual cumulative" dataKey="actual" stroke="#6558d3" fill="url(#spendingFill)" strokeWidth={2.5} />
                        <Line type="monotone" name="Expected trend" dataKey="expected" stroke="#6558d3" strokeDasharray="6 4" strokeWidth={2.5} dot={false} connectNulls />
                        <Area type="monotone" name="Ideal pace" dataKey="ideal" stroke="#48a889" fill="none" strokeDasharray="5 5" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                <TransactionForm
                  categories={data?.categories ?? []}
                  form={form}
                  setForm={setForm}
                  onSubmit={submitTransaction}
                />
              </section>

              <section className="card group-card">
                <div className="card-heading">
                  <div><h2>Your budget split</h2><p>Two groups, one monthly budget. Subcategories only organize expenses.</p></div>
                  <button className="text-button" onClick={() => setTab("Budget")} type="button">Edit budget <span>→</span></button>
                </div>
                <div className="group-grid">
                  {[
                    { name: "Personal" as const, group: personalGroup, color: "#6558d3", icon: <Wallet size={18} /> },
                    { name: "Grocery" as const, group: groceryGroup, color: "#35a77e", icon: <ShoppingBasket size={18} /> },
                  ].map(({ name, group, color, icon }) => (
                    <GroupCard
                      key={name}
                      name={name}
                      group={group}
                      color={color}
                      icon={icon}
                      formatMoney={formatMoney}
                      percent={percent}
                    />
                  ))}
                </div>
              </section>

              <section className="card transactions-card">
                <div className="card-heading">
                  <div><h2>Recent transactions</h2><p>Your expenses for {monthLabel(month)}, newest first</p></div>
                  <span className="count-pill">{recentTransactions.length} of {transactions.length} transactions</span>
                </div>
                <label className="transaction-search">
                  <Search size={16} />
                  <input
                    aria-label="Search transactions"
                    placeholder="Search category, description, date..."
                    value={transactionSearch}
                    onChange={(event) => setTransactionSearch(event.target.value)}
                  />
                </label>
                <TransactionTable transactions={recentTransactions} onDelete={removeTransaction} formatMoney={formatMoney} />
              </section>
            </>
          )}

          {tab === "Budget" && (
            <>
              <PageHeading
                eyebrow="PLAN YOUR MONTH"
                title="Budget"
                description="Set your allowance, account for fixed costs and savings, then split what remains between Personal and Grocery."
              />
              <form className="card budget-editor" onSubmit={saveBudget}>
                <div className="budget-form-heading">
                  <span className="large-icon violet"><Wallet size={21} /></span>
                  <div><h2>Monthly budget</h2><p>This budget applies to {monthLabel(month)}.</p></div>
                </div>
                <label className="input-label" htmlFor="total-budget">Monthly allowance</label>
                <div className="money-input">
                  <span>{currency === "INR" ? "₹" : currency}</span>
                  <input id="total-budget" required min="0" step="0.01" type="number" value={allowanceInput} onChange={(event) => setAllowanceInput(event.target.value)} placeholder="Enter your monthly allowance" />
                </div>
                <div className="budget-input-grid">
                  <MoneyField id="rent" label="Rent" value={rentInput} onChange={setRentInput} currency={currency} />
                  <MoneyField id="didi-fees" label="Didi fees" value={didiFeesInput} onChange={setDidiFeesInput} currency={currency} />
                  <MoneyField id="carry-in" label="Carry in" hint="Can be negative" value={carryInInput} onChange={setCarryInInput} currency={currency} allowNegative />
                </div>
                <section className="savings-panel" aria-labelledby="savings-heading">
                  <div className="savings-heading">
                    <span className="large-icon green-icon"><Wallet size={20} /></span>
                    <div><h2 id="savings-heading">Savings</h2><p>Your existing savings and this month’s savings goal.</p></div>
                  </div>
                  <div className="budget-input-grid savings-inputs">
                    <MoneyField id="already-saved" label="Total saved so far" value={alreadySavedInput} onChange={setAlreadySavedInput} currency={currency} />
                    <MoneyField id="monthly-savings" label="Save this month" hint="Deducted before allocation" value={savingsTargetInput} onChange={setSavingsTargetInput} currency={currency} />
                  </div>
                </section>
                <div className="calculation-summary">
                  <div><span>Effective allowance</span><strong>{formatMoney(calculatedEffectiveAllowance)}</strong><small>Allowance − rent − Didi fees + carry in</small></div>
                  <div className="spendable-summary"><span>Spendable budget</span><strong>{formatMoney(calculatedSpendableBudget)}</strong><small>Effective allowance − savings goal</small></div>
                </div>
                <div className="split-heading">
                  <div><h3>Allocate spendable budget</h3><p>Percentages apply after fixed costs and savings.</p></div>
                  <span className="total-badge">100% total</span>
                </div>
                <label className="range-label" htmlFor="personal-percent">
                  <span><i className="dot purple-dot" />Personal</span>
                  <strong>{personalPercent}%</strong>
                </label>
                <input id="personal-percent" className="split-range personal-range" type="range" min="0" max="100" value={personalPercent} onChange={(event) => setPersonalPercent(Number(event.target.value))} />
                <div className="split-preview">
                  <SplitPreview
                    name="Personal"
                    percent={personalPercent}
                    amount={Math.max(calculatedSpendableBudget, 0) * personalPercent / 100}
                    color="#6558d3"
                    formatMoney={formatMoney}
                  />
                  <SplitPreview
                    name="Grocery"
                    percent={100 - personalPercent}
                    amount={Math.max(calculatedSpendableBudget, 0) * (100 - personalPercent) / 100}
                    color="#35a77e"
                    formatMoney={formatMoney}
                  />
                </div>
                <div className="split-bar" aria-label={`${personalPercent}% Personal, ${100 - personalPercent}% Grocery`}>
                  <span style={{ width: `${personalPercent}%`, background: "#6558d3" }} />
                  <span style={{ width: `${100 - personalPercent}%`, background: "#35a77e" }} />
                </div>
                <button className="primary-button save-budget-button" type="submit"><Check size={17} /> Save budget</button>
                {budgetSaved && <p className="success-message"><Check size={15} /> Budget saved for {monthLabel(month)}.</p>}
              </form>

              <section className="card group-card budget-groups">
                <div className="card-heading">
                  <div><h2>Group overview</h2><p>Spending within each part of your overall budget</p></div>
                </div>
                <div className="group-grid">
                  {[
                    { name: "Personal" as const, group: personalGroup, color: "#6558d3", icon: <Wallet size={18} /> },
                    { name: "Grocery" as const, group: groceryGroup, color: "#35a77e", icon: <ShoppingBasket size={18} /> },
                  ].map(({ name, group, color, icon }) => (
                    <GroupCard key={name} name={name} group={group} color={color} icon={icon} formatMoney={formatMoney} percent={percent} />
                  ))}
                </div>
              </section>
              <p className="helper-note">Categories such as Food, Transportation, Vegetables, and Bills are used to label transactions only. They do not have individual budgets.</p>
            </>
          )}

          {tab === "Reports" && (
            <>
              <PageHeading
                eyebrow="UNDERSTAND YOUR SPENDING"
                title="Monthly reports"
                description={`Compare group spending, daily pace, and cumulative totals for ${monthLabel(month)}.`}
              />
              <section className="stats-grid report-stats">
                <Stat icon={<Wallet />} label="Allocated budget" value={formatMoney(data?.totals.budget ?? 0)} tone="violet" />
                <Stat icon={<CreditCard />} label="Total spent" value={formatMoney(data?.totals.spent ?? 0)} tone="rose" />
                <Stat icon={<ArrowDownRight />} label="Budget remaining" value={formatMoney(data?.totals.remaining ?? 0)} tone="green" />
                <Stat icon={<BarChart3 />} label="Transactions" value={String(transactions.length)} tone="amber" />
              </section>
              <section className="card cumulative-report">
                <div className="card-heading">
                  <div><h2>Spending on a selected day</h2><p>See the total amount spent on one specific day.</p></div>
                  <label className="report-day-picker">Day
                    <select aria-label="Selected spending day" value={reportThroughDay} onChange={(event) => setSelectedReportDay(Number(event.target.value))}>
                      {Array.from({ length: daysInReportMonth }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </label>
                </div>
                <div className="cumulative-cards">
                  {cumulativeByGroup.map((group) => (
                    <article className={`cumulative-tile ${group.name.toLowerCase()}`} key={group.name}>
                      <span>{group.name} spent on day {reportThroughDay}</span>
                      <strong>{formatMoney(group.spentOnDay)}</strong>
                      <small>of {formatMoney(group.budget)} allocation</small>
                    </article>
                  ))}
                  <article className="cumulative-tile total-cumulative">
                    <span>Total spent on day {reportThroughDay}</span>
                    <strong>{formatMoney(cumulativeByGroup.reduce((sum, group) => sum + group.spentOnDay, 0))}</strong>
                    <small>{monthLabel(month)}</small>
                  </article>
                </div>
              </section>
              <section className="report-grid group-report-grid">
                {groupPaceCharts.map(({ name, chartData }) => {
                  const color = name === "Personal" ? "#6558d3" : "#35a77e";
                  return (
                    <article className="card report-chart-card" key={name}>
                      <div className="card-heading"><div><h2>{name} spending &amp; pace</h2><p>Actual cumulative spend and expected trend through month end</p></div></div>
                      <div className="chart-wrap report-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                            <defs><linearGradient id={`${name.toLowerCase()}ReportFill`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={color} stopOpacity={0.24} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid vertical={false} stroke="#edf0f5" />
                            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#858b9f", fontSize: 12 }} />
                            <YAxis tickFormatter={(value) => `${currency === "INR" ? "₹" : ""}${value}`} tickLine={false} axisLine={false} tick={{ fill: "#858b9f", fontSize: 12 }} width={60} />
                            <Tooltip formatter={(value) => formatMoney(Number(value))} />
                            <Legend />
                            <Area type="monotone" name="Actual cumulative" dataKey="actual" stroke={color} fill={`url(#${name.toLowerCase()}ReportFill)`} strokeWidth={2.5} />
                            <Line type="monotone" name="Expected trend" dataKey="expected" stroke={color} strokeDasharray="6 4" strokeWidth={2.5} dot={false} connectNulls />
                            <Line type="monotone" name="Ideal pace" dataKey="ideal" stroke="#a1a5b1" fill="none" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </article>
                  );
                })}
              </section>
              <section className="card daily-allowance-report">
                <div className="card-heading"><div><h2>Daily allowed spend from tomorrow</h2><p>Remaining group budget divided evenly across the days after day {reportThroughDay}. Negative balances show as zero.</p></div></div>
                <div className="daily-allowance-grid">
                  {cumulativeByGroup.map((group) => (
                    <article className={`daily-allowance-tile ${group.name.toLowerCase()}`} key={group.name}>
                      <span>{group.name}</span>
                      <strong>{formatMoney(group.dailyAllowed)}<small> / day</small></strong>
                      <p>{formatMoney(group.remaining)} remaining across {group.daysRemaining} days</p>
                    </article>
                  ))}
                </div>
              </section>
              <section className="report-grid top-spends-grid">
                {topFiveByGroup.map(({ name, expenses }) => (
                  <article className="card transactions-card" key={name}>
                    <div className="card-heading"><div><h2>Top 5 expenses · {name}</h2><p>Largest transactions in {monthLabel(month)}</p></div></div>
                    {expenses.length ? (
                      <div className="top-spends-list">
                        {expenses.map((transaction, index) => (
                          <div className="top-spend-row" key={transaction.id}>
                            <span className="top-spend-rank">{index + 1}</span>
                            <span className="top-spend-copy"><strong>{transaction.category_name}</strong><small>{transaction.description || formatTransactionDate(transaction.transaction_date)}</small></span>
                            <strong className="top-spend-amount">{formatMoney(Number(transaction.amount))}</strong>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState text={`No ${name.toLowerCase()} expenses this month.`} />}
                  </article>
                ))}
              </section>
              <section className="card transactions-card category-report">
                <div className="card-heading"><div><h2>Spending by category</h2><p>Categories are labels, not separate budget limits</p></div></div>
                {topCategories.length ? (
                  <div className="category-list">
                    {topCategories.map((category) => {
                      const share = percent(category.spent, data?.totals.spent ?? 0);
                      return (
                        <div className="category-row" key={category.id}>
                          <span className="category-color" style={{ backgroundColor: category.color }} />
                          <div className="category-name"><strong>{category.name}</strong><small>{category.group_name}</small></div>
                          <div className="category-share-track"><span style={{ width: `${share}%`, backgroundColor: category.color }} /></div>
                          <strong className="category-amount">{formatMoney(category.spent)}</strong>
                        </div>
                      );
                    })}
                  </div>
                ) : <EmptyState text="No category spending to report for this month yet." />}
              </section>
              <section className="card transactions-card">
                <div className="card-heading"><div><h2>All transactions</h2><p>{monthLabel(month)}</p></div><span className="count-pill">{transactions.length} transactions</span></div>
                <TransactionTable transactions={transactions} onDelete={removeTransaction} formatMoney={formatMoney} />
              </section>
            </>
          )}

          {tab === "Settings" && (
            <>
              <PageHeading
                eyebrow="MAKE POCKETPLAN YOURS"
                title="Settings"
                description="Manage preferences for your PocketPlan workspace."
              />
              <section className="settings-list">
                <article className="card setting-row">
                  <div className="setting-icon"><CreditCard size={19} /></div>
                  <div className="setting-copy"><h2>Currency</h2><p>Choose how amounts are displayed across the app.</p></div>
                  <select className="setting-control" aria-label="Currency" value={currency} onChange={(event) => saveCurrency(event.target.value)}>
                    <option value="INR">Indian Rupee (₹)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="GBP">British Pound (£)</option>
                  </select>
                </article>
                <article className="card setting-row">
                  <div className="setting-icon amber-setting"><BarChart3 size={19} /></div>
                  <div className="setting-copy"><h2>Budget alert</h2><p>Show a dashboard alert when a group reaches this share of its allocation.</p></div>
                  <label className="threshold-control"><input aria-label="Budget alert threshold percentage" type="number" min="1" max="100" value={alertThreshold} onChange={(event) => saveAlertThreshold(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /><span>%</span></label>
                </article>
                <article className="card settings-info">
                  <span className="settings-info-icon"><CircleHelp size={19} /></span>
                  <div><h2>About your budget</h2><p>Your monthly total is divided between Personal and Grocery. The categories from your list are only used to organize transactions and reports—there are no separate subcategory budgets.</p></div>
                </article>
              </section>
            </>
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

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: string;
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <div><p>{label}</p><strong>{value}</strong>{detail && <small className="stat-detail">{detail}</small>}</div>
    </article>
  );
}

function TransactionForm({
  categories,
  form,
  setForm,
  onSubmit,
}: {
  categories: Category[];
  form: { categoryId: string; description: string; amount: string; transactionDate: string };
  setForm: React.Dispatch<React.SetStateAction<{ categoryId: string; description: string; amount: string; transactionDate: string }>>;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="card add-transaction" onSubmit={onSubmit}>
      <div className="card-heading add-heading">
        <span className="add-icon"><Plus size={19} /></span>
        <div><h2>Add transaction</h2><p>Record an expense in your monthly budget.</p></div>
      </div>
      <label className="input-label" htmlFor="transaction-category">Category</label>
      <select id="transaction-category" required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.group_name}</option>)}
      </select>
      <label className="input-label" htmlFor="transaction-description">Description</label>
      <input id="transaction-description" maxLength={140} placeholder="Optional" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <div className="form-two-col">
        <div><label className="input-label" htmlFor="transaction-amount">Amount</label><input id="transaction-amount" required min="0.01" step="0.01" type="number" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
        <div><label className="input-label" htmlFor="transaction-date">Date</label><input id="transaction-date" required type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></div>
      </div>
      <button className="primary-button" type="submit"><Plus size={17} /> Add expense</button>
    </form>
  );
}

function GroupCard({
  name,
  group,
  color,
  icon,
  formatMoney,
  percent,
}: {
  name: GroupName;
  group?: BudgetGroup;
  color: string;
  icon: React.ReactNode;
  formatMoney: (value: number) => string;
  percent: (value: number, total: number) => number;
}) {
  const spent = group?.spent ?? 0;
  const budget = group?.budget ?? 0;
  return (
    <article className="group-tile">
      <div className="group-tile-head">
        <span className="group-icon" style={{ color, backgroundColor: `${color}14` }}>{icon}</span>
        <div><strong>{name}</strong><small>{group?.percent ?? 0}% of monthly budget</small></div>
        <b>{formatMoney(budget)}</b>
      </div>
      <div className="progress-track"><span style={{ width: `${percent(spent, budget)}%`, backgroundColor: color }} /></div>
      <div className="group-tile-foot"><span>{formatMoney(spent)} spent</span><span>{formatMoney(group?.remaining ?? 0)} remaining</span></div>
    </article>
  );
}

function SplitPreview({
  name,
  percent,
  amount,
  color,
  formatMoney,
}: {
  name: GroupName;
  percent: number;
  amount: number;
  color: string;
  formatMoney: (value: number) => string;
}) {
  return (
    <div className="split-preview-card">
      <div><span className="dot" style={{ backgroundColor: color }} /><strong>{name}</strong><span className="split-percent">{percent}%</span></div>
      <strong className="split-amount">{formatMoney(amount)}</strong>
    </div>
  );
}

function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
  currency,
  allowNegative = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  allowNegative?: boolean;
}) {
  return (
    <div>
      <label className="input-label" htmlFor={id}>{label}</label>
      <div className="money-input compact-money-input">
        <span>{currency === "INR" ? "₹" : currency}</span>
        <input
          id={id}
          required
          step="0.01"
          type="number"
          {...(allowNegative ? {} : { min: "0" })}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}

function TransactionTable({
  transactions,
  onDelete,
  formatMoney,
}: {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  formatMoney: (value: number) => string;
}) {
  if (!transactions.length) return <EmptyState text="No expenses recorded for this month." />;
  return (
    <div className="table-scroll">
      <table className="transactions-table">
        <thead><tr><th>Category</th><th>Description</th><th>Group</th><th>Date</th><th className="amount-cell">Amount</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td><span className="category-tag"><i style={{ backgroundColor: transaction.color }} />{transaction.category_name}</span></td>
              <td className="description-cell">{transaction.description || "—"}</td>
              <td><span className={`group-tag ${transaction.group_name.toLowerCase()}`}>{transaction.group_name}</span></td>
              <td className="date-cell">{formatTransactionDate(transaction.transaction_date)}</td>
              <td className="amount-cell">{formatMoney(transaction.amount)}</td>
              <td className="delete-cell"><button type="button" aria-label={`Delete ${transaction.description}`} onClick={() => onDelete(transaction.id)}><Trash2 size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span><ShoppingBasket size={19} /></span><p>{text}</p></div>;
}
