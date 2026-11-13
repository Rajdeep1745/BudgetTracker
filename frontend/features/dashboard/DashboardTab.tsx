"use client";

import { useMemo } from "react";
import {
  ArrowDownRight,
  BarChart3,
  CreditCard,
  ShoppingBasket,
  Wallet,
  X,
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
import GroupCard from "../../components/GroupCard";
import Stat from "../../components/Stat";
import TransactionBrowser from "../transactions/TransactionBrowser";
import TransactionForm from "../transactions/TransactionForm";
import type {
  DashboardData,
  Tab,
  TransactionBrowserProps,
  TransactionFormValues,
} from "../../types";

export default function DashboardTab({
  data,
  month,
  currency,
  formatMoney,
  alertThreshold,
  alertActive,
  dismissedAlert,
  onDismissAlert,
  form,
  setForm,
  onSubmit,
  onNavigate,
  transactionProps,
}: {
  data?: DashboardData;
  month: string;
  currency: string;
  formatMoney: (value: number) => string;
  alertThreshold: number;
  alertActive: boolean;
  dismissedAlert: boolean;
  onDismissAlert: () => void;
  form: TransactionFormValues;
  setForm: React.Dispatch<React.SetStateAction<TransactionFormValues>>;
  onSubmit: (event: React.FormEvent) => void;
  onNavigate: (tab: Tab) => void;
  transactionProps: TransactionBrowserProps;
}) {
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
      month < currentMonthKey
        ? days
        : month === currentMonthKey
          ? now.getDate()
          : 0;
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

  const percent = (value: number, total: number) =>
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const personalGroup = data?.groups.find((group) => group.name === "Personal");
  const householdGroup = data?.groups.find(
    (group) => group.name === "Household",
  );
  const groups = [
    {
      name: "Personal" as const,
      group: personalGroup,
      color: "var(--color-primary)",
      icon: <Wallet size={18} />,
    },
    {
      name: "Household" as const,
      group: householdGroup,
      color: "var(--color-accent)",
      icon: <ShoppingBasket size={18} />,
    },
  ];

  return (
    <>
      <section className="stats-grid">
        <Stat
          icon={<Wallet />}
          label="Spendable budget"
          value={formatMoney(data?.totals.budget ?? 0)}
          tone="violet"
        />
        <Stat
          icon={<CreditCard />}
          label="Spent this month"
          value={formatMoney(data?.totals.spent ?? 0)}
          tone="rose"
        />
        <Stat
          icon={<ArrowDownRight />}
          label="Left to spend"
          value={formatMoney(data?.totals.remaining ?? 0)}
          tone="green"
        />
        <Stat
          icon={<BarChart3 />}
          label="Daily pace"
          value={
            dailyPace.daysElapsed
              ? `${formatMoney(Math.abs(dailyPace.difference))}/day`
              : "—"
          }
          tone={dailyPace.difference >= 0 ? "green" : "rose"}
        />
      </section>

      {alertActive && !dismissedAlert && (
        <div className="notice alert-notice">
          <p>
            <strong>Budget alert</strong> One of your budget groups has used{" "}
            {alertThreshold}% or more of its allocation.
          </p>
          <button
            type="button"
            aria-label="Dismiss budget alert"
            onClick={onDismissAlert}
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="dashboard-grid">
        <article className="card pace-card">
          <div className="card-heading">
            <div>
              <h2>Spending pace</h2>
              <p>Actual spending compared with your ideal monthly pace</p>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chart}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="spendingFill" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="var(--color-primary)" stopOpacity={0.24} />
                    <stop
                      offset="1"
                      stopColor="var(--color-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-surface-muted)"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "var(--color-text-muted)",
                    fontSize: "var(--font-size-sm)",
                  }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    `${currency === "INR" ? "₹" : ""}${value}`
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "var(--color-text-muted)",
                    fontSize: "var(--font-size-sm)",
                  }}
                  width={60}
                />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Legend />
                <Area
                  type="monotone"
                  name="Actual cumulative"
                  dataKey="actual"
                  stroke="var(--color-primary)"
                  fill="url(#spendingFill)"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  name="Expected trend"
                  dataKey="expected"
                  stroke="var(--color-primary)"
                  strokeDasharray="6 4"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  name="Ideal pace"
                  dataKey="ideal"
                  stroke="var(--color-success)"
                  fill="none"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
        <TransactionForm
          categories={data?.categories ?? []}
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
        />
      </section>

      <section className="card group-card">
        <div className="card-heading">
          <div>
            <h2>Your budget split</h2>
            <p>Two groups, one monthly budget. Categories organize expenses.</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("Budget")}
            type="button"
          >
            Edit budget <span>→</span>
          </button>
        </div>
        <div className="group-grid">
          {groups.map(({ name, group, color, icon }) => (
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
          <div>
            <h2>Recent transactions</h2>
            <p>Search, filter, sort, and edit your expenses.</p>
          </div>
          <span className="count-pill">
            {transactionProps.total} transactions
          </span>
        </div>
        <TransactionBrowser {...transactionProps} />
      </section>
    </>
  );
}
