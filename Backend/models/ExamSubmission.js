const mongoose = require('mongoose');

const examSubmissionSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  examId: { type: String, required: true },
  score: { type: Number, required: true },
  answers: { type: Array, required: true },
  submittedAt: { type: Date, default: Date.now }
});

const ExamSubmission = mongoose.models.ExamSubmission || mongoose.model('ExamSubmission', examSubmissionSchema);
module.exports = ExamSubmission;
