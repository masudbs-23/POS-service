const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { registerAdmin, registerSalesman, createSalesman, login, me, getSalesmen } = require("../controllers/auth.controller");

const router = express.Router();

// Bootstrap: create first admin (works only if no admin exists)
router.post("/register-admin", registerAdmin);

// Admin creates salesman accounts
router.post("/register", requireAuth, requireRole("admin"), registerSalesman);
router.post("/salesmen", requireAuth, requireRole("admin"), createSalesman);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.get("/salesmen", requireAuth, requireRole("admin"), getSalesmen);

module.exports = router;

