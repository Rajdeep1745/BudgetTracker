import { Router } from "express";
import { getDashboard } from "../services/dashboardService.js";
import { monthSchema } from "../validators/budget.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const month = monthSchema.parse(
      req.query.month || new Date().toISOString().slice(0, 7),
    );
    res.json(await getDashboard(month));
  } catch (error) {
    next(error);
  }
});

export default router;
