import { motion } from 'framer-motion';
import { Scale, Sparkles } from 'lucide-react';

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative mt-auto border-t border-border/30 bg-background/80 backdrop-blur-xl"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/25 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 md:py-14">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">

          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2.5 mb-2">
              <motion.div
                className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/25"
                whileHover={{ scale: 1.04, borderColor: 'rgba(124,58,237,0.5)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Scale className="text-primary w-[18px] h-[18px]" />
              </motion.div>
              <span className="text-xl font-bold tracking-[0.15em] text-text">
                LEGALYN
              </span>
            </div>
            <p className="text-sm text-muted/50 leading-relaxed">
              AI-powered legal understanding for everyone.
            </p>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <p className="text-sm text-muted/40">
              &copy; {new Date().getFullYear()} Legalyn. All rights reserved.
            </p>
            <p className="text-sm text-muted/40 flex items-center gap-1.5">
              Created by{' '}
              <span className="text-primary/50 font-medium">
                Aharnish Parekar
              </span>
            </p>
          </div>

        </div>

        <div className="mt-10 pt-5 border-t border-border/15">
          <p className="text-xs text-center text-muted/30 leading-relaxed max-w-2xl mx-auto">
            Legalyn is an AI assistant. Always consult a qualified legal professional for legal advice.
          </p>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
