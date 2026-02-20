import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";
// @ts-ignore
import pdf from "pdf-parse/lib/pdf-parse.js";
// @ts-ignore
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("[Server] Starting AcademiaGen...");

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    console.log("[Server] Initializing SQLite Database...");
    const db = new Database("academia.db");
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT,
        field TEXT,
        university TEXT,
        country TEXT,
        level TEXT,
        norm TEXT,
        min_pages INTEGER,
        plan TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        content TEXT,
        order_index INTEGER,
        word_count INTEGER,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
    `);

    app.use(express.json({ limit: '50mb' }));
    const upload = multer({ storage: multer.memoryStorage() });

    // API Routes
    app.get("/api/health", (req, res) => res.json({ status: "ok" }));

    app.get("/api/projects", (req, res) => {
      try {
        const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
        res.json(projects);
      } catch (err) {
        console.error("Error fetching projects:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/api/projects", (req, res) => {
      try {
        const { id, title, field, university, country, level, norm, min_pages } = req.body;
        db.prepare(`
          INSERT INTO projects (id, title, field, university, country, level, norm, min_pages, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `).run(id, title, field, university, country, level, norm, min_pages);
        res.json({ success: true });
      } catch (err) {
        console.error("Error creating project:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/api/projects/:id", (req, res) => {
      try {
        const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
        const chapters = db.prepare("SELECT * FROM chapters WHERE project_id = ? ORDER BY order_index").all(req.params.id);
        res.json({ ...project, chapters });
      } catch (err) {
        console.error("Error fetching project details:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.put("/api/projects/:id/plan", (req, res) => {
      try {
        const { plan } = req.body;
        db.prepare("UPDATE projects SET plan = ?, status = 'plan_validated' WHERE id = ?").run(JSON.stringify(plan), req.params.id);
        res.json({ success: true });
      } catch (err) {
        console.error("Error updating plan:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/api/projects/:id/chapters", (req, res) => {
      try {
        const { id: chapterId, title, content, order_index, word_count } = req.body;
        db.prepare(`
          INSERT OR REPLACE INTO chapters (id, project_id, title, content, order_index, word_count)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(chapterId, req.params.id, title, content, order_index, word_count);
        res.json({ success: true });
      } catch (err) {
        console.error("Error saving chapter:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/api/parse-model", upload.single('file'), async (req, res) => {
      if (!req.file) return res.status(400).send('No file uploaded.');
      
      try {
        if (req.file.mimetype === 'application/pdf') {
          const data = await pdf(req.file.buffer);
          res.json({ text: data.text });
        } else {
          res.status(400).send('Unsupported file type. Please upload a PDF.');
        }
      } catch (error) {
        console.error("Error parsing PDF:", error);
        res.status(500).send('Error parsing file.');
      }
    });

    app.post("/api/export/docx", async (req, res) => {
      try {
        const { title, chapters } = req.body;
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                text: title,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({ text: "\n\n" }),
              ...chapters.flatMap((ch: any) => [
                new Paragraph({
                  text: ch.title,
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                  children: [new TextRun(ch.content)],
                }),
              ]),
            ],
          }],
        });

        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(title)}.docx`);
        res.send(buffer);
      } catch (err) {
        console.error("Error exporting DOCX:", err);
        res.status(500).send("Error exporting document");
      }
    });

    // Vite middleware for development
    console.log("[Server] Setting up Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] AcademiaGen is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("[Server] CRITICAL ERROR DURING STARTUP:", error);
    process.exit(1);
  }
}

startServer();
