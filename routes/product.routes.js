const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createProduct,
  getProducts,
  searchProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
} = require("../controllers/product.controller");

const router = express.Router();

router.get("/", requireAuth, getProducts);
router.get("/search", requireAuth, searchProducts);
router.get("/:id", requireAuth, getProductById);

router.post("/", requireAuth, requireRole("admin"), createProduct);
router.put("/:id", requireAuth, requireRole("admin"), updateProduct);
router.delete("/:id", requireAuth, requireRole("admin"), deleteProduct);

// Inventory adjustments (admin)
router.post("/:id/stock-in", requireAuth, requireRole("admin"), stockIn);
router.post("/:id/stock-out", requireAuth, requireRole("admin"), stockOut);

module.exports = router;

