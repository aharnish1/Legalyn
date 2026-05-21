import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, Play, Pause, Square, RotateCcw,
  VolumeX, Loader2
} from 'lucide-react';

const WAVEFORM_BARS = 32;

const Waveform = ({ isActive }) => {
  const bars = Array.from({ length: WAVEFORM_BARS });

  return (
    <div className="flex items-center gap-[2px] h-4 px-1">
      {bars.map((_, i) => {
        const delay = i * 0.04;
        const duration = 0.4 + Math.random() * 0.6;
        const minH = 3;
        const maxH = 14;
        const peakIndex = Math.floor(WAVEFORM_BARS / 2);
        const distanceFromCenter = Math.abs(i - peakIndex);
        const heightScale = 1 - distanceFromCenter / (WAVEFORM_BARS / 2);
        const baseHeight = minH + (maxH - minH) * (0.3 + 0.7 * heightScale);

        return (
          <motion.span
            key={i}
            className="block w-[3px] rounded-full bg-purple-400/80"
            animate={
              isActive
                ? {
                    height: [
                      `${baseHeight * 0.3}px`,
                      `${baseHeight}px`,
                      `${baseHeight * 0.5}px`,
                      `${baseHeight}px`,
                      `${baseHeight * 0.3}px`,
                    ],
                    opacity: [0.6, 1, 0.7, 1, 0.6],
                  }
                : { height: `${baseHeight * 0.3}px`, opacity: 0.3 }
            }
            transition={{
              duration,
              repeat: Infinity,
              delay,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </div>
  );
};

const TtsControls = ({ state, onPlay, onPause, onResume, onStop, isSupported, language }) => {
  const [showTooltip, setShowTooltip] = useState(null);
  const tooltipTimeout = useRef(null);

  const showTooltipFor = (id) => {
    setShowTooltip(id);
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setShowTooltip(null), 2000);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    };
  }, []);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-1.5 bg-surface/50 px-3 py-1.5 rounded-full border border-border/50"
        title="Speech synthesis not supported in this browser">
        <VolumeX className="w-3.5 h-3.5 text-muted/50" />
        <span className="text-[11px] text-muted/50">TTS unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-black/40 border border-purple-500/20 rounded-full p-1 group hover:border-purple-500/40 transition-all duration-300">
      {/* Idle — Show Play */}
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.button
            key="play"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { onPlay(); showTooltipFor('play'); }}
            title="Read aloud"
            className="relative p-2 rounded-full hover:bg-purple-500/20 transition-colors text-muted hover:text-purple-400 group/btn"
          >
            <Volume2 className="w-4 h-4" />
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 text-[10px] text-text whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-purple-500/20">
              Read Aloud
            </span>
          </motion.button>
        )}

        {/* Playing — Show Waveform + Pause + Stop */}
        {state === 'speaking' && (
          <motion.div
            key="playing"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-0.5"
          >
            <motion.div
              className="w-8 overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: 32 }}
              transition={{ duration: 0.3 }}
            >
              <Waveform isActive />
            </motion.div>

            <button
              onClick={() => { onPause(); showTooltipFor('pause'); }}
              title="Pause"
              className="p-2 rounded-full hover:bg-purple-500/20 transition-colors text-purple-400 relative group/btn"
            >
              <Pause className="w-4 h-4" />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 text-[10px] text-text whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-purple-500/20">
                Pause
              </span>
            </button>

            <button
              onClick={() => { onStop(); showTooltipFor('stop'); }}
              title="Stop"
              className="p-2 rounded-full hover:bg-accent/20 transition-colors text-accent/80 hover:text-accent relative group/btn"
            >
              <Square className="w-4 h-4" />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 text-[10px] text-text whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-accent/20">
                Stop
              </span>
            </button>
          </motion.div>
        )}

        {/* Paused — Show Resume + Stop */}
        {state === 'paused' && (
          <motion.div
            key="paused"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-0.5"
          >
            <motion.div
              className="w-8 overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: 32 }}
              transition={{ duration: 0.3 }}
            >
              <Waveform isActive={false} />
            </motion.div>

            <button
              onClick={() => { onResume(); showTooltipFor('resume'); }}
              title="Resume"
              className="p-2 rounded-full hover:bg-green-500/20 transition-colors text-green-400 relative group/btn"
            >
              <Play className="w-4 h-4" />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 text-[10px] text-text whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-green-500/20">
                Resume
              </span>
            </button>

            <button
              onClick={() => { onStop(); showTooltipFor('stop'); }}
              title="Stop"
              className="p-2 rounded-full hover:bg-accent/20 transition-colors text-accent/80 hover:text-accent relative group/btn"
            >
              <Square className="w-4 h-4" />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 text-[10px] text-text whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-accent/20">
                Stop
              </span>
            </button>
          </motion.div>
        )}

        {/* Error — Show Replay */}
        {state === 'error' && (
          <motion.button
            key="error"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { onPlay(); showTooltipFor('retry'); }}
            title="Retry"
            className="p-2 rounded-full hover:bg-accent/20 transition-colors text-accent relative group/btn"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 text-[10px] text-text whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-accent/20">
              Retry
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TtsControls;
