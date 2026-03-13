import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in DB:", res.rows.map(r => r.table_name).join(', '));
    
    // Check columns in projects
    const projCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects'
    `);
    console.log("\nColumns in 'projects':");
    projCols.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
    
    // Check session table
    const sessCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'session'
    `);
    console.log("\nColumns in 'session':");
    sessCols.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    pool.end();
  }
}
check();
