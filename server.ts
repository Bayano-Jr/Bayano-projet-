import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import HTMLtoDOCX from 'html-to-docx';

declare module "express-session" {
  interface SessionData {
    userId: string;
    tempUserId: string;
    isAdmin?: boolean;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

const db = {
  query: async (sql, params = []) => {
    let i = 1;
    const pgSql = sql.replace(/\?/g, () => `$${i++}`);
    return pool.query(pgSql, params);
  },
  get: async (sql, ...params) => {
    const res = await db.query(sql, params);
    return res.rows[0];
  },
  all: async (sql, ...params) => {
    const res = await db.query(sql, params);
    return res.rows;
  },
  run: async (sql, ...params) => {
    await db.query(sql, params);
  },
  exec: async (sql) => {
    await pool.query(sql);
  },
  prepare: (sql) => {
    return {
      run: async (...params) => {
        await db.query(sql, params);
      }
    };
  }
};



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
try {
  await db.run("ALTER TABLE projects ADD COLUMN docx_data TEXT");
} catch (e) {
  // Column might already exist
}

try {
  await db.run("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'");
  await db.run("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 30");
  await db.run("ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP");
} catch (e) {
  // Columns might already exist
}

try {
  await db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
} catch (e) {
  // Column might already exist
}

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
  const PORT = Number(process.env.PORT) || 3000;

  app.set("trust proxy", true);

  app.use(cors({
    origin: (origin, callback) => {
      // Return the origin itself to satisfy the browser's requirement for explicit origin with credentials
      callback(null, origin || true);
    },
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok" });
  });

const PgStore = pgSession(session);
const sessionStore = new PgStore({
  pool: pool,
  tableName: 'session',
  createTableIfMissing: true
});

sessionStore.on('error', function(err) {
  console.error('Session store error:', err);
});


  app.use(session({
    name: 'bayano_sid_v4',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "bayano-secret-v4-final",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      partitioned: true
    }
  }));

  // Session Recovery Middleware (Fallback for blocked cookies in iframes)
  app.use(async (req: any, res: any, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && (!req.session || !req.session.userId)) {
      const sid = authHeader.split(' ')[1];
      if (sid && sid !== 'null' && sid !== 'undefined') {
        sessionStore.get(sid, (err, sessionData) => {
          if (!err && sessionData) {
            // Manually attach session data if found
            req.sessionID = sid;
            if (req.session) {
              Object.assign(req.session, sessionData);
            } else {
              req.session = sessionData;
            }
            console.log(`[SessionRecovery] Successfully recovered session ${sid} for user ${req.session?.userId || 'admin'}`);
          }
          next();
        });
        return;
      }
    }
    next();
  });

  app.use((req, res, next) => {
    next();
  });

