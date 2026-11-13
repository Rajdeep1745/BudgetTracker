import { pool } from "../db.js";

export async function listCategories() {
  const result = await pool.query(
    "SELECT * FROM categories ORDER BY group_name, name",
  );
  return result.rows;
}

export async function createCategory(category) {
  const result = await pool.query(
    `INSERT INTO categories (name, group_name)
     VALUES ($1, $2)
     RETURNING id, name, group_name, color`,
    [category.name, category.groupName],
  );
  return result.rows[0];
}
