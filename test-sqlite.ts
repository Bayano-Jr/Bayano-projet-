import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function test() {
  try {
    const sqliteDb = await open({
      filename: 'database.sqlite',
      driver: sqlite3.Database
    });
    await sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    google_id TEXT UNIQUE,
    two_factor_secret TEXT,
    two_factor_enabled SMALLINT DEFAULT 0,
    plan TEXT DEFAULT 'free',
    credits INTEGER DEFAULT 30,
    subscription_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT, -- 'subscription', 'pack', 'usage'
    amount INTEGER, -- credits added or removed
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    field TEXT,
    university TEXT,
    country TEXT,
    level TEXT,
    norm TEXT,
    min_pages INTEGER,
    instructions TEXT,
    reference_text TEXT,
    methodology TEXT,
    documentType TEXT,
    generationMode TEXT,
    language TEXT,
    aiModel TEXT,
    plan TEXT,
    status TEXT,
    docx_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    content TEXT,
    order_index INTEGER,
    word_count INTEGER,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    messages TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    error_message TEXT,
    error_stack TEXT,
    context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS temp_login_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    email TEXT PRIMARY KEY,
    token TEXT,
    expires_at TIMESTAMP
  );
    `);
    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
