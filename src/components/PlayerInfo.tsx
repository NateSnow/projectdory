import { motion } from 'framer-motion'
import type { PlayerState } from '../engine/gameState'

interface PlayerInfoProps {
  player: PlayerState
  isActive: boolean
  hasPriority: boolean
  compact?: boolean
}

export default function PlayerInfo({ player, isActive, hasPriority, compact = false }: PlayerInfoProps) {
  return (
    <motion.div
      className={`
        glass-panel px-4 py-2 flex items-center gap-4
        ${hasPriority ? 'border-dory-glow/50' : ''}
        ${isActive ? 'bg-ocean-900/40' : ''}
      `}
      animate={hasPriority ? { boxShadow: '0 0 12px rgba(79, 195, 247, 0.2)' } : {}}
    >
      {/* Player name */}
      <div className="flex flex-col">
        <span className={`font-display text-sm ${isActive ? 'text-dory-glow' : 'text-ocean-300'}`}>
          {player.name}
        </span>
        {hasPriority && (
          <span className="text-[10px] text-dory-glow/70 animate-pulse">Priority</span>
        )}
      </div>

      {/* Life total */}
      <div className="flex items-center gap-1.5">
        <span className="text-red-400 text-sm">❤️</span>
        <motion.span
          key={player.life}
          className={`font-display text-xl font-bold ${
            player.life <= 5 ? 'text-red-400' : 'text-white'
          }`}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
        >
          {player.life}
        </motion.span>
      </div>

      {/* Mana pool */}
      <div className="flex items-center gap-1">
        <span className="text-blue-400 text-sm">💧</span>
        <span className="text-ocean-200 font-mono text-sm">{player.manaPool}</span>
      </div>

      {/* DanDân hits tracker */}
      <div className="flex items-center gap-1" title="DanDân hits taken (5 = lethal)">
        <span className="text-sm">🐟</span>
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < player.dandanHits ? 'bg-red-500' : 'bg-ocean-700/50'
              }`}
            />
          ))}
        </div>
      </div>

      {!compact && (
        <>
          {/* Cards in hand */}
          <div className="flex items-center gap-1 text-ocean-400 text-xs">
            <span>🃏</span>
            <span>{player.hand.length}</span>
          </div>
        </>
      )}
    </motion.div>
  )
}
