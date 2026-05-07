const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  bestSelling,
  salesSummary,
  salesHistory,
} = require("../controllers/report.controller");

const router = express.Router();

router.get("/best-selling", requireAuth, requireRole("admin"), bestSelling);
router.get("/summary", requireAuth, requireRole("admin"), salesSummary);
router.get("/sales-history", requireAuth, requireRole("admin"), salesHistory);

module.exports = router;

