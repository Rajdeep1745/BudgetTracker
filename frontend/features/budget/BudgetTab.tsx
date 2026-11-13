"use client";

import { type FormEvent } from "react";
import { Check, ShoppingBasket, Wallet } from "lucide-react";
import GroupCard from "../../components/GroupCard";
import MoneyField from "../../components/MoneyField";
import SplitPreview from "../../components/SplitPreview";
import type {
  BudgetFixedCostInput,
  BudgetGroup,
  GroupName,
} from "../../types";
import { monthLabel } from "../../lib/format";

export default function BudgetTab({
  month,
  currency,
  allowanceInput,
  setAllowanceInput,
  fixedCosts,
  onFixedCostChange,
  carryInInput,
  setCarryInInput,
  carryInEnabled,
  alreadySavedInput,
  setAlreadySavedInput,
  savingsTargetInput,
  setSavingsTargetInput,
  personalPercent,
  setPersonalPercent,
  groups,
  formatMoney,
  onSave,
}: {
  month: string;
  currency: string;
  allowanceInput: string;
  setAllowanceInput: (value: string) => void;
  fixedCosts: BudgetFixedCostInput[];
  onFixedCostChange: (id: string, value: string) => void;
  carryInInput: string;
  setCarryInInput: (value: string) => void;
  carryInEnabled: boolean;
  alreadySavedInput: string;
  setAlreadySavedInput: (value: string) => void;
  savingsTargetInput: string;
  setSavingsTargetInput: (value: string) => void;
  personalPercent: number;
  setPersonalPercent: (value: number) => void;
  groups: BudgetGroup[];
  formatMoney: (value: number) => string;
  onSave: (event: FormEvent) => void;
}) {
  const fixedCostTotal = fixedCosts.reduce(
    (total, cost) => total + (Number(cost.amount) || 0),
    0,
  );
  const effectiveAllowance =
    (Number(allowanceInput) || 0) -
    fixedCostTotal +
    (carryInEnabled ? Number(carryInInput) || 0 : 0);
  const spendableBudget =
    effectiveAllowance - (Number(savingsTargetInput) || 0);
  const percent = (value: number, total: number) =>
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const groupFor = (name: GroupName) =>
    groups.find((group) => group.name === name);
  const groupCards = [
    { name: "Personal" as const, color: "var(--color-primary)" },
    { name: "Household" as const, color: "var(--color-accent)" },
  ];

  return (
    <>
      <form className="card budget-editor" onSubmit={onSave}>
        <div className="budget-form-heading">
          <span className="large-icon violet">
            <Wallet size={21} />
          </span>
          <div>
            <h2>Monthly budget</h2>
            <p>This budget applies to {monthLabel(month)}.</p>
          </div>
        </div>
        <div className="budget-edit-grid">
          <div className="budget-primary-fields">
            <label className="input-label" htmlFor="total-budget">
              Monthly allowance
            </label>
            <div className="money-input">
              <span>{currency === "INR" ? "₹" : currency}</span>
              <input
                id="total-budget"
                required
                min="0"
                step="0.01"
                type="number"
                value={allowanceInput}
                onChange={(event) => setAllowanceInput(event.target.value)}
                placeholder="Enter your monthly allowance"
              />
            </div>

            <section
              className="fixed-cost-input-section"
              aria-labelledby="fixed-cost-input-heading"
            >
              <div className="fixed-cost-input-heading">
                <h3 id="fixed-cost-input-heading">Fixed costs</h3>
                <p>Deducted from your monthly allowance.</p>
              </div>
              {fixedCosts.length > 0 ? (
                <div className="budget-input-grid fixed-cost-input-grid">
                  {fixedCosts.map((cost) => (
                    <MoneyField
                      key={cost.id}
                      id={`fixed-cost-${cost.id}`}
                      label={cost.name}
                      value={cost.amount}
                      onChange={(value) => onFixedCostChange(cost.id, value)}
                      currency={currency}
                    />
                  ))}
                </div>
              ) : (
                <p className="fixed-cost-empty">
                  Add fixed costs in Settings to deduct them from your budget.
                </p>
              )}
            </section>

            {carryInEnabled && (
              <div className="carry-in-input">
                <MoneyField
                  id="carry-in"
                  label="Carry in"
                  value={carryInInput}
                  onChange={setCarryInInput}
                  currency={currency}
                  allowNegative
                />
              </div>
            )}

            <section className="savings-panel" aria-labelledby="savings-heading">
              <div className="savings-heading">
                <span className="large-icon green-icon">
                  <Wallet size={20} />
                </span>
                <div>
                  <h2 id="savings-heading">Savings</h2>
                  <p>Your existing savings and this month’s savings goal.</p>
                </div>
              </div>
              <div className="budget-input-grid savings-inputs">
                <MoneyField
                  id="already-saved"
                  label="Total saved so far"
                  value={alreadySavedInput}
                  onChange={setAlreadySavedInput}
                  currency={currency}
                />
                <MoneyField
                  id="monthly-savings"
                  label="Save this month"
                  value={savingsTargetInput}
                  onChange={setSavingsTargetInput}
                  currency={currency}
                />
              </div>
            </section>
          </div>

          <div className="budget-allocation-panel">
            <div className="calculation-summary">
              <div>
                <span>Effective allowance</span>
                <strong>{formatMoney(effectiveAllowance)}</strong>
                <small>
                  Allowance − fixed costs
                  {carryInEnabled ? " + carry in" : ""}
                </small>
              </div>
              <div className="spendable-summary">
                <span>Spendable budget</span>
                <strong>{formatMoney(spendableBudget)}</strong>
                <small>Effective allowance − savings goal</small>
              </div>
            </div>
            <div className="split-heading">
              <div>
                <h3>Allocate spendable budget</h3>
                <p>Percentages apply after fixed costs and savings.</p>
              </div>
              <span className="total-badge">100% total</span>
            </div>
            <label className="range-label" htmlFor="personal-percent">
              <span>
                <i className="dot purple-dot" />
                Personal
              </span>
              <strong>{personalPercent}%</strong>
            </label>
            <input
              id="personal-percent"
              className="split-range personal-range"
              type="range"
              min="0"
              max="100"
              value={personalPercent}
              onChange={(event) =>
                setPersonalPercent(Number(event.target.value))
              }
            />
            <div className="split-preview">
              <SplitPreview
                name="Personal"
                percent={personalPercent}
                amount={(Math.max(spendableBudget, 0) * personalPercent) / 100}
                color="var(--color-primary)"
                formatMoney={formatMoney}
              />
              <SplitPreview
                name="Household"
                percent={100 - personalPercent}
                amount={
                  (Math.max(spendableBudget, 0) * (100 - personalPercent)) / 100
                }
                color="var(--color-accent)"
                formatMoney={formatMoney}
              />
            </div>
            <div
              className="split-bar"
              aria-label={`${personalPercent}% Personal, ${100 - personalPercent}% Household`}
            >
              <span
                style={{
                  width: `${personalPercent}%`,
                  background: "var(--color-primary)",
                }}
              />
              <span
                style={{
                  width: `${100 - personalPercent}%`,
                  background: "var(--color-accent)",
                }}
              />
            </div>
            <button className="primary-button save-budget-button" type="submit">
              <Check size={17} /> Save budget
            </button>
          </div>
        </div>
      </form>

      <section className="card group-card budget-groups">
        <div className="card-heading">
          <div>
            <h2>Group overview</h2>
            <p>Spending within each part of your overall budget</p>
          </div>
        </div>
        <div className="group-grid">
          {groupCards.map(({ name, color }) => (
            <GroupCard
              key={name}
              name={name}
              group={groupFor(name)}
              color={color}
              icon={
                name === "Personal" ? (
                  <Wallet size={18} />
                ) : (
                  <ShoppingBasket size={18} />
                )
              }
              formatMoney={formatMoney}
              percent={percent}
            />
          ))}
        </div>
      </section>
      <p className="helper-note">
        Categories organize transactions and reports; they do not have
        individual budgets.
      </p>
    </>
  );
}
