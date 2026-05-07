-- Create an initial admin user (run AFTER schema.sql)
-- Password: admin123
-- NOTE: bcrypt hashes are one-way; this is a precomputed hash for "admin123".

INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Admin',
  'admin@example.com',
  '$2b$10$QR92vWhvQOz7q.0NWCXkH.DsVJEcRX2TSOSuEZU.hbxuETpnS4WHK',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

