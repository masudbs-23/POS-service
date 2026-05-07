# POS Backend API (Node + Express + PostgreSQL)

## Setup

1) Install dependencies:

```bash
npm install
```

2) Create database + tables:

- Create a PostgreSQL database (example: `pos_db`)
- Run the SQL in `sql/schema.sql`

3) Configure env:

- Copy `.env.example` to `.env` and update values.

4) Run server:

```bash
npm run dev
```

Server runs on `http://localhost:5000` by default.

## Roles

- `admin`: can create salesman, manage products/inventory, view all orders and reports
- `salesman`: can login, create orders, see own order history

## Postman

Import `postman/POS.postman_collection.json`.

