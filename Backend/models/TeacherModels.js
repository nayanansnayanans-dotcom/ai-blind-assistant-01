const mongoose = require('mongoose');

// Exam Schema
const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  durationMinutes: { type: Number, required: true },
  date: String,
  startTime: String,
  passingMarks: Number,
  instructions: String,
  status: { type: String, enum: ['Draft', 'Scheduled', 'Published', 'Completed'], default: 'Draft' },
  assignedStudents: [{ type: String }],
  targetStudentEmail: { type: String, default: '' },
  targetStudentName: { type: String, default: '' },
  accessibilitySettings: { type: mongoose.Schema.Types.Mixed, default: {} },
  languages: [{ type: String, default: 'en' }],
  defaultLanguage: { type: String, default: 'en' },
  questions: [{
    questionNumber: Number,
    questionText: { type: String, required: true },
    questionType: { type: String, default: 'MCQ' },
    marks: { type: Number, default: 1 },
    difficulty: { type: String, default: 'Medium' },
    options: [String],
    correctAnswer: { type: String, default: '' },
    translations: { type: mongoose.Schema.Types.Mixed, default: {} }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  creatorEmail: { type: String, default: '' },
  teacherEmail: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { bufferCommands: false });

// Student Result Schema
const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentName: { type: String, default: 'Student' },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  examTitle: { type: String, default: 'Exam' },
  examLanguage: { type: String, default: 'en' },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  answersLog: [{
    questionIndex: Number,
    questionText: String,
    studentAnswer: String,
    translatedAnswer: String,
    language: String,
    transcript: String,
    isCorrect: Boolean
  }],
  submittedAt: { type: Date, default: Date.now }
}, { bufferCommands: false });

// Student Emergency SOS / Assistance Request Schema
const assistanceRequestSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  studentId: { type: String, default: '2026011001' },
  examTitle: { type: String, default: 'General Platform Navigation' },
  request: { type: String, default: '🚨 Emergency SOS triggered by student. Requires immediate audio assist.' },
  time: { type: String, default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  type: { type: String, default: 'Emergency SOS' },
  status: { type: String, enum: ['Pending', 'Responded via Text', 'Responded via Voice', 'Resolved'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
}, { bufferCommands: false });

const Exam = mongoose.models.Exam || mongoose.model('Exam', examSchema);
const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);
const AssistanceRequest = mongoose.models.AssistanceRequest || mongoose.model('AssistanceRequest', assistanceRequestSchema);

module.exports = { Exam, Result, AssistanceRequest };
