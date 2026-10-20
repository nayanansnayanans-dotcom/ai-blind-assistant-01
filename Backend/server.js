const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
// Globally disable Mongoose query buffering so offline queries fail fast & use fallbacks
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 500);

const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/authRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const examRoutes = require('./routes/examRoutes');
const ttsRoutes = require('./routes/ttsRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 1. API routes
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Backend is running' }));
app.get('/api/debug-paths', (_req, res) => {
  const fs = require('fs');
  res.json({
    __dirname,
    cwd: process.cwd(),
    publicDir,
    publicExists: fs.existsSync(publicDir),
    dirContents: fs.readdirSync(__dirname),
    cwdContents: fs.readdirSync(process.cwd()),
    publicContents: fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : null,
    assetsExists: fs.existsSync(path.join(publicDir, 'assets')) ? fs.readdirSync(path.join(publicDir, 'assets')) : null
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api', teacherRoutes);
app.use('/api/student-exams', examRoutes);
app.use('/api', apiRoutes);

// 2. Static Frontend file serving
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// 3. Fallback for Single Page Application (SPA) client routes (Express 4 & 5 safe)
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>VisionAssist AI</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;">
          <h2>VisionAssist AI Server is Running</h2>
          <p>API endpoints are active at <code>/api/...</code></p>
        </body>
        </html>
      `);
    }
  });
});

const port = process.env.PORT || 5000;
connectDB().then(() => {
  if (!process.env.VERCEL) {
    app.listen(port, () => console.log(`Backend running at http://localhost:${port}`));
  }
}).catch((err) => {
  console.error('Database connection error:', err);
  if (!process.env.VERCEL) {
    app.listen(port, () => console.log(`Backend running with fallbacks at http://localhost:${port}`));
  }
});

module.exports = app;

