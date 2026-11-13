import { z } from "zod";

export const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().trim().max(140).optional().default(""),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().date(),
});

export const transactionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z
      .enum(["date", "category", "description", "amount"])
      .default("date"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().max(140).default(""),
    categoryId: z.string().uuid().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be on or before to",
  });
