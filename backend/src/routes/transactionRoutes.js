import { Router } from "express";
import { z } from "zod";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "../services/transactionService.js";
import { monthSchema } from "../validators/budget.js";
import {
  transactionQuerySchema,
  transactionSchema,
} from "../validators/transaction.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const month = monthSchema.parse(
      req.query.month || new Date().toISOString().slice(0, 7),
    );
    const filters = transactionQuerySchema.parse(req.query);
    res.json(await listTransactions(month, filters));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const transaction = transactionSchema.parse(req.body);
    res.status(201).json(await createTransaction(transaction));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const transaction = transactionSchema.parse(req.body);
    const updated = await updateTransaction(id, transaction);
    if (!updated)
      return res.status(404).json({ error: "Transaction not found." });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await deleteTransaction(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
