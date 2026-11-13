"use client";

import { BarChart3, CircleHelp, CreditCard, Plus } from "lucide-react";
import type { FormEvent } from "react";
import type { GroupName } from "../../types";

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
}: {
  currency: string;
  onCurrencyChange: (value: string) => void;
  alertThreshold: number;
  onAlertThresholdChange: (value: number) => void;
  categoryName: string;
  onCategoryNameChange: (value: string) => void;
  categoryGroup: GroupName;
  onCategoryGroupChange: (value: GroupName) => void;
  onAddCategory: (event: FormEvent) => void;
}) {
  return (
    <section className="settings-list">
      <article className="card setting-row">
        <div className="setting-icon"><CreditCard size={19} /></div>
        <div className="setting-copy"><h2>Currency</h2><p>Choose how amounts are displayed across the app.</p></div>
        <select className="setting-control" aria-label="Currency" value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
          <option value="INR">Indian Rupee (₹)</option>
          <option value="USD">US Dollar ($)</option>
          <option value="EUR">Euro (€)</option>
          <option value="GBP">British Pound (£)</option>
        </select>
      </article>
      <article className="card setting-row">
        <div className="setting-icon amber-setting"><BarChart3 size={19} /></div>
        <div className="setting-copy"><h2>Budget alert</h2><p>Show a dashboard alert when a group reaches this share of its allocation.</p></div>
        <label className="threshold-control">
          <input aria-label="Budget alert threshold percentage" type="number" min="1" max="100" value={alertThreshold} onChange={(event) => onAlertThresholdChange(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} />
          <span>%</span>
        </label>
      </article>
      <form className="card category-editor" onSubmit={onAddCategory}>
        <div className="card-heading">
          <div><h2>Categories</h2><p>Add a category for organizing transactions.</p></div>
        </div>
        <div className="category-editor-fields">
          <label>
            <span className="input-label">Category name</span>
            <input required maxLength={60} value={categoryName} onChange={(event) => onCategoryNameChange(event.target.value)} placeholder="e.g. Pet care" />
          </label>
          <label>
            <span className="input-label">Budget allocation</span>
            <select value={categoryGroup} onChange={(event) => onCategoryGroupChange(event.target.value as GroupName)}>
              <option value="Personal">Personal</option>
              <option value="Grocery">Grocery</option>
            </select>
          </label>
          <button className="primary-button" type="submit"><Plus size={17} /> Add category</button>
        </div>
      </form>
      <article className="card settings-info">
        <span className="settings-info-icon"><CircleHelp size={19} /></span>
        <div><h2>About your budget</h2><p>Your monthly total is divided between Personal and Grocery. Categories only organize transactions and reports; they do not have individual budget limits.</p></div>
      </article>
    </section>
  );
}
