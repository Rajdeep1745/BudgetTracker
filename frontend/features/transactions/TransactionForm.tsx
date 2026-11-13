"use client";

import { type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { TransactionFormProps } from "../../types";

export default function TransactionForm({
  categories,
  form,
  setForm,
  onSubmit,
}: TransactionFormProps) {
  return (
    <form className="card add-transaction" onSubmit={onSubmit}>
      <div className="card-heading add-heading">
        <span className="add-icon"><Plus size={24} /></span>
        <div>
          <h2>Add transaction</h2>
          <p>Record an expense in your monthly budget.</p>
        </div>
      </div>
      <label className="input-label" htmlFor="transaction-category">Category</label>
      <select
        id="transaction-category"
        required
        value={form.categoryId}
        onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
      <label className="input-label" htmlFor="transaction-description">Description</label>
      <input
        id="transaction-description"
        maxLength={140}
        placeholder="Optional"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
      <div className="form-two-col">
        <div>
          <label className="input-label" htmlFor="transaction-amount">Amount</label>
          <input
            id="transaction-amount"
            required
            min="0.01"
            step="0.01"
            type="number"
            placeholder="0.00"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
        </div>
        <div>
          <label className="input-label" htmlFor="transaction-date">Date</label>
          <input
            id="transaction-date"
            required
            type="date"
            value={form.transactionDate}
            onChange={(event) =>
              setForm({ ...form, transactionDate: event.target.value })
            }
          />
        </div>
      </div>
      <button className="primary-button" type="submit"><Plus size={20} /> Add expense</button>
    </form>
  );
}
