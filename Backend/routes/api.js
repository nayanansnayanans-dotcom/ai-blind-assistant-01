const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Log = require('../models/Log');

// Save a new question and its answer
router.post('/questions', async (req, res) => {
  try {
    const { questionText, answerText, category, language } = req.body;
    const newQuestion = new Question({ questionText, answerText, category, language });
    await newQuestion.save();
    
    // Log the successful interaction
    await Log.create({ featureUsed: 'exam-assistance', status: 'success', details: 'Saved question history' });
    
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch recent activity logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;