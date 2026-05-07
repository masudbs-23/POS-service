const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { assertRequiredString } = require("../utils/validation");

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function registerSalesman(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    assertRequiredString(name, "name");
    assertRequiredString(email, "email");
    assertRequiredString(password, "password");

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'salesman')
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), password_hash]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    // duplicate email
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return next(err);
  }
}

async function registerAdmin(req, res, next) {
  try {
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (bootstrapSecret) {
      const provided = String(req.headers["x-admin-bootstrap-secret"] || "");
      if (provided !== bootstrapSecret) {
        return res.status(403).json({ message: "Invalid bootstrap secret" });
      }
    }

    // allow only if no admin exists yet
    const adminExists = await pool.query(
      `SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`
    );
    if (adminExists.rowCount > 0) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    const { name, email, password } = req.body || {};
    assertRequiredString(name, "name");
    assertRequiredString(email, "email");
    assertRequiredString(password, "password");

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), password_hash]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    assertRequiredString(email, "email");
    assertRequiredString(password, "password");

    const result = await pool.query(
      `SELECT id, name, email, role, password_hash
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { registerAdmin, registerSalesman, login, me };

