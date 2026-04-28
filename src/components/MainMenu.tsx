import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import type { GameMode } from '../engine/gameState'

const MODES: { mode: GameMode; label: string; description: string; icon: string; enabled: boolean }[] = [
  {
    mode: 'cpu',
    label: 'vs Dory (CPU)',
    description: 'Challenge the forgetful fish AI',
    icon: '🐟',
    enabled: true,
  },
  {
    mode: 'local',
    label: 'Local 2-Player',
    description: 'Pass & play with a friend',
    icon: '🤝',
    enabled: false,
  },
  {
    mode: 'online',
    label: 'Online',
    description: 'Play against fans worldwide',
    icon: '🌊',
    enabled: false,
  },
]

export default function MainMenu() {
  const navigate = useNavigate()
  const startGame = useGameStore(s => s.startGame)

  function handleStart(mode: GameMode) {
    startGame(mode)
    navigate('/play')
  }

  return (
    <div className="h-full w-full bg-ocean-gradient flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background bubbles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-ocean-400/5"
            style={{
              width: Math.random() * 100 + 30,
              height: Math.random() * 100 + 30,
              left: `${Math.random() * 100}%`,
              bottom: '-10%',
            }}
            animate={{
              y: [0, -(window.innerHeight + 200)],
              x: [0, (Math.random() - 0.5) * 100],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: Math.random() * 8 + 8,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Title */}
      <motion.div
        className="text-center mb-12 z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="text-6xl mb-4"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          🐠
        </motion.div>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-2 tracking-wide">
          Project <span className="text-dory-glow">Dory</span>
        </h1>
        <p className="text-ocean-300 text-lg md:text-xl font-light tracking-wider">
          DanDân — The Forgetful Fish Format
        </p>
      </motion.div>

      {/* Mode selection */}
      <motion.div
        className="flex flex-col gap-4 z-10 w-full max-w-md px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {MODES.map(({ mode, label, description, icon, enabled }) => (
          <motion.button
            key={mode}
            onClick={() => enabled && handleStart(mode)}
            disabled={!enabled}
            className={`
              glass-panel p-5 text-left transition-all duration-300 group
              ${enabled
                ? 'hover:bg-ocean-800/40 hover:border-ocean-500/50 cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
              }
            `}
            whileHover={enabled ? { scale: 1.02, x: 4 } : {}}
            whileTap={enabled ? { scale: 0.98 } : {}}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{icon}</span>
              <div>
                <h3 className="font-display text-lg text-white group-hover:text-dory-glow transition-colors">
                  {label}
                </h3>
                <p className="text-ocean-400 text-sm">
                  {description}
                  {!enabled && ' (Coming Soon)'}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Footer */}
      <motion.div
        className="absolute bottom-4 text-center text-ocean-600 text-xs z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>Card images © Wizards of the Coast · Powered by Scryfall</p>
        <p className="mt-1">A fan project celebrating the DanDân format</p>
      </motion.div>
    </div>
  )
}
