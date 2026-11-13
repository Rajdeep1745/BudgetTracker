import { Router } from "express";
import { createCategory, listCategories } from "../services/categoryService.js";
import { categorySchema } from "../validators/category.js";

const router = Router();

router.get("/", async (_, res, next) => {
  try {
    res.json(await listCategories());
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const category = categorySchema.parse(req.body);
    res.status(201).json(await createCategory(category));
  } catch (error) {
    next(error);
  }
});

export default router;
