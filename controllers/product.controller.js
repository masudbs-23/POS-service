const { pool } = require("../db");
const {
  assertRequiredString,
  assertPositiveNumber,
  assertNonNegativeInt,
} = require("../utils/validation");
const { success, error: sendError } = require("../utils/response");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");

async function createProduct(req, res, next) {
  try {
    const { name, price, quantity, barcode, category, image_url } = req.body || {};
    assertRequiredString(name, "name");
    assertRequiredString(category, "category");
    const priceNum = assertPositiveNumber(price, "price");
    const qty = assertNonNegativeInt(quantity ?? 0, "quantity");

    let finalImageUrl = image_url ? String(image_url).trim() : null;
    if (req.file?.buffer) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "pos/products",
      });
      finalImageUrl = uploaded?.secure_url || uploaded?.url || finalImageUrl;
    }

    const result = await pool.query(
      `INSERT INTO products (name, price, quantity, barcode, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        priceNum,
        qty,
        barcode ? String(barcode).trim() : null,
        category.trim(),
        finalImageUrl,
      ]
    );
    return success(res, {
      status: 201,
      code: "S201",
      message: "Product created",
      data: { product: result.rows[0] },
    });
  } catch (err) {
    return next(err);
  }
}

async function uploadProductImage(req, res, next) {
  try {
    if (!req.file?.buffer) {
      return sendError(res, { status: 400, code: "E400", message: "Missing image file" });
    }
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "pos/products",
    });
    const imageUrl = uploaded?.secure_url || uploaded?.url || null;
    if (!imageUrl) {
      return sendError(res, { status: 502, code: "E502", message: "Image upload failed" });
    }
    return success(res, {
      status: 201,
      code: "S201",
      message: "Image uploaded",
      data: { image_url: imageUrl, public_id: uploaded?.public_id || null },
    });
  } catch (err) {
    return next(err);
  }
}

async function getProducts(req, res, next) {
  try {
    const includeDeleted = String(req.query.include_deleted || "false") === "true";
    const lowStockThreshold = req.query.low_stock ? Number(req.query.low_stock) : null;
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.per_page ? Number(req.query.per_page) : 10;

    if (!Number.isInteger(page) || page <= 0) return sendError(res, { status: 400, code: "E400", message: "page must be a positive integer" });
    if (!Number.isInteger(perPage) || perPage <= 0) return sendError(res, { status: 400, code: "E400", message: "per_page must be a positive integer" });
    const limit = Math.min(perPage, 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (!includeDeleted) where.push("is_deleted = FALSE");
    if (Number.isFinite(lowStockThreshold)) {
      params.push(lowStockThreshold);
      where.push(`quantity <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRes = await pool.query(`SELECT COUNT(*)::bigint AS total FROM products ${whereSql}`, params);
    const total = Number(countRes.rows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT * FROM products ${whereSql} ORDER BY id DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return success(res, {
      status: 200,
      code: "S200",
      message: "OK",
      data: {
        products: result.rows,
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

async function searchProducts(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    const category = req.query.category ? String(req.query.category).trim() : null;
    const includeDeleted = String(req.query.include_deleted || "false") === "true";

    const where = [];
    const params = [];

    if (!includeDeleted) where.push("is_deleted = FALSE");

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`LOWER(name) LIKE $${params.length}`);
    }

    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM products ${whereSql} ORDER BY id DESC LIMIT 100`,
      params
    );
    return success(res, { status: 200, code: "S200", message: "OK", data: { products: result.rows } });
  } catch (err) {
    return next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
    const product = result.rows[0];
    if (!product) return sendError(res, { status: 404, code: "E404", message: "Product not found" });
    return success(res, { status: 200, code: "S200", message: "OK", data: { product } });
  } catch (err) {
    return next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, price, quantity, barcode, category, image_url } = req.body || {};

    const fields = [];
    const params = [];

    if (name !== undefined) {
      assertRequiredString(name, "name");
      params.push(name.trim());
      fields.push(`name = $${params.length}`);
    }

    if (price !== undefined) {
      const p = assertPositiveNumber(price, "price");
      params.push(p);
      fields.push(`price = $${params.length}`);
    }

    if (quantity !== undefined) {
      const q = assertNonNegativeInt(quantity, "quantity");
      params.push(q);
      fields.push(`quantity = $${params.length}`);
    }

    if (barcode !== undefined) {
      params.push(barcode ? String(barcode).trim() : null);
      fields.push(`barcode = $${params.length}`);
    }

    if (category !== undefined) {
      assertRequiredString(category, "category");
      params.push(category.trim());
      fields.push(`category = $${params.length}`);
    }

    if (image_url !== undefined) {
      params.push(image_url ? String(image_url).trim() : null);
      fields.push(`image_url = $${params.length}`);
    }

    if (fields.length === 0) {
      return sendError(res, { status: 400, code: "E400", message: "No fields to update" });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE products SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    const product = result.rows[0];
    if (!product) return sendError(res, { status: 404, code: "E404", message: "Product not found" });
    return success(res, {
      status: 200,
      code: "S200",
      message: "Product updated",
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(
      `UPDATE products SET is_deleted = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    const product = result.rows[0];
    if (!product) return sendError(res, { status: 404, code: "E404", message: "Product not found" });
    return success(res, {
      status: 200,
      code: "S200",
      message: "Product deleted",
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function stockIn(req, res, next) {
  try {
    const id = Number(req.params.id);
    const qty = assertNonNegativeInt(req.body?.quantity, "quantity");

    const result = await pool.query(
      `UPDATE products SET quantity = quantity + $1
       WHERE id = $2 AND is_deleted = FALSE
       RETURNING *`,
      [qty, id]
    );
    const product = result.rows[0];
    if (!product) return sendError(res, { status: 404, code: "E404", message: "Product not found" });
    return success(res, {
      status: 200,
      code: "S200",
      message: "Stock in successful",
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function stockOut(req, res, next) {
  try {
    const id = Number(req.params.id);
    const qty = assertNonNegativeInt(req.body?.quantity, "quantity");

    const result = await pool.query(
      `UPDATE products
       SET quantity = quantity - $1
       WHERE id = $2 AND is_deleted = FALSE AND quantity >= $1
       RETURNING *`,
      [qty, id]
    );
    const product = result.rows[0];
    if (!product) {
      return sendError(res, {
        status: 400,
        code: "E400",
        message: "Insufficient stock or product not found",
      });
    }
    return success(res, {
      status: 200,
      code: "S200",
      message: "Stock out successful",
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createProduct,
  uploadProductImage,
  getProducts,
  searchProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
};

