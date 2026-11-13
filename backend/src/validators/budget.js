import { z } from "zod";

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const budgetSchema = z.object({
  month: monthSchema,
  allowance: z.coerce.number().finite().min(0),
  personalPercent: z.coerce.number().finite().min(0).max(100),
  carryIn: z.coerce.number().finite(),
  carryInEnabled: z.boolean(),
  alreadySaved: z.coerce.number().finite().min(0),
  savingsTarget: z.coerce.number().finite().min(0),
  fixedCosts: z
    .array(
      z.object({
        id: z.string().uuid(),
        amount: z.coerce.number().finite().min(0),
      }),
    )
    .superRefine((costs, context) => {
      const ids = new Set();
      for (const [index, cost] of costs.entries()) {
        if (ids.has(cost.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A fixed cost can only appear once.",
            path: [index, "id"],
          });
        }
        ids.add(cost.id);
      }
    }),
});
