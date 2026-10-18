// models/PdfDocument.js
const mongoose = require('mongoose');

const pdfSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PdfDocument', pdfSchema);

// models/ExamSubmission.js
const examSubmissionSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  examId: { type: String, required: true },
  score: { type: Number, required: true },
  answers: { type: Array, required: true },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamSubmission', examSubmissionSchema);