import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldCheck, Zap, FileText, UploadCloud, ScanLine, Timer } from 'lucide-react';

const FeatureCard = ({ icon, title, desc }) => (
  <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col items-center text-center">
    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center border border-border mb-6">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-muted leading-relaxed">{desc}</p>
  </div>
);

const ScanLineBeam = () => (
  <motion.div
    className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
    aria-hidden="true"
  >
    <motion.div
      className="absolute left-0 right-0 h-[2px]"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(59,130,246,0.4), transparent)',
        filter: 'blur(1px)',
        top: '0%',
      }}
      animate={{ top: ['-5%', '105%'] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
    />
  </motion.div>
);

const FloatingParticle = ({ delay, x, size }) => (
  <motion.div
    className="absolute rounded-full bg-purple-500/20"
    style={{ width: size, height: size, left: `${x}%` }}
    animate={{
      y: [0, -20, 0],
      opacity: [0.3, 0.7, 0.3],
    }}
    transition={{ duration: 4, delay, repeat: Infinity, ease: 'easeInOut' }}
    aria-hidden="true"
  />
);

const Home = () => {
  return (
    <div className="flex-grow flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative z-10 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center space-x-2 glass-panel px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-muted">AI-Powered Legal Analysis 2.0</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Understand Before You <br />
            <span className="text-gradient">Sign Anything.</span>
          </h1>

          <p className="mt-6 max-w-2xl mx-auto text-xl text-muted leading-relaxed">
            Upload any legal document. Our advanced AI instantly detects risky clauses, hidden financial penalties, and explains complex legal jargon in plain English.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/dashboard"
              className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_40px_rgba(124,58,237,0.6)] flex items-center space-x-2"
            >
              <UploadCloud className="w-5 h-5" />
              <span>Analyze Document</span>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-32 grid md:grid-cols-3 gap-8"
        >
          <FeatureCard 
            icon={<ShieldCheck className="w-8 h-8 text-primary" />}
            title="Risk Detection"
            desc="Identify dangerous clauses and hidden penalties before you sign."
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-secondary" />}
            title="Instant Simplification"
            desc="Translate complex legal jargon into simple, everyday language."
          />
          <FeatureCard 
            icon={<FileText className="w-8 h-8 text-accent" />}
            title="Smart Summaries"
            desc="Get automated summaries and a clear trust score for your documents."
          />
        </motion.div>

        {/* Coming Soon — OCR teaser */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="mt-20 flex justify-center"
        >
          <motion.div
            className="relative w-full max-w-sm"
            whileHover={{ scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          >
            <motion.div
              className="absolute -inset-[2px] rounded-2xl opacity-35"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(59,130,246,0.08), rgba(124,58,237,0.15))',
                filter: 'blur(10px)',
              }}
              animate={{ opacity: [0.25, 0.5, 0.25] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="relative bg-black/40 backdrop-blur-2xl border border-purple-500/15 rounded-2xl p-5 overflow-hidden">
              <ScanLineBeam />
              <FloatingParticle delay={0} x={15} size={6} />
              <FloatingParticle delay={1.5} x={75} size={4} />
              <FloatingParticle delay={3} x={45} size={5} />

              <motion.div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/8 border border-purple-500/20 mb-3"
                animate={{ opacity: [0.65, 1, 0.65] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Timer className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] font-semibold tracking-widest text-purple-400 uppercase">
                  Coming Soon
                </span>
              </motion.div>

              <div className="flex items-center gap-2 mb-2">
                <motion.div
                  className="w-7 h-7 rounded-lg bg-secondary/15 flex items-center justify-center border border-secondary/30 flex-shrink-0"
                  animate={{ rotate: [0, 4, -4, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ScanLine className="w-4 h-4 text-secondary" />
                </motion.div>
                <h4 className="text-sm font-bold text-text">OCR Document Conversion</h4>
              </div>

              <p className="text-xs text-muted/60 leading-relaxed">
                Upload scanned images, handwritten pages, or printed documents and instantly convert them into readable AI-analyzable text.
              </p>

              <motion.div
                className="mt-3 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-purple-500/25 to-transparent"
                animate={{ opacity: [0.15, 0.5, 0.15] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
