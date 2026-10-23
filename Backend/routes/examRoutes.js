const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Exam = require('../models/Exam');

const isDbConnected = () => mongoose.connection.readyState === 1;

const mockStudentExams = [];

// Get all student exams
router.get('/', async (req, res) => {
  if (!isDbConnected()) {
    return res.json([]);
  }
  try {
    const exams = await Exam.find().setOptions({ bufferCommands: false });
    res.json(exams);
  } catch (err) {
    res.json([]);
  }
});

// Update student answer & status
router.put('/:examId/question/:qNum', async (req, res) => {
  if (!isDbConnected()) {
    const exam = mockStudentExams.find(e => e._id === req.params.examId) || mockStudentExams[0];
    const question = exam.questions.find(q => q.questionNumber == req.params.qNum);
    if (question) {
      if (req.body.studentAnswer !== undefined) question.studentAnswer = req.body.studentAnswer;
      if (req.body.status) question.status = req.body.status;
    }
    return res.json({ message: 'Answer saved successfully (Offline)', question });
  }

  try {
    const { studentAnswer, status } = req.body;
    const exam = await Exam.findById(req.params.examId).setOptions({ bufferCommands: false });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    
    const question = exam.questions.find(q => q.questionNumber == req.params.qNum);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    if (studentAnswer !== undefined) question.studentAnswer = studentAnswer;
    if (status) question.status = status;

    await exam.save();
    res.json({ message: 'Answer saved successfully', question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;