  // Auth Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session || !req.session.userId) {
      console.warn(`[AuthCheck] Unauthorized access attempt to ${req.path}. SessionID: ${req.sessionID}, userId: ${req.session?.userId}`);
      return res.status(401).json({ error: "Non autorisé. Veuillez vous reconnecter." });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session || !req.session.isAdmin) {
      console.warn(`[AdminCheck] Unauthorized admin access attempt to ${req.path}. SessionID: ${req.sessionID}`);
      return res.status(403).json({ error: "Accès refusé. Privilèges administrateur requis." });
    }
    next();
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = Math.random().toString(36).substring(7);
      
      await db.run("INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)", id, email, hashedPassword, name);
      
      const userId = id;
      const userEmail = email;
      const userName = name;
      const userPlan = 'free';
      const userCredits = 30;

      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: "Erreur de session" });
        req.session.userId = userId;
        req.session.save((err) => {
          if (err) return res.status(500).json({ error: "Erreur de session" });
          res.json({ 
            user: { id: userId, email: userEmail, name: userName, plan: userPlan, credits: userCredits },
            sessionId: req.sessionID
          });
        });
      });
    } catch (error: any) {
      if (error.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Cet email est déjà utilisé" });
      }
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user: any = await db.get("SELECT * FROM users WHERE email = ?", email);

    if (user && user.password && await bcrypt.compare(password, user.password)) {
      if (user.two_factor_enabled) {
        req.session.tempUserId = user.id;
        return res.json({ requires2FA: true });
      }
      
      const userId = user.id;
      const userEmail = user.email;
      const userName = user.name;
      const userPlan = user.plan;
      const userCredits = user.credits;
      const userSubExpires = user.subscription_expires_at;

      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: "Erreur de session" });
        req.session.userId = userId;
        req.session.save((err) => {
          if (err) return res.status(500).json({ error: "Erreur de session" });
          res.json({ 
            user: { id: userId, email: userEmail, name: userName, plan: userPlan, credits: userCredits, subscription_expires_at: userSubExpires },
            sessionId: req.sessionID
          });
        });
      });
    } else {
      res.status(401).json({ error: "Identifiants invalides" });
    }
  });

  app.post("/api/auth/otp-request", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "L'email est requis" });

    const user: any = await db.get("SELECT * FROM users WHERE email = ?", email);
    if (!user) {
      return res.status(404).json({ error: "Aucun compte associé à cet email." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await db.run("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON CONFLICT (email) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at", email, otpCode, expiresAt);

    console.log(`[Auth] Code OTP pour ${email}: ${otpCode}`);
    
    res.json({ 
      success: true, 
      message: "Un code de connexion a été généré.",
      devCode: otpCode 
    });
  });

  app.post("/api/auth/otp-verify", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email et code requis" });

    const resetRecord: any = await db.get("SELECT * FROM password_resets WHERE email = ? AND token = ?", email, code);
    
    if (!resetRecord) {
      return res.status(400).json({ error: "Code invalide ou expiré" });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      await db.run("DELETE FROM password_resets WHERE email = ?", email);
      return res.status(400).json({ error: "Ce code a expiré." });
    }

    const user: any = await db.get("SELECT * FROM users WHERE email = ?", email);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

    await db.run("DELETE FROM password_resets WHERE email = ?", email);

    if (user.two_factor_enabled) {
      req.session.tempUserId = user.id;
      return res.json({ requires2FA: true });
    }
    
    const userId = user.id;
    const userEmail = user.email;
    const userName = user.name;
    const userPlan = user.plan;
    const userCredits = user.credits;
    const userSubExpires = user.subscription_expires_at;

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Erreur de session" });
      req.session.userId = userId;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Erreur de session" });
        res.json({ 
          user: { id: userId, email: userEmail, name: userName, plan: userPlan, credits: userCredits, subscription_expires_at: userSubExpires },
          sessionId: req.sessionID
        });
      });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "L'email est requis" });

    const user: any = await db.get("SELECT * FROM users WHERE email = ?", email);
    if (!user) {
      // Pour des raisons de sécurité, on renvoie un succès même si l'email n'existe pas
      return res.json({ success: true, message: "Si cet email existe, un code de réinitialisation a été envoyé." });
    }

    // Générer un code à 6 chiffres
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Sauvegarder dans la base de données
    await db.run("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON CONFLICT (email) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at", email, resetCode, expiresAt);

    console.log(`[Auth] Code de réinitialisation pour ${email}: ${resetCode}`);
    
    // Dans un environnement réel, on enverrait un email ici.
    // Pour cette démo, on renvoie le code dans la réponse pour l'afficher à l'utilisateur.
    res.json({ 
      success: true, 
      message: "Un code de réinitialisation a été généré.",
      devCode: resetCode // Uniquement pour la démo sans serveur d'email
    });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const resetRecord: any = await db.get("SELECT * FROM password_resets WHERE email = ? AND token = ?", email, code);
    
    if (!resetRecord) {
      return res.status(400).json({ error: "Code invalide ou expiré" });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      await db.run("DELETE FROM password_resets WHERE email = ?", email);
      return res.status(400).json({ error: "Ce code a expiré. Veuillez refaire une demande." });
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.run("UPDATE users SET password = ? WHERE email = ?", hashedPassword, email);
      await db.run("DELETE FROM password_resets WHERE email = ?", email);
      
      res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la réinitialisation" });
    }
  });

  app.post("/api/auth/2fa/verify-login", async (req, res) => {
    const { token } = req.body;
    const tempUserId = req.session.tempUserId;

    if (!tempUserId) {
      return res.status(401).json({ error: "Session expirée ou invalide" });
    }

    const user: any = await db.get("SELECT * FROM users WHERE id = ?", tempUserId);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token
    });

    if (verified) {
      const userId = user.id;
      const userEmail = user.email;
      const userName = user.name;
      const userPlan = user.plan;
      const userCredits = user.credits;
      const userSubExpires = user.subscription_expires_at;

      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: "Erreur de session" });
        req.session.userId = userId;
        req.session.save((err) => {
          if (err) return res.status(500).json({ error: "Erreur de session" });
          res.json({ 
            user: { id: userId, email: userEmail, name: userName, plan: userPlan, credits: userCredits, subscription_expires_at: userSubExpires },
            sessionId: req.sessionID
          });
        });
      });
    } else {
      res.status(400).json({ error: "Code 2FA invalide" });
    }
  });

  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    const user: any = await db.get("SELECT * FROM users WHERE id = ?", req.session.userId);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

    const secret = speakeasy.generateSecret({ name: `Bayano Académie (${user.email})` });
    
    await db.run("UPDATE users SET two_factor_secret = ? WHERE id = ?", secret.base32, user.id);

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    res.json({ qrCodeUrl, secret: secret.base32 });
  });

  app.post("/api/auth/2fa/enable", requireAuth, async (req, res) => {
    const { token } = req.body;
    const user: any = await db.get("SELECT * FROM users WHERE id = ?", req.session.userId);
    
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: "Configuration 2FA non initialisée" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token
    });

    if (verified) {
      await db.run("UPDATE users SET two_factor_enabled = 1 WHERE id = ?", user.id);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Code de vérification invalide" });
    }
  });

  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    await db.run("UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?", req.session.userId);
    res.json({ success: true });
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("bayano.sid", {
        secure: true,
        sameSite: 'none',
        httpOnly: true
      });
      res.json({ success: true });
    });
  });



  app.get("/api/auth/token-login", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Jeton manquant" });

    const row: any = await db.get("SELECT user_id FROM temp_login_tokens WHERE token = ? AND created_at > NOW() - INTERVAL '5 minutes'", token);
    
    if (row) {
      // Clean up token
      await db.run("DELETE FROM temp_login_tokens WHERE token = ?", token);
      
      const userId = row.user_id;
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: "Erreur de session" });
        req.session.userId = userId;
        req.session.save(async (err) => {
          if (err) return res.status(500).json({ error: "Erreur de session" });
      const user: any = await db.get("SELECT id, email, name, plan, credits, subscription_expires_at FROM users WHERE id = ?", userId);
          res.json({ user, sessionId: req.sessionID });
        });
      });
    } else {
      res.status(401).json({ error: "Jeton invalide ou expiré" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    console.log(`[AuthMe] SessionID: ${req.sessionID}, UserID: ${req.session.userId}, CookieHeader: ${req.headers.cookie}`);
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });
    const user: any = await db.get("SELECT id, email, name, two_factor_enabled, plan, credits, subscription_expires_at FROM users WHERE id = ?", req.session.userId);
    if (user) {
      res.json({ 
        user: { ...user, twoFactorEnabled: !!user.two_factor_enabled },
        sessionId: req.sessionID
      });
    } else {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    }
  });

  // Google OAuth Routes
  app.get("/api/auth/google/url", async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "Google Client ID non configuré" });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Code manquant");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) throw new Error(tokens.error_description);

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userResponse.json();

      // Find or create user
      let user: any = await db.get("SELECT * FROM users WHERE google_id = ? OR email = ?", googleUser.sub, googleUser.email);

      if (!user) {
        const id = Math.random().toString(36).substring(7);
        db.prepare("INSERT INTO users (id, email, name, google_id, plan, credits) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, googleUser.email, googleUser.name, googleUser.sub, 'free', 30);
        user = { id, email: googleUser.email, name: googleUser.name, plan: 'free', credits: 30 };
      } else if (!user.google_id) {
        await db.run("UPDATE users SET google_id = ? WHERE id = ?", googleUser.sub, user.id);
      }

      req.session.userId = user.id;
      console.log(`[OAuthCallback] UserID set: ${user.id}, SessionID: ${req.sessionID}`);
      
      // Generate a temporary token for the client to "claim" the session
      const loginToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await db.run("INSERT INTO temp_login_tokens (token, user_id) VALUES (?, ?)", loginToken, user.id);

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).send("Erreur de session");
        }
        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_SUCCESS',
                    token: '${loginToken}'
                  }, window.location.origin);
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentification réussie. Cette fenêtre va se fermer...</p>
            </body>
          </html>
        `);
      });
    } catch (error: any) {
      console.error("Google OAuth Error:", error);
      res.status(500).send(`Erreur d'authentification: ${error.message}`);
    }
  });

  // SaaS Routes
  app.get("/api/saas/status", requireAuth, async (req, res) => {
    const user: any = await db.get("SELECT plan, credits, subscription_expires_at FROM users WHERE id = ?", req.session.userId);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  });

  app.post("/api/saas/subscribe", requireAuth, async (req, res) => {
    const { plan } = req.body; // 'student' or 'premium'
    if (!['student', 'premium'].includes(plan)) {
      return res.status(400).json({ error: "Plan invalide" });
    }

    const creditsToAdd = plan === 'student' ? 300 : 800;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    db.prepare("UPDATE users SET plan = ?, credits = credits + ?, subscription_expires_at = ? WHERE id = ?")
      .run(plan, creditsToAdd, expiresAt, req.session.userId);

    db.prepare("INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)")
      .run(Math.random().toString(36).substring(7), req.session.userId, 'subscription', creditsToAdd, `Abonnement ${plan}`);

    res.json({ success: true, plan, creditsAdded: creditsToAdd, expiresAt });
  });

  app.post("/api/saas/buy-credits", requireAuth, async (req, res) => {
    const { pack } = req.body; // 'mini' (50), 'medium' (150), 'memoire' (400)
    let creditsToAdd = 0;
    if (pack === 'mini') creditsToAdd = 50;
    else if (pack === 'medium') creditsToAdd = 150;
    else if (pack === 'memoire') creditsToAdd = 400;
    else return res.status(400).json({ error: "Pack invalide" });

    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
      .run(creditsToAdd, req.session.userId);

    db.prepare("INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)")
      .run(Math.random().toString(36).substring(7), req.session.userId, 'pack', creditsToAdd, `Achat pack ${pack}`);

    res.json({ success: true, creditsAdded: creditsToAdd });
  });

  app.post("/api/saas/estimate", requireAuth, async (req, res) => {
    const { type, pages } = req.body; // type: 'plan' or 'generation'
    let estimatedCredits = 0;
    if (type === 'plan') {
      estimatedCredits = 2; // Fixed cost for plan
    } else if (type === 'generation') {
      // 1 page = ~250 words = 1 credit
      estimatedCredits = pages || 1;
    }
    
    const user: any = await db.get("SELECT credits, plan FROM users WHERE id = ?", req.session.userId);
    
    res.json({ 
      estimatedCredits, 
      hasEnough: user.credits >= estimatedCredits,
      currentCredits: user.credits,
      plan: user.plan
    });
  });

  app.post("/api/saas/deduct", requireAuth, async (req, res) => {
    const { amount, description } = req.body;
    const user: any = await db.get("SELECT credits FROM users WHERE id = ?", req.session.userId);
    
    if (user.credits < amount) {
      return res.status(402).json({ error: "Crédits insuffisants" });
    }

    await db.run("UPDATE users SET credits = credits - ? WHERE id = ?", amount, req.session.userId);
    db.prepare("INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)")
      .run(Math.random().toString(36).substring(7), req.session.userId, 'usage', -amount, description);

    res.json({ success: true, remainingCredits: user.credits - amount });
  });

