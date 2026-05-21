import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check, Search } from 'lucide-react';

const LANGUAGES = [
  { code: 'English', label: 'English', script: 'English', tts: 'en-US' },
  { code: 'Hindi', label: 'हिन्दी', script: 'Hindi', tts: 'hi-IN' },
  { code: 'Marathi', label: 'मराठी', script: 'Marathi', tts: 'mr-IN' },
  { code: 'Gujarati', label: 'ગુજરાતી', script: 'Gujarati', tts: 'gu-IN' },
  { code: 'Tamil', label: 'தமிழ்', script: 'Tamil', tts: 'ta-IN' },
  { code: 'Telugu', label: 'తెలుగు', script: 'Telugu', tts: 'te-IN' },
  { code: 'Bengali', label: 'বাংলা', script: 'Bengali', tts: 'bn-IN' }
];

const LANGUAGE_FONTS = {
  English: '',
  Hindi: 'font-hi',
  Marathi: 'font-hi',
  Gujarati: 'font-gu',
  Tamil: 'font-ta',
  Telugu: 'font-te',
  Bengali: 'font-bn'
};

export { LANGUAGES, LANGUAGE_FONTS };

const LanguageSelector = ({ selectedLang, onSelect, isTranslating }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const selected = LANGUAGES.find(l => l.code === selectedLang) || LANGUAGES[0];

  const filtered = searchQuery
    ? LANGUAGES.filter(l =>
        l.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.script.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : LANGUAGES;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const idx = filtered.findIndex(l => l.code === selectedLang);
      setFocusedIndex(idx >= 0 ? idx : 0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (listRef.current && focusedIndex >= 0) {
      const item = listRef.current.children[focusedIndex];
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && filtered[focusedIndex]) {
          onSelect(filtered[focusedIndex].code);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const selectLang = (code) => {
    onSelect(code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Selected language: ${selectedLang}. Click to change.`}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-full
          bg-black/40 border border-purple-500/20
          hover:bg-purple-500/15 hover:border-purple-500/40
          transition-all duration-300 group cursor-pointer
          ${isOpen ? 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : ''}
        `}
      >
        <Globe className={`w-4 h-4 transition-colors duration-300 ${isOpen ? 'text-purple-400' : 'text-muted group-hover:text-purple-400'}`} />
        <span className={`text-sm font-medium transition-colors duration-300 ${LANGUAGE_FONTS[selectedLang] || ''} ${isOpen ? 'text-purple-300' : 'text-text group-hover:text-purple-300'}`}>
          {selected.label}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-colors duration-300 ${isOpen ? 'text-purple-400' : 'text-muted'}`} />
        </motion.div>
        {isTranslating && (
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-64 z-[200]"
          >
            <div className="
              bg-black/80 backdrop-blur-2xl
              border border-purple-500/30
              rounded-2xl overflow-hidden
              shadow-[0_0_40px_rgba(139,92,246,0.15),0_20px_60px_rgba(0,0,0,0.5)]
            ">
              {/* Search */}
              <div className="p-3 border-b border-white/5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-purple-500/40 focus-within:bg-purple-500/5 transition-all">
                  <Search className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setFocusedIndex(0); }}
                    placeholder="Search language..."
                    className="bg-transparent text-sm text-text outline-none w-full placeholder-muted/50"
                    aria-label="Search languages"
                  />
                </div>
              </div>

              {/* List */}
              <div
                ref={listRef}
                role="listbox"
                aria-label="Select a language"
                className="max-h-60 overflow-y-auto py-2 scrollbar-thin"
                onKeyDown={handleKeyDown}
              >
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted/50">
                    No languages found for &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filtered.map((lang, idx) => {
                    const isSelected = lang.code === selectedLang;
                    const isFocused = idx === focusedIndex;
                    return (
                      <motion.button
                        key={lang.code}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectLang(lang.code)}
                        onMouseEnter={() => setFocusedIndex(idx)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 text-left
                          transition-all duration-200 relative
                          ${isSelected
                            ? 'bg-purple-500/15 text-purple-300'
                            : isFocused
                              ? 'bg-white/5 text-text'
                              : 'text-muted hover:bg-white/5 hover:text-text'}
                        `}
                      >
                        {/* Selection indicator */}
                        <div className={`
                          w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200
                          ${isSelected
                            ? 'border-purple-400 bg-purple-500/20'
                            : isFocused
                              ? 'border-white/20'
                              : 'border-white/10'}
                        `}>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            >
                              <Check className="w-3 h-3 text-purple-400" />
                            </motion.div>
                          )}
                        </div>

                        {/* Language text */}
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm font-medium truncate ${LANGUAGE_FONTS[lang.code] || ''} ${isSelected ? 'text-purple-300' : ''}`}>
                            {lang.label}
                          </span>
                          <span className="text-[10px] text-muted/50 truncate">
                            {lang.script} — {lang.code}
                          </span>
                        </div>

                        {/* Active glow for selected */}
                        {isSelected && (
                          <motion.div
                            layoutId="langGlow"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                          />
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Footer tip */}
              <div className="px-4 py-2 border-t border-white/5 text-[10px] text-muted/30 text-center">
                Type to search &bull; Arrow keys to navigate &bull; Enter to select
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSelector;
