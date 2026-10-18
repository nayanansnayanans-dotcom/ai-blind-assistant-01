const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  questionText: { type: String, required: true },
  options: [String],
  correctAnswer: String,
  studentAnswer: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Not Answered', 'Answered', 'Review'], 
    default: 'Not Answered' 
  }
}, { bufferCommands: false });

const examSchema = new mongoose.Schema({
  examTitle: { type: String, required: true },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  duration: { type: String, required: true },
  instructions: { type: String },
  questions: [questionSchema],
  status: { 
    type: String, 
    enum: ['Pending', 'Today', 'Completed'], 
    default: 'Pending' 
  },
  isOfflineCached: { type: Boolean, default: false }
}, { bufferCommands: false });

module.exports = mongoose.models.Exam || mongoose.model('Exam', examSchema);