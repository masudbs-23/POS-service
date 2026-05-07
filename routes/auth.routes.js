const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { registerSalesman, login, me } = require("../controllers/auth.controller");

const router = express.Router();

// Admin creates salesman accounts
router.post("/register", requireAuth, requireRole("admin"), registerSalesman);
router.post("/login", login);
router.get("/me", requireAuth, me);

module.exports = router;

