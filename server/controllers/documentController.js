const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Document = require('../models/documentModel');
const aiService = require('../services/aiService');
const resp = require('../utils/responseHelper');

function hasTextLayer(text) {
  return text && text.trim().length > 20;
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Cleanup: Deleted file:', filePath);
    }
  } catch (err) {
    console.error('Cleanup: Failed to delete file:', err.message);
  }
}

const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return resp.badRequest(res, 'No file uploaded');
    }

    const filePath = req.file.path;
    console.log('Upload: File received:', req.file.originalname, 'saved to:', filePath);
    console.log('Upload: File size:', getFileSize(filePath), 'bytes');

    // Validate PDF header
    const dataBuffer = fs.readFileSync(filePath);
    const header = dataBuffer.slice(0, 8).toString();
    if (!header.startsWith('%PDF')) {
      cleanupFile(filePath);
      return resp.badRequest(res, 'File is not a valid PDF (invalid header)');
    }

    let extractedText = '';
    let pdfInfo = { numpages: 0 };
    let parseSucceeded = false;

    try {
      const data = await pdfParse(dataBuffer);
      extractedText = data.text || '';
      pdfInfo = { numpages: data.numpages || 0 };
      parseSucceeded = true;
      console.log('Upload: Extracted text length:', extractedText.length, 'chars, pages:', pdfInfo.numpages);
      if (hasTextLayer(extractedText)) {
        console.log('Upload: Text preview:', extractedText.substring(0, 200));
      }
    } catch (parseError) {
      console.error('Upload: PDF Parse Error:', parseError.message);
    }

    const hasText = hasTextLayer(extractedText);

    const document = await Document.create({
      userId: req.user._id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      extractedText: hasText ? extractedText : '(No extractable text - scanned/image PDF)',
      pages: pdfInfo.numpages,
      status: 'uploaded'
    });

    console.log('Upload: Document saved to DB with ID:', document._id);

    // Clean up uploaded file after successful processing
    if (parseSucceeded) {
      cleanupFile(filePath);
    }

    resp.created(res, {
      ...document.toObject(),
      scannedPdf: !hasText,
      message: hasText
        ? 'PDF uploaded and text extracted successfully'
        : 'PDF uploaded but it appears to be scanned or image-based. Text analysis may not work without OCR.'
    }, hasText ? 'PDF uploaded successfully' : 'PDF uploaded but text extraction failed');
  } catch (error) {
    // Clean up on error too
    if (req.file && req.file.path) {
      cleanupFile(req.file.path);
    }
    next(error);
  }
};

const analyzeDocument = async (req, res, next) => {
  try {
    const body = req.body || {};
    const language = body.language || 'English';
    console.log('Analyze: Request for document ID:', req.params.id);

    const document = await Document.findById(req.params.id);
    if (!document) {
      return resp.notFound(res, 'Document not found');
    }

    if (document.userId.toString() !== req.user._id.toString()) {
      return resp.unauthorized(res, 'Not authorized to access this document');
    }

    const textToAnalyze = document.extractedText || '';
    if (!hasTextLayer(textToAnalyze)) {
      return resp.badRequest(res,
        'This PDF appears to be scanned or image-based. OCR processing is required to extract text for analysis.',
        { scannedPdf: true }
      );
    }

    document.status = 'processing';
    await document.save();
    console.log('Analyze: Document status set to processing, text length:', textToAnalyze.length);

    console.log('Analyze: Calling AI service...');
    const aiAnalysis = await aiService.analyzeLegalDocument(textToAnalyze, language);

    document.aiAnalysis = aiAnalysis;
    document.riskScore = (typeof aiAnalysis.riskScore === 'number') ? aiAnalysis.riskScore : 0;
    document.language = language;
    document.status = 'analyzed';
    await document.save();

    console.log('Analyze: Analysis complete, risk score:', document.riskScore);
    resp.success(res, document.toObject(), 'Analysis completed successfully');
  } catch (error) {
    // If AI analysis fails, set status back to uploaded
    try {
      const doc = await Document.findById(req.params.id);
      if (doc && doc.status === 'processing') {
        doc.status = 'error';
        await doc.save();
      }
    } catch { /* ignore cleanup errors */ }
    next(error);
  }
};

const getMyDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });
    resp.success(res, documents);
  } catch (error) {
    next(error);
  }
};

const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return resp.notFound(res, 'Document not found');
    }
    if (document.userId.toString() !== req.user._id.toString()) {
      return resp.unauthorized(res, 'Not authorized to access this document');
    }
    resp.success(res, document.toObject());
  } catch (error) {
    next(error);
  }
};

const reanalyzeDocument = async (req, res, next) => {
  try {
    const body = req.body || {};
    const explainMode = body.explainMode || 'normal';
    const language = body.language || 'English';
    console.log(`Reanalyze: Request for doc ${req.params.id}, mode=${explainMode}, lang=${language}`);

    const document = await Document.findById(req.params.id);
    if (!document) return resp.notFound(res, 'Document not found');
    if (document.userId.toString() !== req.user._id.toString()) return resp.unauthorized(res, 'Not authorized');

    const textToAnalyze = document.extractedText || '';
    if (!hasTextLayer(textToAnalyze)) {
      return resp.badRequest(res, 'Document text is not available for re-analysis');
    }

    console.log(`Reanalyze: Calling AI service with mode=${explainMode}`);
    const reanalyzed = await aiService.analyzeLegalDocument(textToAnalyze, language, explainMode);
    console.log(`Reanalyze: Complete for mode=${explainMode}`);

    resp.success(res, { reanalyzedAnalysis: reanalyzed, explainMode, language }, `Re-analysis complete for ${explainMode} mode`);
  } catch (error) {
    next(error);
  }
};

const translateDocument = async (req, res, next) => {
  try {
    const body = req.body || {};
    const targetLanguage = body.language || 'Hindi';
    console.log('Translate: Request for document ID:', req.params.id, 'target:', targetLanguage);

    const document = await Document.findById(req.params.id);
    if (!document) {
      return resp.notFound(res, 'Document not found');
    }
    if (document.userId.toString() !== req.user._id.toString()) {
      return resp.unauthorized(res, 'Not authorized to access this document');
    }
    if (!document.aiAnalysis) {
      return resp.badRequest(res, 'Document has not been analyzed yet');
    }

    console.log('Translate: Calling AI translation service...');
    const translatedAnalysis = await aiService.translateAnalysis(document.aiAnalysis, targetLanguage);

    console.log('Translate: Translation complete for', targetLanguage);
    resp.success(res, { translatedAnalysis, language: targetLanguage }, 'Translation completed');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  analyzeDocument,
  reanalyzeDocument,
  translateDocument,
  getMyDocuments,
  getDocumentById
};
