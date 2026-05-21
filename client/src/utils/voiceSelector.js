const VOICE_MAP = {
  English: { lang: 'en-US', fallbacks: ['en-GB', 'en-IN', 'en-AU', 'en'] },
  Hindi: { lang: 'hi-IN', fallbacks: ['mr-IN', 'gu-IN', 'bn-IN', 'en-IN', 'en-GB', 'en-US'] },
  Marathi: { lang: 'mr-IN', fallbacks: ['hi-IN', 'gu-IN', 'bn-IN', 'en-IN', 'en-GB', 'en-US'] },
  Gujarati: { lang: 'gu-IN', fallbacks: ['hi-IN', 'mr-IN', 'bn-IN', 'en-IN', 'en-GB', 'en-US'] },
  Tamil: { lang: 'ta-IN', fallbacks: ['te-IN', 'hi-IN', 'en-IN', 'en-GB', 'en-US'] },
  Telugu: { lang: 'te-IN', fallbacks: ['ta-IN', 'hi-IN', 'en-IN', 'en-GB', 'en-US'] },
  Bengali: { lang: 'bn-IN', fallbacks: ['hi-IN', 'en-IN', 'en-GB', 'en-US'] },
};

let cachedVoices = [];
let voicesLoaded = false;
let voiceLoadPromise = null;
let voiceChangeListeners = [];

export function loadVoices() {
  if (voiceLoadPromise) return voiceLoadPromise;
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    voiceLoadPromise = Promise.resolve([]);
    return voiceLoadPromise;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
    voicesLoaded = true;
    voiceLoadPromise = Promise.resolve(voices);
    return voiceLoadPromise;
  }

  voiceLoadPromise = new Promise((resolve) => {
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      voiceChangeListeners.forEach(fn => fn(cachedVoices));
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
  });

  return voiceLoadPromise;
}

export function getAvailableVoices() {
  return cachedVoices;
}

export function onVoicesChanged(listener) {
  voiceChangeListeners.push(listener);
  return () => {
    voiceChangeListeners = voiceChangeListeners.filter(l => l !== listener);
  };
}

export function selectVoice(languageCode) {
  const config = VOICE_MAP[languageCode];
  if (!config) return null;

  const exact = cachedVoices.find(v => v.lang === config.lang && v.localService);
  if (exact) return exact;

  const exactAny = cachedVoices.find(v => v.lang === config.lang);
  if (exactAny) return exactAny;

  for (const fallbackLang of config.fallbacks) {
    const fallback = cachedVoices.find(
      v => v.lang.startsWith(fallbackLang) && v.localService
    );
    if (fallback) return fallback;
    const fallbackAny = cachedVoices.find(v => v.lang.startsWith(fallbackLang));
    if (fallbackAny) return fallbackAny;
  }

  return cachedVoices.find(v => v.lang.startsWith('en')) || cachedVoices[0] || null;
}

export function getVoiceDebugInfo(languageCode) {
  const config = VOICE_MAP[languageCode];
  if (!config) return { languageCode, selectedVoice: null, availableVoices: cachedVoices, message: 'No voice config found' };

  const selected = selectVoice(languageCode);
  return {
    languageCode,
    targetLang: config.lang,
    fallbacks: config.fallbacks,
    selectedVoice: selected ? { name: selected.name, lang: selected.lang, local: selected.localService } : null,
    availableVoices: cachedVoices.map(v => ({ name: v.name, lang: v.lang, local: v.localService })),
  };
}

export function isVoiceSupported(languageCode) {
  return !!selectVoice(languageCode);
}

loadVoices();

export default { selectVoice, getAvailableVoices, onVoicesChanged, getVoiceDebugInfo, isVoiceSupported, loadVoices };
