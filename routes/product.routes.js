const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadImage } = require("../middleware/upload");
const {
  createProduct,
  uploadProductImage,
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

router.post("/upload-image", requireAuth, requireRole("admin"), uploadImage.single("image"), uploadProductImage);

router.post("/", requireAuth, requireRole("admin"), uploadImage.single("image"), createProduct);
router.put("/:id", requireAuth, requireRole("admin"), updateProduct);
router.delete("/:id", requireAuth, requireRole("admin"), deleteProduct);

// Inventory adjustments (admin)
router.post("/:id/stock-in", requireAuth, requireRole("admin"), stockIn);
router.post("/:id/stock-out", requireAuth, requireRole("admin"), stockOut);

module.exports = router;

