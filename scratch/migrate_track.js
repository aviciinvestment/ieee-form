const { neonConfig, Pool } = require("@neondatabase/serverless");
const ws = require("ws");
require("dotenv").config();

neonConfig.webSocketConstructor = ws;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log("Connecting to Neon over WebSocket...");
    await pool.query(`
      ALTER TABLE "LearningTrack" 
      ADD COLUMN IF NOT EXISTS "certificateDescription" TEXT NOT NULL DEFAULT '';
    `);
    console.log("LearningTrack certificateDescription column added successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

migrate();
