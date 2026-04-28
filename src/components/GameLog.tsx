import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LogEntry } from '../engine/cards/types'

interface GameLogProps {
  entries: LogEntry[]
  isOpen: boolean
  onToggle: () => void
}

export default function GameLog({ entries, isOpen, onToggle }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-ocean-900/80 border border-ocean-700/40 
                   rounded-l-lg px-2 py-4 text-ocean-400 hover:text-dory-glow transition-colors"
        style={{ right: isOpen ? 280 : 0 }}
      >
        <span className="text-xs writing-mode-vertical">
          {isOpen ? '▶' : '◀'} Log
        </span>
      </button>

      {/* Log panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="w-[280px] h-full glass-panel border-l border-ocean-700/30 flex flex-col"
            initial={{ x: 280 }}
            animate={{ x: 0 }}
            exit={{ x: 280 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div className="px-3 py-2 border-b border-ocean-700/30">
              <h3 className="font-display text-sm text-ocean-300">Game Log</h3>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
              {entries.map((entry, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <span className="text-ocean-600 font-mono">T{entry.turn}</span>
                  {' '}
                  <span className="text-ocean-400">{entry.player}</span>
                  {' '}
                  <span className="text-ocean-300">{entry.action}</span>
                </div>
              ))}
              {entries.length === 0 && (
                <div className="text-ocean-600 text-xs italic text-center mt-4">
                  Game log will appear here...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
