import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { transactionSchema } from "../src/validators/transaction.js";

const categoryId = "00000000-0000-4000-8000-000000000010";
const otherCategoryId = "00000000-0000-4000-8000-000000000011";
const input = (overrides = {}) => ({
  categoryId,
  description: "Lunch",
  amount: 12.25,
  transactionDate: "2026-11-19",
  ...overrides,
});

let pool;
let server;
let baseUrl;
let directory;
let started = false;
const pgBin =
  process.env.PG_BIN ??
  (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "");
const pgCommand = (name, args) =>
  execFileSync(pgBin ? path.join(pgBin, name) : name, args, {
    // PostgreSQL inherits Windows pipe handles, so pg_ctl must not capture them.
    stdio: name === "pg_ctl" ? "ignore" : "pipe",
    windowsHide: true,
    timeout: 20000,
  });

before(async () => {
  // A disposable cluster prevents tests from touching application databases.
  directory = mkdtempSync(path.join(os.tmpdir(), "pocketplan-test-"));
  const data = path.join(directory, "data");
  pgCommand("initdb", [
    "-D",
    data,
    "-U",
    "postgres",
    "-A",
    "trust",
    "--no-locale",
    "-E",
    "UTF8",
  ]);
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  pgCommand("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(directory, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;
  process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  ({ pool } = await import("../src/db.js"));
  await pool.query(
    readFileSync(new URL("../../database/init.sql", import.meta.url), "utf8"),
  );
  await pool.query(
    "INSERT INTO categories (id, name, group_name) VALUES ($1, 'Test food', 'Personal'), ($2, 'Test bills', 'Household')",
    [categoryId, otherCategoryId],
  );
  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (started)
    pgCommand("pg_ctl", [
      "-D",
      path.join(directory, "data"),
      "-m",
      "fast",
      "-w",
      "stop",
    ]);
  if (directory) rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await pool.query("TRUNCATE transactions");
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS transactions_category_date_uidx ON transactions(category_id, transaction_date)",
  );
});

async function post(transaction) {
  const response = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transaction),
  });
  return { status: response.status, body: await response.json() };
}

test("validation trims descriptions and defaults omitted descriptions", () => {
  assert.equal(
    transactionSchema.parse(input({ description: "  Lunch  " })).description,
    "Lunch",
  );
  assert.equal(
    transactionSchema.parse(input({ description: undefined })).description,
    "",
  );
});

test("same category and date retain one row, sum decimals and concatenate descriptions", async () => {
  const first = await post(input());
  const second = await post(input({ amount: 0.1, description: " Tea " }));
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.amount, "12.35");
  assert.equal(second.body.description, "Lunch, Tea");
  assert.equal((await pool.query("SELECT * FROM transactions")).rowCount, 1);
  const response = await fetch(`${baseUrl}/dashboard?month=2026-11`);
  assert.equal((await response.json()).totals.spent, 12.35);
});

test("empty descriptions do not introduce commas", async () => {
  await post(input({ description: undefined }));
  assert.equal((await post(input({ description: " " }))).body.description, "");
  assert.equal((await post(input())).body.description, "Lunch");
  assert.equal(
    (await post(input({ description: "" }))).body.description,
    "Lunch",
  );
});

test("different categories and dates stay separate", async () => {
  await post(input());
  await post(input({ categoryId: otherCategoryId }));
  await post(input({ transactionDate: "2026-11-20" }));
  assert.equal((await pool.query("SELECT * FROM transactions")).rowCount, 3);
});

test("simultaneous additions produce one row without lost amounts", async () => {
  const responses = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      post(input({ amount: 0.1, description: `Entry ${index}` })),
    ),
  );
  assert.ok(responses.every((response) => response.status === 201));
  const { rows } = await pool.query("SELECT * FROM transactions");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, "0.80");
  assert.deepEqual(
    rows[0].description.split(", ").sort(),
    Array.from({ length: 8 }, (_, index) => `Entry ${index}`),
  );
});

test("legacy duplicates consolidate in creation order when adding", async () => {
  // Exercise compatibility with an installation that has not applied V5 yet.
  await pool.query("DROP INDEX transactions_category_date_uidx");
  await pool.query(
    `INSERT INTO transactions (category_id, amount, description, transaction_date, created_at)
     VALUES ($1, 10, 'First', '2026-11-19', '2026-11-19T10:00:00Z'),
            ($1, 20, '', '2026-11-19', '2026-11-19T11:00:00Z'),
            ($1, 30, 'Third', '2026-11-19', '2026-11-19T12:00:00Z')`,
    [categoryId],
  );
  const result = await post(input({ amount: 5, description: "Last" }));
  assert.equal(result.body.amount, "65.00");
  assert.equal(result.body.description, "First, Third, Last");
  assert.equal((await pool.query("SELECT * FROM transactions")).rowCount, 1);
});

