import { motion } from 'framer-motion';

/**
 * Subtle animated background for the hero section.
 * Features slow, continuous flowing ribbons that move left→right
 * representing the production→accounting handoff metaphor.
 * 
 * Design specs:
 * - Very slow motion (20-30s cycles)
 * - Linear easing, no visible loops
 * - Low opacity (5-12%) to maintain text contrast
 * - Continuity Blue + neutral only
 */
export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient layer - very subtle */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.02]" />
      
      {/* Flowing ribbon 1 - primary, slow diagonal drift */}
      <motion.div
        className="absolute -left-1/4 top-1/4 w-[150%] h-[200px]"
        initial={{ x: '-10%', y: '0%' }}
        animate={{ x: '10%', y: '-5%' }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
      >
        <div 
          className="w-full h-full rounded-full blur-3xl"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.08) 30%, hsl(var(--primary) / 0.06) 70%, transparent 100%)',
            transform: 'rotate(-8deg)',
          }}
        />
      </motion.div>

      {/* Flowing ribbon 2 - secondary, slower counter-drift */}
      <motion.div
        className="absolute -left-1/3 top-1/2 w-[160%] h-[150px]"
        initial={{ x: '5%', y: '0%' }}
        animate={{ x: '-5%', y: '8%' }}
        transition={{
          duration: 30,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
      >
        <div 
          className="w-full h-full rounded-full blur-3xl"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.05) 40%, hsl(var(--primary) / 0.04) 60%, transparent 100%)',
            transform: 'rotate(-4deg)',
          }}
        />
      </motion.div>

      {/* Flowing ribbon 3 - top accent, very subtle */}
      <motion.div
        className="absolute -right-1/4 top-0 w-[120%] h-[180px]"
        initial={{ x: '8%', y: '-3%' }}
        animate={{ x: '-8%', y: '3%' }}
        transition={{
          duration: 22,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
      >
        <div 
          className="w-full h-full rounded-full blur-3xl"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.05) 50%, transparent 100%)',
            transform: 'rotate(-12deg)',
          }}
        />
      </motion.div>

      {/* Convergence ribbon - moves toward center-right (resolution point) */}
      <motion.div
        className="absolute left-0 bottom-1/4 w-[140%] h-[120px]"
        initial={{ x: '-15%', opacity: 0.6 }}
        animate={{ x: '5%', opacity: 1 }}
        transition={{
          duration: 28,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
      >
        <div 
          className="w-full h-full rounded-full blur-3xl"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.06) 35%, hsl(var(--primary) / 0.03) 75%, transparent 100%)',
            transform: 'rotate(-2deg)',
          }}
        />
      </motion.div>
    </div>
  );
}
