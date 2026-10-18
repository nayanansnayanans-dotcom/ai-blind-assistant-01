const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  featureUsed: {
    type: String,
    required: true,
    enum: ['voice-assistant', 'ocr', 'object-detection', 'face-recognition', 'currency-recognition', 'navigation', 'exam-assistance']
  },
  status: {
    type: String,
    enum: ['success', 'error', 'pending'],
    default: 'success'
  },
  details: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Log', logSchema);