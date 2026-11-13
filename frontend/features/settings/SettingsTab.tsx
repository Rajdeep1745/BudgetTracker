"use client";

import { useState, type FormEvent } from "react";
import {
  BarChart3,
  CircleHelp,
  CreditCard,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { FixedCostType, GroupName } from "../../types";

export default function SettingsTab({
  currency,
  onCurrencyChange,
  alertThreshold,
  onAlertThresholdChange,
  categoryName,
  onCategoryNameChange,
  categoryGroup,
  onCategoryGroupChange,
  onAddCategory,
  fixedCostTypes,
  fixedCostName,
  onFixedCostNameChange,
  onAddFixedCost,
  onDeleteFixedCost,
  carryInEnabled,
  onCarryInEnabledChange,
  isSavingCarryIn,
}: {
  currency: string;
  onCurrencyChange: (value: string) => void;
  alertThreshold: number;
  onAlertThresholdChange: (value: number) => void;
  categoryName: string;
  onCategoryNameChange: (value: string) => void;
  categoryGroup: GroupName;
  onCategoryGroupChange: (value: GroupName) => void;
  onAddCategory: (event: FormEvent<HTMLFormElement>) => void;
  fixedCostTypes: FixedCostType[];
  fixedCostName: string;
  onFixedCostNameChange: (value: string) => void;
  onAddFixedCost: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteFixedCost: (id: string) => Promise<boolean>;
  carryInEnabled: boolean;
  onCarryInEnabledChange: (enabled: boolean) => void;
  isSavingCarryIn: boolean;
}) {
  const [pendingDelete, setPendingDelete] = useState<FixedCostType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      if (await onDeleteFixedCost(pendingDelete.id)) setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="settings-list">
      <article className="card setting-row">
        <div className="setting-icon">
          <CreditCard size={19} />
        </div>
        <div className="setting-copy">
          <h2>Currency</h2>
          <p>Choose how amounts are displayed across the app.</p>
        </div>
        <select
          className="setting-control"
          aria-label="Currency"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value)}
        >
          <option value="INR">Indian Rupee (₹)</option>
          <option value="USD">US Dollar ($)</option>
          <option value="EUR">Euro (€)</option>
          <option value="GBP">British Pound (£)</option>
        </select>
      </article>

      <article className="card setting-row">
        <div className="setting-icon amber-setting">
          <BarChart3 size={19} />
        </div>
        <div className="setting-copy">
          <h2>Budget alert</h2>
          <p>
            Show a dashboard alert when a group reaches this share of its
            allocation.
          </p>
        </div>
        <label className="threshold-control">
          <input
            aria-label="Budget alert threshold percentage"
            type="number"
            min="1"
            max="100"
            value={alertThreshold}
            onChange={(event) =>
              onAlertThresholdChange(
                Math.max(1, Math.min(100, Number(event.target.value) || 1)),
              )
            }
          />
          <span>%</span>
        </label>
      </article>

      <article className="card setting-row carry-in-setting">
        <div className="setting-icon">
          <Wallet size={19} />
        </div>
        <div className="setting-copy">
          <h2>Carry in</h2>
          <p>
            Include a carry-in amount in the monthly allowance. Turning this
            off preserves saved amounts but excludes them from this month
            onward.
          </p>
        </div>
        <label className="setting-toggle">
          <input
            aria-label="Enable carry in"
            checked={carryInEnabled}
            disabled={isSavingCarryIn}
            onChange={(event) =>
              onCarryInEnabledChange(event.target.checked)
            }
            type="checkbox"
          />
          <span aria-hidden="true" />
        </label>
      </article>

      <section className="card fixed-cost-settings">
        <div className="card-heading">
          <div>
            <h2>Fixed costs</h2>
            <p>
              Add costs that are deducted from the monthly allowance. Changes
              apply from this month forward; past months stay unchanged.
            </p>
          </div>
        </div>
        <form className="fixed-cost-form" onSubmit={onAddFixedCost}>
          <label>
            <span className="input-label">Fixed cost name</span>
            <input
              required
              maxLength={60}
              value={fixedCostName}
              onChange={(event) => onFixedCostNameChange(event.target.value)}
              placeholder="e.g. Internet"
            />
          </label>
          <button className="primary-button" type="submit">
            <Plus size={17} /> Add fixed cost
          </button>
        </form>
        <ul className="fixed-cost-list">
          {fixedCostTypes.map((fixedCost) => (
            <li className="fixed-cost-row" key={fixedCost.id}>
              <span>{fixedCost.name}</span>
              <button
                aria-label={`Delete ${fixedCost.name}`}
                className="fixed-cost-delete"
                onClick={() => setPendingDelete(fixedCost)}
                type="button"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
          {fixedCostTypes.length === 0 && (
            <li className="fixed-cost-empty">No fixed costs have been added.</li>
          )}
        </ul>
      </section>

      <form className="card category-editor" onSubmit={onAddCategory}>
        <div className="card-heading">
          <div>
            <h2>Categories</h2>
            <p>Add a category for organizing transactions.</p>
          </div>
        </div>
        <div className="category-editor-fields">
          <label>
            <span className="input-label">Category name</span>
            <input
              required
              maxLength={60}
              value={categoryName}
              onChange={(event) => onCategoryNameChange(event.target.value)}
              placeholder="e.g. Pet care"
            />
          </label>
          <label>
            <span className="input-label">Budget allocation</span>
            <select
              value={categoryGroup}
              onChange={(event) =>
                onCategoryGroupChange(event.target.value as GroupName)
              }
            >
              <option value="Personal">Personal</option>
              <option value="Grocery">Grocery</option>
            </select>
          </label>
          <button className="primary-button" type="submit">
            <Plus size={17} /> Add category
          </button>
        </div>
      </form>

      <article className="card settings-info">
        <span className="settings-info-icon">
          <CircleHelp size={19} />
        </span>
        <div>
          <h2>About your budget</h2>
          <p>
            Fixed costs are deducted before Personal and Grocery allocations.
            Carry in is added only when enabled. Categories organize
            transactions and reports; they do not have individual budget limits.
          </p>
        </div>
      </article>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          message="This removes the cost and its saved amounts from this month onward. Past months keep their saved names and amounts."
          confirmLabel="Delete fixed cost"
          isBusy={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}
