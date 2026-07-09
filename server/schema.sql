-- Esquema de la base de dades D1 (SQLite) de l'API de Fardell.
-- S'aplica amb: pnpm db:init (remota) o pnpm db:init:local (desenvolupament).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- PBKDF2-SHA256, en hexadecimal
  salt TEXT NOT NULL,          -- sal per usuari, en hexadecimal
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, -- SHA-256 del testimoni; el testimoni en clar només el té el client
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Les dades de cada usuari: el mateix JSON que l'app desa a localStorage.
CREATE TABLE IF NOT EXISTS gear_data (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
