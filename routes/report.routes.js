const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  bestSelling,
  salesSummary,
  salesHistory,
  sellerSales,
  salesList,
} = require("../controllers/report.controller");

const router = express.Router();

router.get("/best-selling", requireAuth, requireRole("admin"), bestSelling);
router.get("/summary", requireAuth, requireRole("admin"), salesSummary);
router.get("/sales-history", requireAuth, requireRole("admin"), salesHistory);

// Seller-wise sales (admin can view anyone; salesman can view self)
router.get("/seller/:sellerId/sales", requireAuth, requireRole("admin", "salesman"), sellerSales);

// Total sales list with pagination (admin all; salesman only own)
router.get("/sales", requireAuth, requireRole("admin", "salesman"), salesList);

module.exports = router;

