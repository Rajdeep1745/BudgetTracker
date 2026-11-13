import { Router } from "express";
import { saveBudget } from "../services/budgetService.js";
import { budgetSchema } from "../validators/budget.js";

const router = Router();

router.put("/", async (req, res, next) => {
  try {
    const budget = budgetSchema.parse(req.body);
    res.json(await saveBudget(budget));
  } catch (error) {
    next(error);
  }
});

export default router;