// Project Routes
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await db.all("SELECT id, user_id, title, field, university, country, level, norm, min_pages, instructions, reference_text, methodology, documentType, generationMode, language, aiModel, plan, status, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC", req.session.userId);
      res.json(projects);
    } catch (err) {
      console.error("Get projects error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des projets" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
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

  app.post("/api/projects/:id/docx", requireAuth, async (req, res) => {
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

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
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

  app.get("/api/projects/:id/chapters", requireAuth, async (req, res) => {
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

  app.patch("/api/projects/:id/plan", requireAuth, (req, res) => {
    try {
      const { plan } = req.body;
      db.prepare("UPDATE projects SET plan = ?, status = 'plan_validated' WHERE id = ? AND user_id = ?")
        .run(JSON.stringify(plan), req.params.id, req.session.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Update plan error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du plan" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
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

  app.get("/api/chapters", requireAuth, async (req, res) => {
    const chapters = await db.all(`
      SELECT c.* FROM chapters c 
      JOIN projects p ON c.project_id = p.id 
      WHERE p.user_id = ?
    `, req.session.userId);
    res.json(chapters);
  });

  app.post("/api/chapters", requireAuth, async (req, res) => {
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
  });

  // Chat Sessions Routes
  app.get("/api/chat-sessions", requireAuth, async (req, res) => {
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

  app.post("/api/chat-sessions", requireAuth, async (req, res) => {
    try {
      const session = req.body;
      const existing = await db.get("SELECT user_id FROM chat_sessions WHERE id = ?", session.id) as any;
      if (existing && existing.user_id !== req.session.userId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      const stmt = db.prepare(`
        INSERT INTO chat_sessions (id, user_id, title, messages, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, messages=EXCLUDED.messages, updated_at=CURRENT_TIMESTAMP
      `);
      stmt.run(
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

  app.delete("/api/chat-sessions/:id", requireAuth, async (req, res) => {
    try {
      await db.run("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", req.params.id, req.session.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete chat session error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la discussion" });
    }
  });

  // Admin Routes
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;
      const currentSettingsRows = await db.all("SELECT * FROM settings");
      const currentSettings: any = {};
      currentSettingsRows.forEach((row: any) => {
        currentSettings[row.key] = row.value;
      });
      
      const adminPassword = currentSettings.adminPassword || 'admin';
      
      if (password === adminPassword) {
        req.session.regenerate((err) => {
          if (err) {
            console.error("Session regenerate error:", err);
            return res.status(500).json({ error: "Erreur de session" });
          }
          req.session.isAdmin = true;
          req.session.save((err: any) => {
            if (err) {
              console.error("Session save error:", err);
              return res.status(500).json({ error: "Erreur de session" });
            }
            res.json({ success: true, sessionId: req.sessionID });
          });
        });
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } catch (err) {
      console.error("Admin login error:", err);
      res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    if (req.session) {
      req.session.destroy((err: any) => {
        if (err) console.error("Session destroy error on logout:", err);
        res.clearCookie("bayano_sid_v4", {
          secure: true,
          sameSite: 'none',
          httpOnly: true
        });
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
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

      db.prepare("UPDATE users SET plan = ?, credits = ?, subscription_expires_at = ?, status = ? WHERE id = ?")
        .run(plan, credits, expiresAt, status || 'active', userId);
        
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

  app.post("/api/log-error", async (req, res) => {
    try {
      const { message, stack, context } = req.body;
      const userId = req.session?.userId || null;
      db.prepare("INSERT INTO error_logs (id, user_id, error_message, error_stack, context) VALUES (?, ?, ?, ?, ?)")
        .run(crypto.randomUUID(), userId, message, stack, JSON.stringify(context));
      res.json({ success: true });
    } catch (err) {
      console.error("Log error failed:", err);
      res.status(500).json({ error: "Failed to log error" });
    }
  });

  // Settings Routes
  app.get("/api/settings", async (req, res) => {
    const rows = await db.all("SELECT * FROM settings");
    const settings: any = {
      priceStudent: 9.99,
      pricePremium: 24.99,
      pricePackMini: 4.99,
      pricePackMedium: 12.99,
      pricePackMemoire: 29.99,
      globalDiscount: 0,
    };
    rows.forEach((row: any) => {
      // Only send adminPassword if the user is an admin
      if (row.key !== 'adminPassword' || (req.session && req.session.isAdmin)) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      }
    });
    res.json(settings);
  });

  app.post("/api/settings", requireAdmin, async (req, res) => {
    try {
      const { settings } = req.body;
      
      const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
      for (const [key, value] of Object.entries(settings)) {
        // If the client sends the default 'admin' password but the DB has a different one, don't overwrite it
        // unless they explicitly changed it. Actually, since GET /api/settings now returns the real password
        // for admins, the client will send the real password back.
        // We just need to make sure we don't accidentally save 'admin' if the client didn't get the real password.
        if (key === 'adminPassword' && value === 'admin') {
           const current = await db.get("SELECT value FROM settings WHERE key = 'adminPassword'") as any;
           if (current && current.value !== 'admin') {
             continue; // Skip overwriting with default 'admin' if a custom password exists
           }
        }
        await stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", async (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
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
