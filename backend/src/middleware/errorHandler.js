import { ZodError } from "zod";

export function errorHandler(error, _, res, __) {
  console.error(error);
  const isValidationError = error instanceof ZodError;
  const isDuplicateCategory = error.code === "23505";
  res.status(isValidationError ? 400 : isDuplicateCategory ? 409 : 500).json({
    error: isValidationError
      ? error.issues[0].message
      : isDuplicateCategory
        ? "A category with this name already exists."
        : "Server error",
  });
}
