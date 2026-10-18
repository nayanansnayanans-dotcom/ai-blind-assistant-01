const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  answerText: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['exam', 'general', 'ocr', 'translation'],
    default: 'general'
  },
  language: {
    type: String,
    default: 'en'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Question', questionSchema);