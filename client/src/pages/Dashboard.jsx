import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSelector from '../components/LanguageSelector';
import TtsControls from '../components/TtsControls';
import { useSpeech } from '../hooks/useSpeech';
import {
  UploadCloud, FileText, AlertTriangle, CheckCircle,
  ChevronRight, Loader2, X, RefreshCw, Eye, EyeOff,
  Type, Sun, Moon
} from 'lucide-react';

const EXPLAIN_MODES = [
  { id: 'lawyer', label: 'Lawyer', desc: 'Precise legal terminology' },
  { id: 'normal', label: 'Normal Person', desc: 'Everyday language' },
  { id: 'teen', label: '18 Year Old', desc: 'Simple and straightforward' },
  { id: 'village', label: 'Village Language', desc: 'Very basic terms' },
  { id: 'business', label: 'Business Owner', desc: 'Practical risk-focused' }
];

const Dashboard = () => {
  const { user, api, aiApi, uploadApi, fastApi } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Request cancellation
  const abortRef = useRef(null);
  const cancelPrevious = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    return abortRef.current;
  };

  // Translation
  const [selectedLang, setSelectedLang] = useState('English');
  const [translatedAnalysis, setTranslatedAnalysis] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const translationsCache = useRef(new Map());

  // Premium TTS
  const { state: ttsState, speakAnalysis, pause, resume, stop, isSupported: isTtsSupported } = useSpeech();

  // Accessibility
  const [accessibilityMode, setAccessibilityMode] = useState('none');
  const accessibilityCycle = ['none', 'large-text', 'high-contrast', 'dyslexia-friendly'];

  // Explain mode
  const [explainMode, setExplainMode] = useState('normal');
  const [modeAnalysis, setModeAnalysis] = useState(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const modeAnalysisCache = useRef(new Map());

  const fetchDocuments = useCallback(async () => {
    try {
      setFetchError('');
      const { data } = await fastApi.get('/documents');
      const docs = data.data || data;
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') {
        console.error('Failed to fetch documents', error);
        setFetchError(error.code === 'ECONNABORTED' ? 'Request timed out. Please try again.' : 'Failed to load documents.');
      }
    }
  }, [fastApi]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Stop speech and cancel pending requests on language or explain mode change
  useEffect(() => {
    stop();
    cancelPrevious();
  }, [selectedLang, explainMode, stop]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('document', file);

    let uploadedDoc = null;

    try {
      const uploadAbort = new AbortController();
      const uploadResponse = await uploadApi.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: uploadAbort.signal,
        timeout: 180000
      });
      uploadedDoc = uploadResponse.data.data || uploadResponse.data;

      if (uploadedDoc.scannedPdf) {
        setDocuments([uploadedDoc, ...documents]);
        setUploadError(uploadedDoc.message || 'PDF uploaded but appears to be scanned. OCR is needed for analysis.');
        setIsUploading(false);
        return;
      }

      // Analyze with retry on timeout
      let analyzeResponse;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = cancelPrevious();
          analyzeResponse = await aiApi.post(`/documents/${uploadedDoc._id}/analyze`,
            { language: 'English' },
            { signal: controller.signal }
          );
          break;
        } catch (err) {
          if (err.code === 'ECONNABORTED' && attempt === 0) {
            continue;
          }
          throw err;
        }
      }
      const analyzedDoc = analyzeResponse.data.data || analyzeResponse.data;
      setDocuments([analyzedDoc, ...documents]);
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;
      console.error('Upload/Analyze error:', error.response?.data || error.message);
      const errData = error.response?.data || {};
      if (uploadedDoc && errData.scannedPdf) {
        setDocuments([uploadedDoc, ...documents]);
      }
      const msg = error.code === 'ECONNABORTED'
        ? 'AI analysis is taking longer than expected. Please try again.'
        : (errData.message || errData.error || 'Failed to process document');
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const openDocument = (doc) => {
    cancelPrevious();
    stop();
    setSelectedDoc(doc);
    setSelectedLang('English');
    setTranslatedAnalysis(null);
    setModeAnalysis(null);
    setExplainMode('normal');
    modeAnalysisCache.current.clear();
    setIsModalOpen(true);
  };

  const getRiskColor = (score) => {
    if (score > 50) return 'bg-accent/20 text-accent';
    if (score > 20) return 'bg-yellow-500/20 text-yellow-500';
    return 'bg-green-500/20 text-green-500';
  };

  const getRiskIcon = (score) => {
    return score > 50 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />;
  };

  const isAnalyzed = (doc) => doc.status === 'analyzed' || (doc.aiAnalysis && doc.riskScore !== undefined);

  // Translation
  const handleLanguageChange = async (lang) => {
    setSelectedLang(lang);
    if (lang === 'English') {
      setTranslatedAnalysis(null);
      return;
    }

    const cacheKey = `${selectedDoc._id}_${lang}_${explainMode}`;
    if (translationsCache.current.has(cacheKey)) {
      setTranslatedAnalysis(translationsCache.current.get(cacheKey));
      return;
    }

    setIsTranslating(true);
    try {
      const controller = cancelPrevious();
      const { data: resData } = await aiApi.post(`/documents/${selectedDoc._id}/translate`,
        { language: lang },
        { signal: controller.signal }
      );
      const result = resData.data || resData;
      translationsCache.current.set(cacheKey, result.translatedAnalysis);
      setTranslatedAnalysis(result.translatedAnalysis);
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;
      const msg = error.code === 'ECONNABORTED'
        ? 'Translation timed out. Please try again.'
        : 'Translation failed.';
      console.error('Translation error:', msg, error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Re-analysis for explain modes
  const reanalyzeForMode = useCallback(async (mode, lang) => {
    if (!selectedDoc?._id) return;
    const cacheKey = `${selectedDoc._id}_${mode}_${lang}`;
    if (modeAnalysisCache.current.has(cacheKey)) {
      setModeAnalysis(modeAnalysisCache.current.get(cacheKey));
      return;
    }
    setIsReanalyzing(true);
    try {
      console.log('Reanalyzing for mode:', mode, 'lang:', lang);
      const controller = cancelPrevious();
      const { data: resData } = await aiApi.post(`/documents/${selectedDoc._id}/reanalyze`,
        { explainMode: mode, language: lang },
        { signal: controller.signal }
      );
      const result = resData.data || resData;
      modeAnalysisCache.current.set(cacheKey, result.reanalyzedAnalysis);
      setModeAnalysis(result.reanalyzedAnalysis);
      translationsCache.current.clear();
      setTranslatedAnalysis(null);
      console.log('Reanalysis complete for mode:', mode);
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;
      const msg = error.code === 'ECONNABORTED'
        ? 'AI rewriting timed out. Please try again.'
        : 'Re-analysis failed.';
      console.error('Re-analysis error:', msg, error.response?.data || error.message);
    } finally {
      setIsReanalyzing(false);
    }
  }, [selectedDoc?._id, aiApi]);

  // Trigger re-analysis when explain mode changes
  useEffect(() => {
    if (!selectedDoc?._id || !selectedDoc?.aiAnalysis) return;
    if (explainMode === 'normal') {
      setModeAnalysis(null);
      return;
    }
    reanalyzeForMode(explainMode, selectedLang);
  }, [explainMode, selectedLang, selectedDoc?._id, reanalyzeForMode]);

  const getActiveAnalysis = () => {
    if (explainMode !== 'normal' && modeAnalysis) {
      return modeAnalysis;
    }
    if (selectedLang !== 'English' && translatedAnalysis) {
      return translatedAnalysis;
    }
    return selectedDoc?.aiAnalysis || {};
  };

  // TTS - handled by useSpeech hook

  // Accessibility
  const cycleAccessibility = () => {
    const idx = accessibilityCycle.indexOf(accessibilityMode);
    setAccessibilityMode(accessibilityCycle[(idx + 1) % accessibilityCycle.length]);
  };

  const getAccessibilityClasses = () => {
    switch (accessibilityMode) {
      case 'large-text':
        return 'text-lg leading-relaxed [&_h2]:text-3xl [&_h3]:text-2xl [&_p]:text-lg [&_li]:text-lg [&_blockquote]:text-base';
      case 'high-contrast':
        return '[&_.glass-panel]:bg-black/90 [&_.glass-panel]:border-white/30 [&_p]:text-white [&_h2]:text-white [&_h3]:text-white';
      case 'dyslexia-friendly':
        return 'tracking-wider leading-[2] [&_p]:mb-6 [&_li]:mb-3';
      default:
        return '';
    }
  };

  const getAccessibilityIcon = () => {
    switch (accessibilityMode) {
      case 'large-text': return <Type className="w-4 h-4" />;
      case 'high-contrast': return <Sun className="w-4 h-4" />;
      case 'dyslexia-friendly': return <Eye className="w-4 h-4" />;
      default: return <EyeOff className="w-4 h-4" />;
    }
  };

  // Explain mode
  const getExplainModePrefix = () => {
    const mode = EXPLAIN_MODES.find(m => m.id === explainMode);
    return mode ? mode.desc : '';
  };

  const analysis = getActiveAnalysis();

  return (
    <div className={`flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex flex-col md:flex-row gap-8 ${getAccessibilityClasses()}`}>

      {/* Sidebar */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-panel p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-4">Analyze New Document</h2>
          <div className="relative border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 text-center bg-surface/50">
            <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-muted font-medium text-sm">Uploading and analyzing with AI...</p>
                <p className="text-xs text-muted/50 mt-1">This might take a minute</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium">Click or drag PDF here</p>
                <p className="text-sm text-muted mt-1">Max file size 10MB</p>
              </div>
            )}
          </div>
          {uploadError && <p className="text-accent text-sm mt-3 text-center">{uploadError}</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold mb-4">Your Dashboard</h3>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted">Total Documents</span>
            <span className="font-bold">{documents.length}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted">Analyzed</span>
            <span className="font-bold">{documents.filter(isAnalyzed).length}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted">Accessibility</span>
            <button onClick={cycleAccessibility}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-primary/20 transition-colors text-xs font-medium text-muted hover:text-text">
              {getAccessibilityIcon()}
              <span>{accessibilityMode === 'none' ? 'Off' : accessibilityMode.replace('-', ' ')}</span>
            </button>
          </div>
          {fetchError && (
            <button onClick={fetchDocuments}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:text-primary/80 transition-colors">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="w-full md:w-2/3 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent Analyses</h2>
          <button onClick={fetchDocuments}
            className="p-2 rounded-lg hover:bg-surface transition-colors text-muted hover:text-text" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="glass-panel p-10 text-center rounded-2xl border-dashed border border-border">
              <FileText className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-lg font-medium text-muted">No documents analyzed yet.</p>
              <p className="text-sm text-muted/70 mt-1">Upload a PDF to get started.</p>
            </div>
          ) : (
            documents.map((doc, idx) => (
              <motion.div key={doc._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }} onClick={() => openDocument(doc)}
                className="glass-panel p-5 rounded-2xl glass-panel-hover cursor-pointer flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getRiskColor(doc.riskScore)}`}>
                    {isAnalyzed(doc) ? getRiskIcon(doc.riskScore) : <Loader2 className="w-5 h-5 animate-spin text-muted" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg truncate max-w-[200px] sm:max-w-[300px]">{doc.originalName}</h3>
                    <p className="text-sm text-muted">
                      {new Date(doc.createdAt).toLocaleDateString()}
                      {isAnalyzed(doc) ? ` \u2022 Risk: ${doc.riskScore}%` : ` \u2022 ${doc.status || 'uploaded'}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform">
                  <span className="text-sm font-medium mr-2 hidden sm:block">
                    {isAnalyzed(doc) ? 'View Details' : doc.scannedPdf ? 'No Text' : 'Processing...'}
                  </span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Analysis Modal */}
      <AnimatePresence>
        {isModalOpen && selectedDoc && isAnalyzed(selectedDoc) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col">

              {/* Modal Header */}
              <div className="sticky top-0 bg-surface/90 backdrop-blur-md p-4 md:p-6 border-b border-border z-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl md:text-2xl font-bold truncate">{selectedDoc.originalName}</h2>
                    <p className="text-xs md:text-sm text-muted">Risk Score: {selectedDoc.riskScore}%</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Accessibility toggle */}
                    <button onClick={cycleAccessibility} title="Toggle accessibility mode"
                      className="p-2 bg-surface rounded-full hover:bg-primary/20 transition-colors text-muted hover:text-primary">
                      {getAccessibilityIcon()}
                    </button>

                    {/* Premium TTS Controls */}
                    <TtsControls
                      state={ttsState}
                      onPlay={() => speakAnalysis(getActiveAnalysis(), selectedLang)}
                      onPause={pause}
                      onResume={resume}
                      onStop={stop}
                      isSupported={isTtsSupported}
                      language={selectedLang}
                    />

                    {/* Language Selector */}
                    <LanguageSelector
                      selectedLang={selectedLang}
                      onSelect={handleLanguageChange}
                      isTranslating={isTranslating}
                    />

                    {/* Close */}
                    <button onClick={() => { cancelPrevious(); setIsModalOpen(false); stop(); }}
                      className="p-2 bg-surface rounded-full hover:bg-border transition-colors">
                      <X className="w-5 h-5 text-muted" />
                    </button>
                  </div>
                </div>

                {/* Explain Mode + Translation status row */}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Explain like:</span>
                    <select value={explainMode} onChange={(e) => setExplainMode(e.target.value)}
                      className={`
                        text-xs rounded-lg px-2.5 py-1.5 outline-none border cursor-pointer transition-all
                        ${isReanalyzing
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-surface border-border text-text hover:border-primary/30'}
                      `}>
                      {EXPLAIN_MODES.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <motion.span
                    key={explainMode}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-muted/50"
                  >
                    {getExplainModePrefix()}
                  </motion.span>
                  {isReanalyzing && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 text-xs text-primary"
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Rewriting for {EXPLAIN_MODES.find(m => m.id === explainMode)?.label}...
                    </motion.span>
                  )}
                  {isTranslating && (
                    <span className="flex items-center gap-1.5 text-xs text-primary">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Translating...
                    </span>
                  )}
                  {ttsState === 'speaking' && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      Speaking
                    </span>
                  )}
                  {ttsState === 'paused' && (
                    <span className="text-xs text-yellow-400">Paused</span>
                  )}
                  {ttsState === 'error' && (
                    <span className="text-xs text-accent">TTS error</span>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className={`p-4 md:p-6 space-y-8 ${getAccessibilityClasses()}`}>
                {/* Re-analysis shimmer overlay */}
                <AnimatePresence>
                  {isReanalyzing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-3">
                          <div className="h-5 w-48 bg-primary/10 rounded-lg animate-pulse" />
                          <div className="bg-surface/30 p-5 rounded-xl border border-border/50 space-y-2">
                            <div className="h-3 bg-primary/5 rounded animate-pulse w-full" />
                            <div className="h-3 bg-primary/5 rounded animate-pulse w-11/12" />
                            <div className="h-3 bg-primary/5 rounded animate-pulse w-4/5" />
                          </div>
                        </div>
                      ))}
                      <div className="text-center py-4">
                        <motion.span
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-xs text-primary/60"
                        >
                          Rewriting analysis for {EXPLAIN_MODES.find(m => m.id === explainMode)?.label}...
                        </motion.span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Summary */}
                <motion.section layout>
                  <h3 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Simple Summary
                    {explainMode !== 'normal' && modeAnalysis && !isReanalyzing && (
                      <span className="text-[10px] font-normal text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        {EXPLAIN_MODES.find(m => m.id === explainMode)?.label}
                      </span>
                    )}
                  </h3>
                  <div className={`bg-surface/50 p-5 rounded-xl border border-border transition-all duration-300 ${isReanalyzing ? 'opacity-30' : ''}`}>
                    <p className="leading-relaxed">{analysis.simpleSummary || 'No summary available.'}</p>
                  </div>
                </motion.section>

                {/* Dangerous Clauses */}
                {analysis.dangerousClauses?.length > 0 && (
                  <motion.section layout>
                    <h3 className="text-lg font-bold text-accent mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" /> Dangerous Clauses
                    </h3>
                    <div className="space-y-4">
                      {analysis.dangerousClauses.map((item, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-accent/5 border border-accent/20 p-5 rounded-xl">
                          <blockquote className="text-sm italic text-muted mb-3 border-l-2 border-accent pl-3 py-1">
                            &ldquo;{item.clause}&rdquo;
                          </blockquote>
                          <p className="text-accent font-medium text-sm">
                            <span className="font-bold">Risk:</span> {item.explanation}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* Important Clauses */}
                {analysis.importantClauses?.length > 0 && (
                  <motion.section layout>
                    <h3 className="text-lg font-bold text-secondary mb-3">Important Clauses</h3>
                    <div className="space-y-4">
                      {analysis.importantClauses.map((item, idx) => (
                        <div key={idx} className="bg-surface/50 border border-border p-5 rounded-xl">
                          <blockquote className="text-sm italic text-muted mb-3 border-l-2 border-primary pl-3 py-1">
                            &ldquo;{item.clause}&rdquo;
                          </blockquote>
                          <p className="text-muted text-sm">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* Financial Risks */}
                {analysis.hiddenFinancialRisks?.length > 0 && (
                  <motion.section layout>
                    <h3 className="text-lg font-bold text-accent mb-3">Hidden Financial Risks</h3>
                    <div className="space-y-4">
                      {analysis.hiddenFinancialRisks.map((item, idx) => (
                        <div key={idx} className="bg-accent/5 border border-accent/20 p-5 rounded-xl">
                          <blockquote className="text-sm italic text-muted mb-3 border-l-2 border-accent pl-3 py-1">
                            &ldquo;{item.clause}&rdquo;
                          </blockquote>
                          <p className="text-muted text-sm">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* Questions */}
                {analysis.questionsToAsk?.length > 0 && (
                  <motion.section layout>
                    <h3 className="text-lg font-bold text-secondary mb-3">What You Should Ask</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted">
                      {analysis.questionsToAsk.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </motion.section>
                )}

                {/* Suggestions */}
                {analysis.negotiationSuggestions?.length > 0 && (
                  <motion.section layout>
                    <h3 className="text-lg font-bold text-primary mb-3">Negotiation Suggestions</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted">
                      {analysis.negotiationSuggestions.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </motion.section>
                )}

                {/* Trust Score */}
                {analysis.trustScore !== undefined && (
                  <motion.section layout>
                    <h3 className="text-lg font-bold mb-3">Trust Score</h3>
                    <div className="flex items-center gap-4">
                      <div className="w-full bg-surface rounded-full h-4 overflow-hidden border border-border">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.trustScore}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className={`h-full rounded-full ${analysis.trustScore > 70 ? 'bg-green-500' : analysis.trustScore > 40 ? 'bg-yellow-500' : 'bg-accent'}`} />
                      </div>
                      <span className="text-lg font-bold text-muted flex-shrink-0">{analysis.trustScore}%</span>
                    </div>
                  </motion.section>
                )}

                {/* Copyright */}
                <p className="text-center text-xs text-muted/30 pt-4 border-t border-border">Powered by Legalyn AI</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Dashboard;
