const { pool } = require("../db");
const { assertRequiredString, assertNonNegativeInt } = require("../utils/validation");
const { success, error: sendError } = require("../utils/response");

function assertPaymentMethod(payment_method) {
  const allowed = new Set(["cash", "bkash", "nagad", "card"]);
  if (!allowed.has(payment_method)) {
    const err = new Error("payment_method must be one of: cash, bkash, nagad, card");
    err.status = 400;
    throw err;
  }
}

function assertItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("items must be a non-empty array");
    err.status = 400;
    throw err;
  }
  for (const [idx, it] of items.entries()) {
    const productId = Number(it?.product_id);
    const qty = Number(it?.quantity);
    if (!Number.isInteger(productId) || productId <= 0) {
      const err = new Error(`items[${idx}].product_id must be a positive integer`);
      err.status = 400;
      throw err;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      const err = new Error(`items[${idx}].quantity must be a positive integer`);
      err.status = 400;
      throw err;
    }
  }
}

async function createOrder(req, res, next) {
  const client = await pool.connect();
  try {
    const { payment_method, items, discount } = req.body || {};
    assertRequiredString(payment_method, "payment_method");
    assertPaymentMethod(payment_method);
    assertItems(items);

    const discountNum = discount === undefined ? 0 : Number(discount);
    if (!Number.isFinite(discountNum) || discountNum < 0) {
      const err = new Error("discount must be a non-negative number");
      err.status = 400;
      throw err;
    }

    // Merge duplicates by product_id
    const merged = new Map();
    for (const it of items) {
      const pid = Number(it.product_id);
      const q = Number(it.quantity);
      merged.set(pid, (merged.get(pid) || 0) + q);
    }
    const normalizedItems = [...merged.entries()].map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));

    await client.query("BEGIN");

    // Lock product rows to prevent race conditions
    const productIds = normalizedItems.map((x) => x.product_id);
    const productsRes = await client.query(
      `SELECT id, name, price, quantity, is_deleted
       FROM products
       WHERE id = ANY($1::bigint[])
       FOR UPDATE`,
      [productIds]
    );

    const productsById = new Map(productsRes.rows.map((p) => [Number(p.id), p]));

    // Validate stock and compute totals
    let totalBeforeDiscount = 0;
    const invoiceItems = [];

    for (const it of normalizedItems) {
      const p = productsById.get(it.product_id);
      if (!p || p.is_deleted) {
        const err = new Error(`Product not found: ${it.product_id}`);
        err.status = 404;
        throw err;
      }
      const available = Number(p.quantity);
      if (available < it.quantity) {
        const err = new Error(`Insufficient stock for product ${p.id} (${p.name})`);
        err.status = 400;
        throw err;
      }

      const price = Number(p.price);
      const subtotal = price * it.quantity;
      totalBeforeDiscount += subtotal;

      invoiceItems.push({
        product_id: Number(p.id),
        name: p.name,
        quantity: it.quantity,
        price,
        subtotal,
      });
    }

    const totalAfterDiscount = Math.max(0, totalBeforeDiscount - discountNum);

    const orderRes = await client.query(
      `INSERT INTO orders (seller_id, total_amount, discount, payment_method)
       VALUES ($1, $2, $3, $4)
       RETURNING id, seller_id, total_amount, discount, payment_method, created_at`,
      [req.user.id, totalAfterDiscount, discountNum, payment_method]
    );
    const order = orderRes.rows[0];

    for (const it of invoiceItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, it.product_id, it.quantity, it.price, it.subtotal]
      );
      await client.query(
        `UPDATE products SET quantity = quantity - $1 WHERE id = $2`,
        [it.quantity, it.product_id]
      );
    }

    await client.query("COMMIT");

    return success(res, {
      status: 201,
      code: "S201",
      message: "Order created",
      data: {
        invoice: {
          order_id: Number(order.id),
          order_number: `ORD-${order.id}`,
          seller: { id: req.user.id, name: req.user.name },
          payment_method: order.payment_method,
          date_time: order.created_at,
          items: invoiceItems,
          total: Number(order.total_amount),
          discount: Number(order.discount),
          total_before_discount: totalBeforeDiscount,
        },
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    return next(err);
  } finally {
    client.release();
  }
}

async function getOrders(req, res, next) {
  try {
    const isAdmin = req.user.role === "admin";
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.per_page ? Number(req.query.per_page) : 10;

    if (!Number.isInteger(page) || page <= 0) {
      return sendError(res, { status: 400, code: "E400", message: "page must be a positive integer" });
    }
    if (!Number.isInteger(perPage) || perPage <= 0) {
      return sendError(res, { status: 400, code: "E400", message: "per_page must be a positive integer" });
    }
    const limit = Math.min(perPage, 100);
    const offset = (page - 1) * limit;

    const params = [];
    let whereSql = "";
    if (!isAdmin) {
      params.push(req.user.id);
      whereSql = `WHERE o.seller_id = $${params.length}`;
    }
    const countRes = await pool.query(
      `SELECT COUNT(*)::bigint AS total FROM orders o ${whereSql}`,
      params
    );
    const total = Number(countRes.rows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    params.push(limit, offset);

    const result = await pool.query(
      `SELECT o.*, u.name AS seller_name
       FROM orders o
       JOIN users u ON u.id = o.seller_id
       ${whereSql}
       ORDER BY o.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: {
        orders: result.rows,
        pagination: {
          page,
          per_page: limit,
          total,
          total_pages: totalPages,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const isAdmin = req.user.role === "admin";

    const orderRes = await pool.query(
      `SELECT o.*, u.name AS seller_name
       FROM orders o
       JOIN users u ON u.id = o.seller_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return sendError(res, { status: 404, code: "E404", message: "Order not found" });
    if (!isAdmin && Number(order.seller_id) !== Number(req.user.id)) {
      return sendError(res, { status: 403, code: "E403", message: "Forbidden" });
    }

    const itemsRes = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.category
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [id]
    );

    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: { order, items: itemsRes.rows },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createOrder, getOrders, getOrderById };

