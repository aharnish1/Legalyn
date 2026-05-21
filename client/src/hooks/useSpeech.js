import { useState, useEffect, useCallback, useRef } from 'react';
import ttsService from '../utils/ttsService';
import { getAvailableVoices, onVoicesChanged } from '../utils/voiceSelector';

export function useSpeech() {
  const [state, setState] = useState('idle');
  const [voicesAvailable, setVoicesAvailable] = useState([]);
  const [isSupported, setIsSupported] = useState(false);
  const currentLangRef = useRef(null);
  const listenersRef = useRef([]);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && !!window.speechSynthesis;
    setIsSupported(supported);

    const unsub = ttsService.onStateChange(setState);

    setVoicesAvailable(getAvailableVoices());
    const unsubVoices = onVoicesChanged((voices) => {
      setVoicesAvailable(voices);
    });

    return () => {
      unsub();
      unsubVoices();
    };
  }, []);

  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  const speak = useCallback((text, options = {}) => {
    if (!text || !text.trim()) return false;

    const lang = options.language || 'English';
    currentLangRef.current = lang;

    return ttsService.speak(text, {
      ...options,
      language: lang,
      onStart: () => {
        setState('speaking');
        options.onStart?.();
      },
      onEnd: () => {
        setState('idle');
        options.onEnd?.();
      },
      onError: (e) => {
        setState('error');
        options.onError?.(e);
      },
    });
  }, []);

  const pause = useCallback(() => {
    ttsService.pause();
  }, []);

  const resume = useCallback(() => {
    ttsService.resume();
  }, []);

  const stop = useCallback(() => {
    ttsService.stop();
  }, []);

  const speakAnalysis = useCallback((analysis, language = 'English', tone = 'professional') => {
    const parts = [];
    if (analysis.simpleSummary) parts.push({ text: summaryText(analysis.simpleSummary), tone: 'conversational' });
    if (analysis.dangerousClauses?.length) {
      analysis.dangerousClauses.forEach(c => {
        parts.push({ text: `Dangerous Clause: ${c.clause}. Risk: ${c.explanation}`, tone: 'serious' });
      });
    }
    if (analysis.importantClauses?.length) {
      analysis.importantClauses.forEach(c => {
        parts.push({ text: `Important Clause: ${c.clause}. ${c.explanation}`, tone: 'professional' });
      });
    }
    if (analysis.questionsToAsk?.length) {
      parts.push({ text: `Questions to ask: ${analysis.questionsToAsk.join('. ')}`, tone: 'calm' });
    }
    if (analysis.negotiationSuggestions?.length) {
      parts.push({ text: `Suggestions: ${analysis.negotiationSuggestions.join('. ')}`, tone: 'professional' });
    }

    const fullText = parts.map(p => p.text).join('. ');
    const dominantTone = parts.length > 0 ? parts[Math.floor(parts.length / 2)].tone : tone;

    return speak(fullText, { language, tone: dominantTone });
  }, [speak]);

  return {
    state,
    isPlaying: state === 'speaking',
    isPaused: state === 'paused',
    isIdle: state === 'idle',
    isError: state === 'error',
    isSupported,
    voicesAvailable,
    speak,
    speakAnalysis,
    pause,
    resume,
    stop,
  };
}

function summaryText(text) {
  const prefix = text.startsWith('Summary:') ? '' : 'Summary: ';
  return prefix + text;
}

export default useSpeech;
