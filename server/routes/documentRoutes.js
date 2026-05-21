const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
  uploadDocument,
  analyzeDocument,
  reanalyzeDocument,
  translateDocument,
  getMyDocuments,
  getDocumentById
} = require('../controllers/documentController');

// All routes are protected
router.use(protect);

router.post('/upload', upload.single('document'), uploadDocument);
router.post('/:id/analyze', analyzeDocument);
router.post('/:id/translate', translateDocument);
router.post('/:id/reanalyze', reanalyzeDocument);
router.get('/', getMyDocuments);
router.get('/:id', getDocumentById);

module.exports = router;
