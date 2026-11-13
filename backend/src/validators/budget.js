import { z } from "zod";

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const budgetSchema = z.object({
  month: monthSchema,
  allowance: z.coerce.number().finite().min(0),
  personalPercent: z.coerce.number().finite().min(0).max(100),
  rent: z.coerce.number().finite().min(0),
  didiFees: z.coerce.number().finite().min(0),
  carryIn: z.coerce.number().finite(),
  alreadySaved: z.coerce.number().finite().min(0),
  savingsTarget: z.coerce.number().finite().min(0),
});
