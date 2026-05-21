const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    default: ''
  },
  pages: {
    type: Number,
    default: 0
  },
  aiAnalysis: {
    type: Object,
    default: null
  },
  riskScore: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    default: 'English'
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'analyzed', 'error'],
    default: 'uploaded'
  }
}, {
  timestamps: true
});

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
