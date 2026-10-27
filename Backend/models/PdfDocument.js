const mongoose = require('mongoose');

const pdfSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const PdfDocument = mongoose.models.PdfDocument || mongoose.model('PdfDocument', pdfSchema);
module.exports = PdfDocument;
