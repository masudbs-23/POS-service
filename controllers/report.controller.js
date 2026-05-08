const { pool } = require("../db");
const { success, error: sendError } = require("../utils/response");

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

    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: { best_selling: result.rows },
    });
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
    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: { analytics: result.rows[0] },
    });
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
    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: { sales: result.rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function sellerSales(req, res, next) {
  try {
    const sellerId = Number(req.params.sellerId);
    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return sendError(res, { status: 400, code: "E400", message: "sellerId must be a positive integer" });
    }

    const isAdmin = req.user.role === "admin";
    if (!isAdmin && Number(req.user.id) !== sellerId) {
      return sendError(res, { status: 403, code: "E403", message: "Forbidden" });
    }

    const result = await pool.query(
      `SELECT
         $1::bigint AS seller_id,
         COALESCE(SUM(CASE WHEN o.created_at >= date_trunc('day', now()) THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS today_sales,
         COALESCE(SUM(CASE WHEN o.created_at >= now() - interval '7 days' THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS weekly_sales,
         COALESCE(SUM(CASE WHEN o.created_at >= now() - interval '30 days' THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS monthly_sales,
         COUNT(*)::bigint AS total_orders
       FROM orders o
       WHERE o.seller_id = $1`,
      [sellerId]
    );

    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: { sales: result.rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function salesList(req, res, next) {
  try {
    const isAdmin = req.user.role === "admin";
    const page = parsePositiveInt(req.query.page, 1);
    const perPage = parsePositiveInt(req.query.per_page, 10);
    if (page === null) return sendError(res, { status: 400, code: "E400", message: "page must be a positive integer" });
    if (perPage === null) return sendError(res, { status: 400, code: "E400", message: "per_page must be a positive integer" });
    const limit = Math.min(perPage, 100);
    const offset = (page - 1) * limit;

    const sellerIdQuery = req.query.seller_id ? Number(req.query.seller_id) : null;
    if (req.query.seller_id !== undefined && (!Number.isInteger(sellerIdQuery) || sellerIdQuery <= 0)) {
      return sendError(res, { status: 400, code: "E400", message: "seller_id must be a positive integer" });
    }

    const params = [];
    const where = [];

    if (!isAdmin) {
      params.push(req.user.id);
      where.push(`o.seller_id = $${params.length}`);
    } else if (sellerIdQuery) {
      params.push(sellerIdQuery);
      where.push(`o.seller_id = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(*)::bigint AS total FROM orders o ${whereSql}`,
      params
    );
    const total = Number(countRes.rows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT o.*, u.name AS seller_name, u.email AS seller_email
       FROM orders o
       JOIN users u ON u.id = o.seller_id
       ${whereSql}
       ORDER BY o.id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: {
        orders: result.rows,
        pagination: { page, per_page: limit, total, total_pages: totalPages },
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { bestSelling, salesSummary, salesHistory, sellerSales, salesList };

