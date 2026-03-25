import express from "express";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import HTMLtoDOCX from 'html-to-docx';
import crypto from 'crypto';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import rateLimit from 'express-rate-limit';

admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0928535629'
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool: any;
let db: any;

if (process.env.DATABASE_URL) {
  console.log("Using PostgreSQL database");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err: any, client: any) => {
    console.error('Unexpected error on idle client', err);
  });

  db = {
    query: async (sql: string, params: any[] = []) => {
      let i = 1;
      const pgSql = sql.replace(/\?/g, () => `$${i++}`);
      return pool.query(pgSql, params);
    },
    get: async (sql: string, ...params: any[]) => {
      let i = 1;
      const pgSql = sql.replace(/\?/g, () => `$${i++}`);
      const res = await pool.query(pgSql, params);
      return res.rows[0];
    },
    all: async (sql: string, ...params: any[]) => {
      let i = 1;
      const pgSql = sql.replace(/\?/g, () => `$${i++}`);
      const res = await pool.query(pgSql, params);
      return res.rows;
    },
    run: async (sql: string, ...params: any[]) => {
      let i = 1;
      const pgSql = sql.replace(/\?/g, () => `$${i++}`);
      await pool.query(pgSql, params);
    },
    exec: async (sql: string) => {
      await pool.query(sql);
    },
    prepare: (sql: string) => {
      return {
        run: (...params: any[]) => {
          (async () => {
            try {
              let i = 1;
              const pgSql = sql.replace(/\?/g, () => `$${i++}`);
              await pool.query(pgSql, params);
            } catch (err) {
              console.error("Async db.prepare run error:", err);
            }
          })();
        }
      };
    }
  };
} else {
  console.log("Using SQLite database (fallback)");
  const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/database.sqlite' : 'database.sqlite';
  const sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  
  db = {
    query: async (sql: string, params: any[] = []) => sqliteDb.prepare(sql).all(params),
    get: async (sql: string, ...params: any[]) => sqliteDb.prepare(sql).get(...params),
    all: async (sql: string, ...params: any[]) => sqliteDb.prepare(sql).all(...params),
    run: async (sql: string, ...params: any[]) => sqliteDb.prepare(sql).run(...params),
    exec: async (sql: string) => sqliteDb.exec(sql),
    prepare: (sql: string) => {
      const stmt = sqliteDb.prepare(sql);
      return {
        run: (...params: any[]) => stmt.run(...params)
      };
    }
  };
}

