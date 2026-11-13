"use client";

import { useMemo } from "react";
import { ArrowDownRight, BarChart3, CreditCard, Wallet } from "lucide-react";
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
import EmptyState from "../../components/EmptyState";
import Stat from "../../components/Stat";
import TransactionBrowser from "../transactions/TransactionBrowser";
import type { DashboardData, TransactionBrowserProps } from "../../types";
import { monthLabel } from "../../lib/format";

export default function ReportsTab({
  data,
  month,
  currency,
  selectedDay,
  onSelectDay,
  transactionCount,
  transactionProps,
  formatMoney,
}: {
  data?: DashboardData;
  month: string;
  currency: string;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  transactionCount: number;
  transactionProps: TransactionBrowserProps;
  formatMoney: (value: number) => string;
}) {
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const reportThroughDay = Math.min(Math.max(selectedDay, 1), daysInMonth);
  const percent = (value: number, total: number) =>
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const topCategories = [...(data?.categories ?? [])]
    .filter((category) => category.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const topCategoriesByGroup = (["Personal", "Grocery"] as const).map(
    (name) => ({
      name,
      categories: topCategories
        .filter((category) => category.group_name === name)
        .slice(0, 5),
    }),
  );

  const cumulativeByGroup = useMemo(
    () =>
      (["Personal", "Grocery"] as const).map((name) => {
        const group = data?.groups.find((entry) => entry.name === name);
        const entries = (data?.groupDaily ?? []).filter(
          (entry) => entry.group_name === name,
        );
        const spent = entries
          .filter(
            (entry) => Number(entry.date.slice(8, 10)) <= reportThroughDay,
          )
          .reduce((sum, entry) => sum + Number(entry.amount), 0);
        const spentOnDay = entries
          .filter(
            (entry) => Number(entry.date.slice(8, 10)) === reportThroughDay,
          )
          .reduce((sum, entry) => sum + Number(entry.amount), 0);
        const remaining = Math.max((group?.budget ?? 0) - spent, 0);
        const daysRemaining = Math.max(daysInMonth - reportThroughDay, 0);
        return {
          name,
          budget: group?.budget ?? 0,
          spentOnDay,
          remaining,
          daysRemaining,
          dailyAllowed: daysRemaining > 0 ? remaining / daysRemaining : 0,
        };
      }),
    [data, reportThroughDay, daysInMonth],
  );

  const groupPaceCharts = useMemo(
    () =>
      (["Personal", "Grocery"] as const).map((name) => {
        const group = data?.groups.find((entry) => entry.name === name);
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const daysElapsed =
          month < currentMonthKey
            ? daysInMonth
            : month === currentMonthKey
              ? now.getDate()
              : 0;
        const dailyAmounts = new Map(
          (data?.groupDaily ?? [])
            .filter((entry) => entry.group_name === name)
            .map((entry) => [
              Number(entry.date.slice(8, 10)),
              Number(entry.amount),
            ]),
        );
        const spentToDate = [...dailyAmounts.entries()]
          .filter(([day]) => day <= daysElapsed)
          .reduce((sum, [, amount]) => sum + amount, 0);
        const averageDailySpend =
          daysElapsed > 0 ? spentToDate / daysElapsed : 0;
        let running = 0;
        const chartData = Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          running += dailyAmounts.get(day) ?? 0;
          return {
            day,
            actual: day <= daysElapsed ? running : null,
            expected:
              daysElapsed > 0 && day >= daysElapsed
                ? spentToDate + averageDailySpend * (day - daysElapsed)
                : null,
            ideal: ((group?.budget ?? 0) * day) / daysInMonth,
          };
        });
        return { name, chartData };
      }),
    [data, daysInMonth, month],
  );

  return (
    <>
      <section className="stats-grid report-stats">
        <Stat
          icon={<Wallet />}
          label="Allocated budget"
          value={formatMoney(data?.totals.budget ?? 0)}
          tone="violet"
        />
        <Stat
          icon={<CreditCard />}
          label="Total spent"
          value={formatMoney(data?.totals.spent ?? 0)}
          tone="rose"
        />
        <Stat
          icon={<ArrowDownRight />}
          label="Budget remaining"
          value={formatMoney(data?.totals.remaining ?? 0)}
          tone="green"
        />
        <Stat
          icon={<BarChart3 />}
          label="Transactions"
          value={String(transactionCount)}
          tone="amber"
        />
      </section>

      <section className="card cumulative-report">
        <div className="card-heading">
          <div>
            <h2>Spending on a selected day</h2>
            <p>See the total amount spent on one specific day.</p>
          </div>
          <label className="report-day-picker">
            Day
            <select
              aria-label="Selected spending day"
              value={reportThroughDay}
              onChange={(event) => onSelectDay(Number(event.target.value))}
            >
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
                (day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div className="cumulative-cards">
          {cumulativeByGroup.map((group) => (
            <article
              className={`cumulative-tile ${group.name.toLowerCase()}`}
              key={group.name}
            >
              <span>
                {group.name} spent on day {reportThroughDay}
              </span>
              <strong>{formatMoney(group.spentOnDay)}</strong>
              <small>of {formatMoney(group.budget)} allocation</small>
            </article>
          ))}
          <article className="cumulative-tile total-cumulative">
            <span>Total spent on day {reportThroughDay}</span>
            <strong>
              {formatMoney(
                cumulativeByGroup.reduce(
                  (sum, group) => sum + group.spentOnDay,
                  0,
                ),
              )}
            </strong>
            <small>{monthLabel(month)}</small>
          </article>
        </div>
      </section>

      <section className="report-grid group-report-grid">
        {groupPaceCharts.map(({ name, chartData }) => {
          const color =
            name === "Personal"
              ? "var(--color-primary)"
              : "var(--color-accent)";
          return (
            <article className="card report-chart-card" key={name}>
              <div className="card-heading">
                <div>
                  <h2>{name} spending &amp; pace</h2>
                  <p>
                    Actual cumulative spend and expected trend through month end
                  </p>
                </div>
              </div>
              <div className="chart-wrap report-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`${name.toLowerCase()}ReportFill`}
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop stopColor={color} stopOpacity={0.24} />
                        <stop offset="1" stopColor={color} stopOpacity={0} />
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
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value))}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      name="Actual cumulative"
                      dataKey="actual"
                      stroke={color}
                      fill={`url(#${name.toLowerCase()}ReportFill)`}
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      name="Expected trend"
                      dataKey="expected"
                      stroke={color}
                      strokeDasharray="6 4"
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      name="Ideal pace"
                      dataKey="ideal"
                      stroke="var(--color-text-muted)"
                      fill="none"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </article>
          );
        })}
      </section>

      <section className="card daily-allowance-report">
        <div className="card-heading">
          <div>
            <h2>Daily allowed spend from tomorrow</h2>
            <p>
              Remaining group budget divided evenly across the days after day{" "}
              {reportThroughDay}. Negative balances show as zero.
            </p>
          </div>
        </div>
        <div className="daily-allowance-grid">
          {cumulativeByGroup.map((group) => (
            <article
              className={`daily-allowance-tile ${group.name.toLowerCase()}`}
              key={group.name}
            >
              <span>{group.name}</span>
              <strong>
                {formatMoney(group.dailyAllowed)}
                <small> / day</small>
              </strong>
              <p>
                {formatMoney(group.remaining)} remaining across{" "}
                {group.daysRemaining} days
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="report-grid top-spends-grid">
        {topCategoriesByGroup.map(({ name, categories }) => (
          <article className="card transactions-card category-report" key={name}>
            <div className="card-heading">
              <div>
                <h2>Top 5 {name} expense categories</h2>
                <p>Monthly cumulative totals for {monthLabel(month)}</p>
              </div>
            </div>
            {categories.length ? (
              <div className={`top-spends-list ${name.toLowerCase()}`}>
                {categories.map((category, index) => (
                  <div className="top-spend-row" key={category.id}>
                    <span className="top-spend-rank">{index + 1}</span>
                    <span className="top-spend-copy">
                      <strong>{category.name}</strong>
                    </span>
                    <strong className="top-spend-amount">
                      {formatMoney(category.spent)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                text={`No ${name.toLowerCase()} category spending this month.`}
              />
            )}
          </article>
        ))}
      </section>

      <section className="card transactions-card category-report">
        <div className="card-heading">
          <div>
            <h2>Spending by category</h2>
            <p>Monthly cumulative totals</p>
          </div>
        </div>
        {topCategories.length ? (
          <div className="category-list">
            {topCategories.map((category) => {
              const share = percent(category.spent, data?.totals.spent ?? 0);
              return (
                <div className="category-row" key={category.id}>
                  <span
                    className="category-color"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="category-name">
                    <strong>{category.name}</strong>
                  </div>
                  <div className="category-share-track">
                    <span
                      style={{
                        width: `${share}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                  <strong className="category-amount">
                    {formatMoney(category.spent)}
                  </strong>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="No category spending to report for this month yet." />
        )}
      </section>

      <section className="card transactions-card">
        <div className="card-heading">
          <div>
            <h2>All transactions</h2>
            <p>{monthLabel(month)}</p>
          </div>
          <span className="count-pill">{transactionCount} transactions</span>
        </div>
        <TransactionBrowser {...transactionProps} />
      </section>
    </>
  );
}
