import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes.js';
import { initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and json parsing
app.use(cors());
app.use(express.json());

// Bind API routes
app.use('/api', apiRouter);

// Serve static files in production
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all route to serve the Single Page Application index.html
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

// Start database and then start server
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Express Gym Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Critical failure initiating database / server startup:', err);
    process.exit(1);
  }
}

startServer();