// Initialize database
(async () => {
  try {
    await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    google_id TEXT UNIQUE,
    firebase_uid TEXT UNIQUE,
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

// Migrations
try { await db.run("ALTER TABLE users ADD COLUMN firebase_uid TEXT UNIQUE"); } catch (e) {}
try { await db.run("ALTER TABLE projects ADD COLUMN docx_data TEXT"); } catch (e) {}
try { await db.run("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'"); } catch (e) {}
try { await db.run("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 30"); } catch (e) {}
try { await db.run("ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP"); } catch (e) {}
try { await db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) {}

const missingColumns = [
  "methodology TEXT",
  "documentType TEXT",
  "generationMode TEXT",
  "language TEXT",
  "aiModel TEXT"
];

for (const col of missingColumns) {
  try {
    await db.run(`ALTER TABLE projects ADD COLUMN ${col}`);
  } catch (e) {
    // Column might already exist
  }
}
  } catch (err) {
    console.error("DB Init Error:", err);
  }
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set("trust proxy", 1);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ];
      
      if (process.env.APP_URL) {
        allowedOrigins.push(process.env.APP_URL.replace(/\/$/, ""));
      }

      // Allow any origin ending with .run.app for AI Studio preview
      if (origin.endsWith('.run.app') || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        console.warn(`[CORS] Rejected origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth Middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    // Enforce CSRF check on state-changing requests using Origin/Referer
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin || req.headers.referer;
      if (!origin) {
        console.warn(`[CSRF Check] Failed for ${req.path}. Missing Origin/Referer.`);
        return res.status(403).json({ error: "Requête non autorisée (Origine manquante)." });
      }
      
      try {
        const originUrl = new URL(origin);
        let expectedHost = req.headers['x-forwarded-host'] || req.get('host');
        if (typeof expectedHost === 'string' && expectedHost.includes(',')) {
          expectedHost = expectedHost.split(',')[0].trim();
        }
        
        let appUrlHost = '';
        if (process.env.APP_URL) {
          try {
            appUrlHost = new URL(process.env.APP_URL).host;
          } catch (e) {}
        }

        if (originUrl.host !== expectedHost && originUrl.host !== appUrlHost && originUrl.host !== 'localhost:3000' && originUrl.host !== 'localhost:5173' && originUrl.host !== '127.0.0.1:3000' && originUrl.host !== '127.0.0.1:5173') {
          console.warn(`[CSRF Check] Failed for ${req.path}. Origin: ${originUrl.host}, Expected: ${expectedHost}, APP_URL: ${appUrlHost}`);
          return res.status(403).json({ error: "Requête non autorisée (Origine invalide)." });
        }
      } catch (err) {
        return res.status(403).json({ error: "Requête non autorisée (Origine malformée)." });
      }
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Non autorisé. Jeton manquant." });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      let user: any = await db.get("SELECT * FROM users WHERE firebase_uid = ?", decodedToken.uid);
      
      if (!user) {
        user = await db.get("SELECT * FROM users WHERE email = ?", decodedToken.email);
        
        if (user) {
          await db.run("UPDATE users SET firebase_uid = ? WHERE id = ?", decodedToken.uid, user.id);
        } else {
          const newId = crypto.randomUUID();
          try {
            await db.run(
              "INSERT INTO users (id, email, name, firebase_uid, plan, credits) VALUES (?, ?, ?, ?, 'free', 30)",
              newId, decodedToken.email, decodedToken.name || decodedToken.email?.split('@')[0], decodedToken.uid
            );
            user = await db.get("SELECT * FROM users WHERE id = ?", newId);
          } catch (insertError: any) {
            // Handle concurrent insert race condition (e.g. duplicate key value violates unique constraint)
            user = await db.get("SELECT * FROM users WHERE firebase_uid = ?", decodedToken.uid);
            if (!user) {
              user = await db.get("SELECT * FROM users WHERE email = ?", decodedToken.email);
              if (user) {
                await db.run("UPDATE users SET firebase_uid = ? WHERE id = ?", decodedToken.uid, user.id);
              } else {
                throw insertError;
              }
            }
          }
        }
      }
      req.user = user;
      req.session = { userId: user.id }; // Mock session for compatibility
      next();
    } catch (error) {
      console.error("Firebase auth error:", error);
      return res.status(401).json({ error: "Non autorisé. Jeton invalide." });
    }
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    // Enforce CSRF check on state-changing requests using Origin/Referer
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin || req.headers.referer;
      if (!origin) {
        console.warn(`[CSRF Check] Admin failed for ${req.path}. Missing Origin/Referer.`);
        return res.status(403).json({ error: "Requête non autorisée (Origine manquante)." });
      }
      
      try {
        const originUrl = new URL(origin);
        let expectedHost = req.headers['x-forwarded-host'] || req.get('host');
        if (typeof expectedHost === 'string' && expectedHost.includes(',')) {
          expectedHost = expectedHost.split(',')[0].trim();
        }
        
        let appUrlHost = '';
        if (process.env.APP_URL) {
          try {
            appUrlHost = new URL(process.env.APP_URL).host;
          } catch (e) {}
        }

        if (originUrl.host !== expectedHost && originUrl.host !== appUrlHost && originUrl.host !== 'localhost:3000' && originUrl.host !== 'localhost:5173' && originUrl.host !== '127.0.0.1:3000' && originUrl.host !== '127.0.0.1:5173') {
          console.warn(`[CSRF Check] Admin failed for ${req.path}. Origin: ${originUrl.host}, Expected: ${expectedHost}, APP_URL: ${appUrlHost}`);
          return res.status(403).json({ error: "Requête non autorisée (Origine invalide)." });
        }
      } catch (err) {
        return res.status(403).json({ error: "Requête non autorisée (Origine malformée)." });
      }
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ error: "Accès refusé. Privilèges administrateur requis." });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET || "bayano-secret-v4-final") as any;
      if (decoded.isAdmin) {
        req.session = { isAdmin: true }; // Mock session for compatibility
        return next();
      }
    } catch (err) {
      // Not a valid admin JWT token
    }
    return res.status(403).json({ error: "Accès refusé. Privilèges administrateur requis." });
  };

  app.get("/api/config", requireAuth, (req, res) => {
    res.json({
      geminiApiKey: process.env.GEMINI_API_KEY || "",
    });
  });

  const checkAdminOptional = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET || "bayano-secret-v4-final") as any;
        if (decoded.isAdmin) {
          req.session = req.session || {};
          req.session.isAdmin = true;
        }
      } catch (err) {}
    }
    next();
  };

  // Auth Routes
  const authSyncLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 sync requests per window
    message: { error: "Trop de tentatives de synchronisation. Veuillez réessayer plus tard." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/auth/sync", authSyncLimiter, requireAuth, async (req, res) => {
    res.json({ success: true, user: req.user });
  });





  app.get("/api/auth/me", requireAuth, async (req: any, res: any) => {
    const user: any = await db.get("SELECT id, email, name, two_factor_enabled, plan, credits, subscription_expires_at FROM users WHERE id = ?", req.user.id);
    if (user) {
      res.json({ 
        user: { ...user, twoFactorEnabled: !!user.two_factor_enabled }
      });
    } else {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    }
  });

  // SaaS Routes
  app.get("/api/saas/status", requireAuth, async (req: any, res: any) => {
    const user: any = await db.get("SELECT plan, credits, subscription_expires_at FROM users WHERE id = ?", req.session.userId);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  });

  app.post("/api/saas/subscribe", requireAuth, async (req: any, res: any) => {
    const { plan } = req.body; // 'student' or 'premium'
    if (!['student', 'premium'].includes(plan)) {
      return res.status(400).json({ error: "Plan invalide" });
    }

    const creditsToAdd = plan === 'student' ? 300 : 800;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await db.run("UPDATE users SET plan = ?, credits = credits + ?, subscription_expires_at = ? WHERE id = ?",
      plan, creditsToAdd, expiresAt, req.session.userId);

    await db.run("INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)",
      Math.random().toString(36).substring(7), req.session.userId, 'subscription', creditsToAdd, `Abonnement ${plan}`);

    res.json({ success: true, plan, creditsAdded: creditsToAdd, expiresAt });
  });

  app.post("/api/saas/buy-credits", requireAuth, async (req: any, res: any) => {
    const { pack } = req.body; // 'mini' (50), 'medium' (150), 'memoire' (400)
    let creditsToAdd = 0;
    if (pack === 'mini') creditsToAdd = 50;
    else if (pack === 'medium') creditsToAdd = 150;
    else if (pack === 'memoire') creditsToAdd = 400;
    else return res.status(400).json({ error: "Pack invalide" });

    await db.run("UPDATE users SET credits = credits + ? WHERE id = ?",
      creditsToAdd, req.session.userId);

    await db.run("INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)",
      Math.random().toString(36).substring(7), req.session.userId, 'pack', creditsToAdd, `Achat pack ${pack}`);

    res.json({ success: true, creditsAdded: creditsToAdd });
  });

  app.post("/api/saas/estimate", requireAuth, async (req: any, res: any) => {
    try {
      const { type, pages } = req.body; // type: 'plan' or 'generation'
      let estimatedCredits = 0;
      if (type === 'plan') {
        estimatedCredits = 2; // Fixed cost for plan
      } else if (type === 'generation') {
        // 1 page = ~250 words = 1 credit
        estimatedCredits = pages || 1;
      }
      
      const user: any = await db.get("SELECT credits, plan FROM users WHERE id = ?", req.session.userId);
      
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      res.json({ 
        estimatedCredits, 
        hasEnough: user.credits >= estimatedCredits,
        currentCredits: user.credits,
        plan: user.plan
      });
    } catch (error: any) {
      console.error("Error in /api/saas/estimate:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  app.post("/api/saas/deduct", requireAuth, async (req: any, res: any) => {
    try {
      const { amount, description } = req.body;
      const user: any = await db.get("SELECT credits FROM users WHERE id = ?", req.session.userId);
      
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      if (user.credits < amount) {
        return res.status(402).json({ error: "Crédits insuffisants" });
      }

      await db.run("UPDATE users SET credits = credits - ? WHERE id = ?", amount, req.session.userId);
      await db.run("INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)",
        Math.random().toString(36).substring(7), req.session.userId, 'usage', -amount, description);

      res.json({ success: true, remainingCredits: user.credits - amount });
    } catch (error: any) {
      console.error("Error in /api/saas/deduct:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

// Project Routes
  app.get("/api/projects", requireAuth, async (req: any, res: any) => {
    try {
      const projects = await db.all("SELECT id, user_id, title, field, university, country, level, norm, min_pages, instructions, reference_text, methodology, documentType, generationMode, language, aiModel, plan, status, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC", req.session.userId);
      res.json(projects);
    } catch (err) {
      console.error("Get projects error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des projets" });
    }
  });

  app.post("/api/projects", requireAuth, async (req: any, res: any) => {
    try {
      const project = req.body;
      console.log(`[ProjectSave] User: ${req.session.userId}, ProjectID: ${project.id}`);
      
      const existing = await db.get("SELECT user_id FROM projects WHERE id = ?", project.id) as any;
      if (existing && existing.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé à modifier ce projet" });
      }
      
      await db.run(`
        INSERT INTO projects (id, user_id, title, field, university, country, level, norm, min_pages, instructions, reference_text, methodology, documentType, generationMode, language, aiModel, plan, status, docx_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, field=EXCLUDED.field, university=EXCLUDED.university, country=EXCLUDED.country, level=EXCLUDED.level, norm=EXCLUDED.norm, min_pages=EXCLUDED.min_pages, instructions=EXCLUDED.instructions, reference_text=EXCLUDED.reference_text, methodology=EXCLUDED.methodology, documentType=EXCLUDED.documentType, generationMode=EXCLUDED.generationMode, language=EXCLUDED.language, aiModel=EXCLUDED.aiModel, plan=EXCLUDED.plan, status=EXCLUDED.status, docx_data=EXCLUDED.docx_data
      `, 
        project.id,
        req.session.userId,
        project.title,
        project.field,
        project.university,
        project.country,
        project.level,
        project.norm,
        project.min_pages,
        project.instructions || null,
        project.referenceText || null,
        project.methodology || null,
        project.documentType || null,
        project.generationMode || null,
        project.language || null,
        project.aiModel || null,
        project.plan || null,
        project.status,
        project.docx_data || null
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Save project error:", err);
      res.status(500).json({ error: "Erreur lors de la sauvegarde du projet" });
    }
  });

  app.post("/api/projects/:id/docx", requireAuth, async (req: any, res: any) => {
    try {
      const { html } = req.body;
      const project = await db.get("SELECT user_id FROM projects WHERE id = ?", req.params.id) as any;
      if (!project || project.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const fileBuffer = await HTMLtoDOCX(html, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });

      const base64Data = fileBuffer.toString('base64');
      await db.run("UPDATE projects SET docx_data = ? WHERE id = ?", base64Data, req.params.id);
      
      res.json({ success: true, docx_data: base64Data });
    } catch (err) {
      console.error("HTML to DOCX error:", err);
      res.status(500).json({ error: "Erreur lors de la conversion du document" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req: any, res: any) => {
    try {
      console.log(`[ProjectAccess] User ${req.session.userId} requesting project ${req.params.id}`);
      const project: any = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
      
      if (!project) {
        console.warn(`[ProjectAccess] Project ${req.params.id} not found in database`);
        return res.status(404).json({ error: "Projet introuvable dans la base de données." });
      }

      if (project.user_id !== req.session.userId) {
        console.warn(`[ProjectAccess] Project ${req.params.id} belongs to user ${project.user_id}, but requested by ${req.session.userId}`);
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation d'accéder à ce projet." });
      }
      
      const chapters = await db.all("SELECT * FROM chapters WHERE project_id = ? ORDER BY order_index ASC", req.params.id);
      console.log(`[Project] Retrieved project ${req.params.id} with ${chapters.length} chapters`);
      res.json({ ...project, chapters });
    } catch (err: any) {
      console.error("Get project error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération du projet." });
    }
  });

  app.get("/api/projects/:id/chapters", requireAuth, async (req: any, res: any) => {
    try {
      const project = await db.get("SELECT user_id FROM projects WHERE id = ?", req.params.id) as any;
      if (!project || project.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      const chapters = await db.all("SELECT * FROM chapters WHERE project_id = ? ORDER BY order_index ASC", req.params.id);
      res.json(chapters);
    } catch (err) {
      console.error("Get project chapters error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des chapitres." });
    }
  });

  app.patch("/api/projects/:id/plan", requireAuth, async (req: any, res: any) => {
    try {
      const { plan } = req.body;
      await db.run("UPDATE projects SET plan = ?, status = 'plan_validated' WHERE id = ? AND user_id = ?", JSON.stringify(plan), req.params.id, req.session.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Update plan error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du plan" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req: any, res: any) => {
    try {
      const project = await db.get("SELECT user_id FROM projects WHERE id = ?", req.params.id) as any;
      if (!project || project.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      // Chapters will be deleted by ON DELETE CASCADE if configured, but let's be explicit for safety
      await db.run("DELETE FROM chapters WHERE project_id = ?", req.params.id);
      await db.run("DELETE FROM projects WHERE id = ? AND user_id = ?", req.params.id, req.session.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete project error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression du projet" });
    }
  });

  app.get("/api/chapters", requireAuth, async (req: any, res: any) => {
    const chapters = await db.all(`
      SELECT c.* FROM chapters c 
      JOIN projects p ON c.project_id = p.id 
      WHERE p.user_id = ?
    `, req.session.userId);
    res.json(chapters);
  });

  app.post("/api/chapters", requireAuth, async (req: any, res: any) => {
    try {
      const chapter = req.body;
      console.log(`[Chapters] Saving chapter ${chapter.id} for project ${chapter.project_id} (order: ${chapter.order_index})`);
      
      const project = await db.get("SELECT user_id FROM projects WHERE id = ?", chapter.project_id) as any;
      if (!project || project.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé à modifier ce projet" });
      }

      await db.run(`
        INSERT INTO chapters (id, project_id, title, content, order_index, word_count) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, order_index=EXCLUDED.order_index, word_count=EXCLUDED.word_count
      `, 
        chapter.id,
        chapter.project_id,
        chapter.title,
        chapter.content,
        chapter.order_index,
        chapter.word_count
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Save chapter error:", err);
      res.status(500).json({ error: "Erreur lors de la sauvegarde du chapitre" });
    }
  });

  // Chat Sessions Routes
  app.get("/api/chat-sessions", requireAuth, async (req: any, res: any) => {
    try {
      const sessions = await db.all("SELECT id, title, messages, updated_at as updatedAt FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC", req.session.userId);
      const formattedSessions = sessions.map((s: any) => ({
        ...s,
        messages: JSON.parse(s.messages || '[]')
      }));
      res.json(formattedSessions);
    } catch (err) {
      console.error("Get chat sessions error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des discussions" });
    }
  });

  app.post("/api/chat-sessions", requireAuth, async (req: any, res: any) => {
    try {
      const session = req.body;
      const existing = await db.get("SELECT user_id FROM chat_sessions WHERE id = ?", session.id) as any;
      if (existing && existing.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      await db.run(`
        INSERT INTO chat_sessions (id, user_id, title, messages, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, messages=EXCLUDED.messages, updated_at=CURRENT_TIMESTAMP
      `,
        session.id,
        req.session.userId,
        session.title,
        JSON.stringify(session.messages),
        new Date(session.updatedAt).toISOString()
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Save chat session error:", err);
      res.status(500).json({ error: "Erreur lors de la sauvegarde de la discussion" });
    }
  });

  app.delete("/api/chat-sessions/:id", requireAuth, async (req: any, res: any) => {
    try {
      await db.run("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", req.params.id, req.session.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete chat session error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la discussion" });
    }
  });

  // Admin Routes
  const adminLoginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 login requests per `window`
    handler: (req: any, res, next, options) => {
      res.status(options.statusCode).json({
        error: "Trop de tentatives de connexion.",
        resetTime: req.rateLimit?.resetTime?.getTime() || Date.now() + options.windowMs
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
    try {
      const { password } = req.body;
      const currentSettingsRows = await db.all("SELECT * FROM settings");
      const currentSettings: any = {};
      currentSettingsRows.forEach((row: any) => {
        currentSettings[row.key] = row.value;
      });
      
      const adminPassword = currentSettings.adminPassword || 'admin';
      
      let isMatch = false;
      if (adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, adminPassword);
      } else {
        // Fallback for plain text password (e.g. default 'admin' or before migration)
        isMatch = (password === adminPassword);
        
        // Auto-migrate to hashed password if it matches
        if (isMatch) {
          const hashed = await bcrypt.hash(password, 10);
          await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            'adminPassword', hashed);
        }
      }
      
      if (isMatch) {
        const token = jwt.sign({ isAdmin: true }, process.env.SESSION_SECRET || "bayano-secret-v4-final", { expiresIn: '1d' });
        res.json({ success: true, token });
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } catch (err) {
      // We don't use console.error here to avoid triggering error overlays for expected user errors
      res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/admin/error-logs", requireAdmin, async (req, res) => {
    try {
      const logs = await db.all("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50");
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/schema", requireAdmin, async (req, res) => {
    try {
      const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      const columns = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'");
      res.json({ tables: tables.rows, columns: columns.rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/sessions", requireAdmin, async (req, res) => {
    try {
      const sessions = await pool.query("SELECT * FROM session");
      res.json(sessions.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await db.all("SELECT id, email, name, created_at, plan, credits, subscription_expires_at, status FROM users ORDER BY created_at DESC");
      res.json(users);
    } catch (err) {
      console.error("Get users error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { plan, credits, status } = req.body;
      const userId = req.params.id;
      
      let expiresAt = null;
      if (plan !== 'free') {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      await db.run("UPDATE users SET plan = ?, credits = ?, subscription_expires_at = ?, status = ? WHERE id = ?",
        plan, credits, expiresAt, status || 'active', userId);
        
      res.json({ success: true });
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      await db.run("DELETE FROM users WHERE id = ?", userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Admin delete user error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const totalUsers = await db.get("SELECT COUNT(*) as count FROM users") as any;
      const totalProjects = await db.get("SELECT COUNT(*) as count FROM projects") as any;
      
      // Revenue from transactions
      const totalRevenue = await db.get("SELECT SUM(amount) as total FROM transactions") as any;
      
      // Users by plan
      const usersByPlan = await db.all("SELECT plan, COUNT(*) as count FROM users GROUP BY plan");
      
      // Projects by AI Model
      const projectsByModel = await db.all("SELECT aiModel, COUNT(*) as count FROM projects GROUP BY aiModel");
      
      // Projects by Document Type
      const projectsByType = await db.all("SELECT documentType, COUNT(*) as count FROM projects GROUP BY documentType");
      
      // Recent transactions
      const recentTransactions = await db.all(`
        SELECT t.*, u.name as user_name, u.email as user_email 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC LIMIT 10
      `);

      // Top users by projects
      const topUsers = await db.all(`
        SELECT u.id, u.name, u.email, COUNT(p.id) as project_count 
        FROM users u 
        LEFT JOIN projects p ON u.id = p.user_id 
        GROUP BY u.id 
        ORDER BY project_count DESC LIMIT 5
      `);

      res.json({
        totalUsers: totalUsers.count,
        totalProjects: totalProjects.count,
        totalRevenue: totalRevenue.total || 0,
        usersByPlan,
        projectsByModel,
        projectsByType,
        recentTransactions,
        topUsers
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
    }
  });

  app.get("/api/admin/errors", requireAdmin, async (req, res) => {
    try {
      const errors = await db.all(`
        SELECT e.*, u.name as user_name, u.email as user_email 
        FROM error_logs e 
        LEFT JOIN users u ON e.user_id = u.id 
        ORDER BY e.created_at DESC LIMIT 100
      `);
      res.json(errors);
    } catch (err) {
      console.error("Admin errors error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des erreurs" });
    }
  });

  app.post("/api/log-error", async (req: any, res: any) => {
    try {
      const { message, stack, context } = req.body;
      const userId = req.session?.userId || null;
      await db.run("INSERT INTO error_logs (id, user_id, error_message, error_stack, context) VALUES (?, ?, ?, ?, ?)",
        crypto.randomUUID(), userId, message, stack, JSON.stringify(context));
      res.json({ success: true });
    } catch (err) {
      console.error("Log error failed:", err);
      res.status(500).json({ error: "Failed to log error" });
    }
  });

  // Settings Routes
  app.get("/api/settings", checkAdminOptional, async (req: any, res: any) => {
    const rows = await db.all("SELECT * FROM settings");
    const settings: any = {
      priceStudent: 9.99,
      pricePremium: 24.99,
      pricePackMini: 4.99,
      pricePackMedium: 12.99,
      pricePackMemoire: 29.99,
      globalDiscount: 0,
    };
    
    const isAdmin = req.session && req.session.isAdmin;

    rows.forEach((row: any) => {
      // Only send adminPassword if the user is an admin, and send a placeholder
      if (row.key === 'adminPassword') {
        if (isAdmin) {
          settings[row.key] = '********';
        }
      } else {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      }
    });

    // Automatically upgrade old models to valid Gemini 3 series models
    if (settings.aiModel === 'gemini-2.5-flash-preview' || settings.aiModel === 'gemini-2.5-flash' || settings.aiModel === 'gemini-flash-latest') {
      settings.aiModel = 'gemini-3-flash-preview';
    } else if (settings.aiModel === 'gemini-1.5-pro' || settings.aiModel === 'gemini-pro') {
      settings.aiModel = 'gemini-3.1-pro-preview';
    } else if (settings.aiModel === 'gemini-flash-lite-latest') {
      settings.aiModel = 'gemini-3.1-flash-lite-preview';
    }

    res.json(settings);
  });

  app.post("/api/settings", requireAdmin, async (req: any, res: any) => {
    try {
      const { settings } = req.body;
      
      for (const [key, value] of Object.entries(settings)) {
        let finalValue = value;
        
        if (key === 'adminPassword') {
          // Ignore placeholder
          if (value === '********') {
            continue;
          }
          
          const current = await db.get("SELECT value FROM settings WHERE key = 'adminPassword'") as any;
          
          // If the client sends the default 'admin' password but the DB has a different one, don't overwrite it
          if (value === 'admin' && current && current.value !== 'admin') {
            continue; // Skip overwriting with default 'admin' if a custom password exists
          }
          
          // Only hash and update if the password has actually changed
          // We check if it's already a bcrypt hash to avoid double hashing if the client sends back the hash
          if (typeof value === 'string' && !value.startsWith('$2a$') && !value.startsWith('$2b$')) {
             finalValue = await bcrypt.hash(value, 10);
          } else if (current && value === current.value) {
             continue; // No change
          }
        }
        
        await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
          key, typeof finalValue === 'string' ? finalValue : JSON.stringify(finalValue));
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Save settings error:", err);
      res.status(500).json({ error: "Erreur lors de la sauvegarde des réglages" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