test("merged descriptions are preserved beyond the per-entry limit", async () => {
  await post(input({ description: "a".repeat(140) }));
  const result = await post(input({ description: "b".repeat(140) }));
  assert.equal(
    result.body.description,
    `${"a".repeat(140)}, ${"b".repeat(140)}`,
  );
  const response = await fetch(`${baseUrl}/transactions/${result.body.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      input({ description: result.body.description, amount: 30 }),
    ),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).description, result.body.description);
});

test("invalid inputs fail validation without modifying existing amounts", async () => {
  await post(input());
  for (const overrides of [
    { amount: 0 },
    { amount: -1 },
    { categoryId: "invalid" },
    { transactionDate: "2026-02-30" },
    { description: "x".repeat(141) },
  ]) {
    assert.equal((await post(input(overrides))).status, 400);
  }
  assert.equal(
    (await pool.query("SELECT amount FROM transactions")).rows[0].amount,
    "12.25",
  );
});

test("failed merge rolls back and subsequent additions still work", async () => {
  await post(input());
  assert.equal((await post(input({ amount: 9999999999.99 }))).status, 500);
  assert.equal(
    (await pool.query("SELECT amount FROM transactions")).rows[0].amount,
    "12.25",
  );
  assert.equal((await post(input({ amount: 1 }))).body.amount, "13.25");
});

test("unknown category fails without inserting a transaction", async () => {
  assert.equal(
    (await post(input({ categoryId: "00000000-0000-4000-8000-000000000099" })))
      .status,
    500,
  );
  assert.equal((await pool.query("SELECT * FROM transactions")).rowCount, 0);
});

const dailyMigration = readFileSync(
  new URL(
    "../../database/V5__daily_category_transactions.sql",
    import.meta.url,
  ),
  "utf8",
);

test("V5 consolidates historical rows, preserves totals and oldest identity, and is idempotent", async () => {
  await pool.query("DROP INDEX transactions_category_date_uidx");
  const original = await pool.query(
    `INSERT INTO transactions (category_id, amount, description, transaction_date, created_at)
     VALUES ($1, 10.10, ' First ', '2025-02-01', '2025-02-01T10:00:00Z'),
            ($1, 20.20, ' ', '2025-02-01', '2025-02-01T11:00:00Z'),
            ($1, 30.30, 'Third', '2025-02-01', '2025-02-01T12:00:00Z'),
            ($1, 2, '', '2025-02-02', '2025-02-02T10:00:00Z'),
            ($1, 3, '', '2025-02-02', '2025-02-02T11:00:00Z'),
            ($2, 7, 'Other category', '2025-02-01', '2025-02-01T10:00:00Z'),
            ($1, 8, 'Other month', '2025-03-01', '2025-03-01T10:00:00Z')
     RETURNING *`,
    [categoryId, otherCategoryId],
  );
  await pool.query(dailyMigration);
  const { rows } = await pool.query(
    "SELECT * FROM transactions ORDER BY transaction_date, category_id",
  );
  assert.equal(rows.length, 4);
  const retained = rows.find((row) => row.id === original.rows[0].id);
  assert.equal(retained.amount, "60.60");
  assert.equal(retained.description, "First, Third");
  assert.deepEqual(retained.created_at, original.rows[0].created_at);
  assert.equal(
    rows.find((row) => row.id === original.rows[3].id).description,
    "",
  );
  assert.equal(
    (await pool.query("SELECT SUM(amount)::text AS total FROM transactions"))
      .rows[0].total,
    "80.60",
  );
  await pool.query(dailyMigration);
  assert.deepEqual(
    (
      await pool.query(
        "SELECT * FROM transactions ORDER BY transaction_date, category_id",
      )
    ).rows,
    rows,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO transactions (category_id, amount, description, transaction_date) VALUES ($1, 1, '', '2025-02-01')",
      [categoryId],
    ),
    { code: "23505", constraint: "transactions_category_date_uidx" },
  );
});

test("V5 rolls back all consolidation on numeric overflow", async () => {
  const client = await pool.connect();
  try {
    await client.query("DROP INDEX transactions_category_date_uidx");
    await client.query(
      `INSERT INTO transactions (category_id, amount, description, transaction_date)
       VALUES ($1, 9999999999.99, 'First', '2025-01-01'),
              ($1, 1, 'Second', '2025-01-01')`,
      [categoryId],
    );
    const before = await client.query("SELECT * FROM transactions ORDER BY id");
    await assert.rejects(client.query(dailyMigration), { code: "22003" });
    await client.query("ROLLBACK");
    assert.deepEqual(
      (await client.query("SELECT * FROM transactions ORDER BY id")).rows,
      before.rows,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("editing into an occupied category and date returns a conflict without changing either row", async () => {
  const first = await post(input());
  const second = await post(input({ transactionDate: "2026-11-20" }));
  const response = await fetch(`${baseUrl}/transactions/${second.body.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input({ amount: 50 })),
  });
  assert.equal(response.status, 409);
  assert.match(
    (await response.json()).error,
    /already exists for this category and date/,
  );
  const { rows } = await pool.query(
    "SELECT id, amount FROM transactions ORDER BY id",
  );
  assert.equal(rows.length, 2);
  assert.ok(rows.some((row) => row.id === first.body.id));
  assert.ok(rows.every((row) => row.amount === "12.25"));
});
