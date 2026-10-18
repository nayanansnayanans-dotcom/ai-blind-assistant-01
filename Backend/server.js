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

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Backend is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api', teacherRoutes);
app.use('/api/student-exams', examRoutes);
app.use('/api', apiRoutes);

const port = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(port, () => console.log(`Backend running at http://localhost:${port}`));
});
