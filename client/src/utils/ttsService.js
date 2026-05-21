import { selectVoice, loadVoices } from './voiceSelector';

let state = 'idle';
let chunks = [];
let currentChunkIndex = 0;
let isPausedBetween = false;
let pendingTimer = null;
let lastOptions = null;
let stateListeners = new Set();
let debugLogs = [];

const TONES = {
  professional: { rate: 0.88, pitch: 1.0 },
  serious: { rate: 0.82, pitch: 0.93 },
  conversational: { rate: 0.92, pitch: 1.02 },
  calm: { rate: 0.85, pitch: 0.98 },
  default: { rate: 0.9, pitch: 1.0 },
};

function setState(newState) {
  state = newState;
  stateListeners.forEach(fn => fn(newState));
}

function debug(...args) {
  const entry = `[TTS ${new Date().toISOString()}] ${args.join(' ')}`;
  debugLogs.push(entry);
  if (debugLogs.length > 200) debugLogs.shift();
  console.log(entry);
}

function chunkText(text) {
  if (!text || !text.trim()) return [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text.trim()];
  const cleaned = sentences.map(s => s.trim()).filter(s => s.length > 0);
  const chunks = [];
  for (let i = 0; i < cleaned.length; i += 3) {
    chunks.push(cleaned.slice(i, i + 3).join(' '));
  }
  return chunks;
}

function detectTone(text) {
  const lower = text.toLowerCase();
  if (/dangerous|risk|warning|caution|liability|penalty|termination|breach/.test(lower)) return 'serious';
  if (/summary|overview|welcome|let me|here is/.test(lower)) return 'conversational';
  if (/question|ask|consider|recommend/.test(lower)) return 'calm';
  return 'professional';
}

function speakNextChunk() {
  if (isPausedBetween || state === 'paused') return;

  if (currentChunkIndex >= chunks.length) {
    debug('All chunks spoken');
    setState('idle');
    lastOptions?.onEnd?.();
    lastOptions = null;
    chunks = [];
    currentChunkIndex = 0;
    return;
  }

  const text = chunks[currentChunkIndex];
  const tone = TONES[lastOptions?.tone || detectTone(text)] || TONES.default;
  const voice = selectVoice(lastOptions?.language || 'English');

  debug(
    `Chunk ${currentChunkIndex + 1}/${chunks.length}`,
    `| lang: ${lastOptions?.language}`,
    `| tone: ${lastOptions?.tone || 'auto'}`,
    `| voice: ${voice ? voice.name + ' (' + voice.lang + ')' : 'default'}`,
    `| text: "${text.substring(0, 60)}..."`
  );

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = lastOptions?.rate ?? tone.rate;
  utterance.pitch = lastOptions?.pitch ?? tone.pitch;
  utterance.volume = lastOptions?.volume ?? 1;
  utterance.lang = lastOptions?.lang || (voice ? voice.lang : 'en-US');

  if (voice) utterance.voice = voice;

  utterance.onstart = () => {
    setState('speaking');
    if (currentChunkIndex === 0) lastOptions?.onStart?.();
  };

  utterance.onend = () => {
    currentChunkIndex++;
    if (currentChunkIndex < chunks.length) {
      isPausedBetween = true;
      setState('speaking');
      pendingTimer = setTimeout(() => {
        isPausedBetween = false;
        if (state !== 'stopping') speakNextChunk();
      }, 180);
    } else {
      setState('idle');
      lastOptions?.onEnd?.();
      lastOptions = null;
      chunks = [];
      currentChunkIndex = 0;
    }
  };

  utterance.onerror = (e) => {
    debug('Chunk error:', e.error);
    currentChunkIndex++;
    if (currentChunkIndex < chunks.length) {
      pendingTimer = setTimeout(() => speakNextChunk(), 100);
    } else {
      setState('idle');
      lastOptions?.onEnd?.();
      lastOptions = null;
      chunks = [];
      currentChunkIndex = 0;
    }
    lastOptions?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}

function ensureVoicesLoaded() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    debug('speechSynthesis not available');
    return false;
  }
  return true;
}

export const ttsService = {
  speak(text, options = {}) {
    if (!ensureVoicesLoaded()) return false;
    this.stop();

    const voice = selectVoice(options.language || 'English');
    const lang = options.lang || (voice ? voice.lang : 'en-US');

    chunks = chunkText(text);
    if (chunks.length === 0) {
      debug('No text to speak');
      return false;
    }

    debug(
      `Starting speech: ${chunks.length} chunks, language: ${options.language}`,
      `voice: ${voice ? voice.name + ' (' + voice.lang + ')' : 'none'}`,
      `total chars: ${text.length}`
    );

    currentChunkIndex = 0;
    isPausedBetween = false;
    lastOptions = { ...options, voice, lang };

    setState('speaking');
    speakNextChunk();
    return true;
  },

  pause() {
    if (!ensureVoicesLoaded()) return;
    if (state === 'speaking') {
      debug('Pausing');
      window.speechSynthesis.pause();
      setState('paused');
    }
  },

  resume() {
    if (!ensureVoicesLoaded()) return;
    if (state === 'paused') {
      debug('Resuming');
      window.speechSynthesis.resume();
      setState('speaking');
    } else if (state === 'idle' && lastOptions) {
      setState('speaking');
      speakNextChunk();
    }
  },

  stop() {
    if (!ensureVoicesLoaded()) return;
    debug('Stopping');
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    isPausedBetween = false;
    window.speechSynthesis.cancel();
    chunks = [];
    currentChunkIndex = 0;
    lastOptions = null;
    setState('idle');
  },

  getState() {
    return state;
  },

  onStateChange(listener) {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  },

  getDebugLogs() {
    return [...debugLogs];
  },

  clearDebugLogs() {
    debugLogs = [];
  },

  isSpeaking() {
    return state === 'speaking';
  },

  isPaused() {
    return state === 'paused';
  },

  isIdle() {
    return state === 'idle';
  },

  destroy() {
    this.stop();
    stateListeners.clear();
  },
};

loadVoices();

export default ttsService;
