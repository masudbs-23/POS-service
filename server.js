require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { pool } = require("./db");
const { success } = require("./utils/response");
const apiRoutes = require("./routes/index.js");
const { notFound, errorHandler } = require("./middleware/error");
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.get("/health", (req, res) => {
  res.json({ ok: true });
});
app.get("/api/health", (req, res) => {
  return success(res, { status: 200, code: "S200", message: "health", data: { ok: true } });
});
app.use("/api", apiRoutes);
app.use(notFound);
app.use(errorHandler);
const port = process.env.PORT || 5000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`POS API listening on http://localhost:${port}`);
});

async function checkDbConnection() {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    // eslint-disable-next-line no-console
    console.log("Database connected:", r.rows?.[0]?.ok === 1);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Database connection failed. Check DATABASE_URL in .env");
    // eslint-disable-next-line no-console
    console.error(err?.message || err);
    process.exit(1);
  }
}
checkDbConnection();

