"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Filter,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import { formatTransactionDate } from "../../lib/format";
import { openPickerFromLabel } from "../../lib/openPickerFromLabel";
import type {
  Transaction,
  TransactionBrowserProps,
  TransactionInput,
  TransactionSort,
} from "../../types";

export default function TransactionBrowser({
  transactions,
  categories,
  filters,
  onApplyFilters,
  sort,
  onSort,
  page,
  total,
  onPageChange,
  onDelete,
  onEdit,
  formatMoney,
}: TransactionBrowserProps) {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => setDraftFilters(filters), [filters]);

  const updateDraftFilter = (key: keyof typeof draftFilters, value: string) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <div className="transaction-filters">
        <label className="transaction-search">
          <Search size={18} />
          <input
            aria-label="Search transactions"
            placeholder="Search category, description, date, amount..."
            value={draftFilters.search}
            onChange={(event) =>
              updateDraftFilter("search", event.target.value)
            }
          />
        </label>
        <select
          aria-label="Filter by category"
          value={draftFilters.categoryId}
          onChange={(event) =>
            updateDraftFilter("categoryId", event.target.value)
          }
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <label
          className="transaction-filter-field"
          onClick={openPickerFromLabel}
        >
          <span>From</span>
          <input
            aria-label="Start date"
            type="date"
            value={draftFilters.from}
            onChange={(event) => updateDraftFilter("from", event.target.value)}
          />
        </label>
        <label
          className="transaction-filter-field"
          onClick={openPickerFromLabel}
        >
          <span>To</span>
          <input
            aria-label="End date"
            type="date"
            value={draftFilters.to}
            onChange={(event) => updateDraftFilter("to", event.target.value)}
          />
        </label>
        <button
          className="primary-button apply-filters-button"
          onClick={() => onApplyFilters(draftFilters)}
          type="button"
        >
          <Filter size={18} />
          Apply filters
        </button>
      </div>
      <TransactionTable
        transactions={transactions}
        categories={categories}
        sort={sort}
        onSort={onSort}
        onDelete={onDelete}
        onEdit={onEdit}
        formatMoney={formatMoney}
      />
      <div className="transaction-pagination">
        <span>
          Showing {start}–{end} of {total}
        </span>
        <div>
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

function TransactionTable({
  transactions,
  categories,
  sort,
  onSort,
  onDelete,
  onEdit,
  formatMoney,
}: Pick<
  TransactionBrowserProps,
  | "transactions"
  | "categories"
  | "sort"
  | "onSort"
  | "onDelete"
  | "onEdit"
  | "formatMoney"
>) {
  const [editingId, setEditingId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draft, setDraft] = useState<TransactionInput>({
    categoryId: "",
    description: "",
    amount: 0,
    transactionDate: "",
  });

  if (!transactions.length)
    return <EmptyState text="No transactions match these filters." />;

  const sortButton = (label: string, key: TransactionSort["sortBy"]) => (
    <button className="sort-button" type="button" onClick={() => onSort(key)}>
      {label}
      {sort.sortBy === key ? (sort.sortDirection === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  const startEditing = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setDraft({
      categoryId: transaction.category_id,
      description: transaction.description,
      amount: Number(transaction.amount),
      transactionDate: transaction.transaction_date.slice(0, 10),
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete transaction?"
          message={`Delete "${pendingDelete.description || pendingDelete.category_name}"? This action cannot be undone.`}
          confirmLabel="Delete transaction"
          isBusy={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      <div className="table-scroll">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>{sortButton("Date", "date")}</th>
              <th>{sortButton("Category", "category")}</th>
              <th>{sortButton("Description", "description")}</th>
              <th className="amount-cell">{sortButton("Amount", "amount")}</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                {editingId === transaction.id ? (
                  <>
                    <td>
                      <input
                        className="table-edit-input"
                        aria-label="Transaction date"
                        type="date"
                        value={draft.transactionDate}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            transactionDate: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="table-edit-input"
                        aria-label="Transaction category"
                        value={draft.categoryId}
                        onChange={(event) =>
                          setDraft({ ...draft, categoryId: event.target.value })
                        }
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="table-edit-input"
                        aria-label="Transaction description"
                        maxLength={140}
                        value={draft.description}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            description: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-edit-input amount-edit-input"
                        aria-label="Transaction amount"
                        required
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={draft.amount}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            amount: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="delete-cell row-actions">
                      <button
                        type="button"
                        aria-label="Save transaction"
                        onClick={async () => {
                          if (await onEdit(transaction.id, draft))
                            setEditingId("");
                        }}
                      >
                        <Save size={19} />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel editing"
                        onClick={() => setEditingId("")}
                      >
                        <X size={19} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="date-cell">
                      {formatTransactionDate(transaction.transaction_date)}
                    </td>
                    <td>
                      <span className="category-tag">
                        <i style={{ backgroundColor: transaction.color }} />
                        {transaction.category_name}
                      </span>
                    </td>
                    <td className="description-cell">
                      {transaction.description || "—"}
                    </td>
                    <td className="amount-cell">
                      {formatMoney(Number(transaction.amount))}
                    </td>
                    <td className="delete-cell row-actions">
                      <button
                        type="button"
                        aria-label={`Edit ${transaction.description || transaction.category_name}`}
                        onClick={() => startEditing(transaction)}
                      >
                        <Edit2 size={19} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${transaction.description || transaction.category_name}`}
                        onClick={() => setPendingDelete(transaction)}
                      >
                        <Trash2 size={19} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
