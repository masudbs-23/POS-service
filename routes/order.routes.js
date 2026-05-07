const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createOrder,
  getOrders,
  getOrderById,
} = require("../controllers/order.controller");

const router = express.Router();

// both admin and salesman can create/view orders
router.post("/", requireAuth, requireRole("admin", "salesman"), createOrder);
router.get("/", requireAuth, requireRole("admin", "salesman"), getOrders);
router.get("/:id", requireAuth, requireRole("admin", "salesman"), getOrderById);

module.exports = router;

