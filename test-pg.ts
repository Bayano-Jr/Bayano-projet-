import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function test() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'projects'");
    console.log("Projects columns:", res.rows.map(r => r.column_name));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

test();
