import { ZodError } from "zod";

export function errorHandler(error, _, res, __) {
  console.error(error);
  const isValidationError = error instanceof ZodError;
  const isDuplicate = error.code === "23505";
  const status = isValidationError
    ? 400
    : error.statusCode || (isDuplicate ? 409 : 500);
  const duplicateMessage =
    error.constraint === "budget_fixed_cost_types_active_name_idx"
      ? "A fixed cost with this name already exists."
      : "A category with this name already exists.";
  res.status(status).json({
    error: isValidationError
      ? error.issues[0].message
      : isDuplicate
        ? duplicateMessage
        : error.statusCode
          ? error.message
          : "Server error",
  });
}
