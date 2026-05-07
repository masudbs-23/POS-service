const { pool } = require("../db");

async function bestSelling(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 10;

    const result = await pool.query(
      `SELECT
         p.id AS product_id,
         p.name,
         p.category,
         SUM(oi.quantity)::bigint AS total_sold,
         SUM(oi.subtotal)::numeric(12,2) AS revenue
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       GROUP BY p.id
       ORDER BY total_sold DESC
       LIMIT $1`,
      [safeLimit]
    );

    res.json({ best_selling: result.rows });
  } catch (err) {
    return next(err);
  }
}

async function salesSummary(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS total_revenue,
         COALESCE(SUM(oi.quantity), 0)::bigint AS total_products_sold,
         COUNT(DISTINCT o.id)::bigint AS total_orders
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id`
    );
    res.json({ analytics: result.rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function salesHistory(req, res, next) {
  try {
    // today / weekly / monthly using date_trunc buckets
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN o.created_at >= date_trunc('day', now()) THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS today_sales,
         COALESCE(SUM(CASE WHEN o.created_at >= now() - interval '7 days' THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS weekly_sales,
         COALESCE(SUM(CASE WHEN o.created_at >= now() - interval '30 days' THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS monthly_sales
       FROM orders o`
    );
    res.json({ sales: result.rows[0] });
  } catch (err) {
    return next(err);
  }
}

module.exports = { bestSelling, salesSummary, salesHistory };

