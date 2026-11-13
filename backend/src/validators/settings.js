import { z } from "zod";
import { monthSchema } from "./budget.js";

export const fixedCostSchema = z.object({
  name: z.string().trim().min(1).max(60),
  effectiveMonth: monthSchema,
});

export const carryInSettingSchema = z.object({
  enabled: z.boolean(),
  effectiveMonth: monthSchema,
});
