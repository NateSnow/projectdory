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
    <div className="h-full w-full wave-bg flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated foam particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              left: `${Math.random() * 100}%`,
              top: `${30 + Math.random() * 40}%`,
              background: `rgba(220, 232, 240, ${Math.random() * 0.3 + 0.1})`,
            }}
            animate={{
              x: [0, (Math.random() - 0.5) * 60],
              y: [0, -30 - Math.random() * 40],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: Math.random() * 4 + 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Title area */}
      <motion.div
        className="text-center mb-10 z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <motion.div
          className="text-5xl mb-3"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          🐠
        </motion.div>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-wave-cream mb-2 tracking-wide drop-shadow-lg">
          Project <span className="text-wave-crest">Dory</span>
        </h1>
        <p className="text-wave-foam/70 text-lg md:text-xl font-light tracking-widest uppercase">
          DanDân — The Forgetful Fish
        </p>
        <div className="mt-3 w-48 mx-auto wave-divider" />
      </motion.div>

      {/* Mode selection */}
      <motion.div
        className="flex flex-col gap-3 z-10 w-full max-w-md px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        {MODES.map(({ mode, label, description, icon, enabled }) => (
          <motion.button
            key={mode}
            onClick={() => enabled && handleStart(mode)}
            disabled={!enabled}
            className={`
              glass-panel p-5 text-left transition-all duration-300 group
              ${enabled
                ? 'hover:bg-wave-prussian/40 hover:border-wave-slate/40 cursor-pointer'
                : 'opacity-35 cursor-not-allowed'
              }
            `}
            whileHover={enabled ? { scale: 1.02, x: 4 } : {}}
            whileTap={enabled ? { scale: 0.98 } : {}}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{icon}</span>
              <div>
                <h3 className="font-display text-lg text-wave-cream group-hover:text-wave-crest transition-colors">
                  {label}
                </h3>
                <p className="text-wave-slate text-sm">
                  {description}
                  {!enabled && ' (Coming Soon)'}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Attribution footer */}
      <motion.div
        className="absolute bottom-4 text-center z-10 space-y-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <p className="text-wave-slate/50 text-[10px]">
          Background: "The Great Wave off Kanagawa" by Katsushika Hokusai (c. 1831) · Public Domain
        </p>
        <p className="text-wave-slate/40 text-[10px]">
          Card images © Wizards of the Coast · Powered by Scryfall · A fan project
        </p>
      </motion.div>
    </div>
  )
}
