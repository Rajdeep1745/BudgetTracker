import { Router } from "express";
import { z } from "zod";
import {
  createFixedCost,
  deleteFixedCost,
  getSettings,
  setCarryInEnabled,
} from "../services/settingsService.js";
import { monthSchema } from "../validators/budget.js";
import {
  carryInSettingSchema,
  fixedCostSchema,
} from "../validators/settings.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const month = monthSchema.parse(
      req.query.month || new Date().toISOString().slice(0, 7),
    );
    res.json(await getSettings(month));
  } catch (error) {
    next(error);
  }
});

router.post("/fixed-costs", async (req, res, next) => {
  try {
    const fixedCost = fixedCostSchema.parse(req.body);
    res.status(201).json(await createFixedCost(fixedCost));
  } catch (error) {
    next(error);
  }
});

router.delete("/fixed-costs/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const month = monthSchema.parse(req.query.month);
    const fixedCost = await deleteFixedCost(id, month);
    if (!fixedCost)
      return res.status(404).json({ error: "Fixed cost not found." });
    res.json(fixedCost);
  } catch (error) {
    next(error);
  }
});

router.put("/carry-in", async (req, res, next) => {
  try {
    const setting = carryInSettingSchema.parse(req.body);
    res.json(
      await setCarryInEnabled(setting.enabled, setting.effectiveMonth),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
