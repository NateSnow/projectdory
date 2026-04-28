import { motion } from 'framer-motion'
import type { GamePhase } from '../engine/gameState'

interface PhaseTrackerProps {
  currentPhase: GamePhase
  turnNumber: number
}

const PHASE_LABELS: Record<GamePhase, string> = {
  mulligan: 'Mulligan',
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main 1',
  combat_begin: 'Combat',
  declare_attackers: 'Attackers',
  declare_blockers: 'Blockers',
  combat_damage: 'Damage',
  combat_end: 'End Combat',
  main2: 'Main 2',
  end_step: 'End',
  cleanup: 'Cleanup',
}

const DISPLAY_PHASES: GamePhase[] = [
  'untap', 'upkeep', 'draw', 'main1',
  'combat_begin', 'declare_attackers',
  'main2', 'end_step',
]

export default function PhaseTracker({ currentPhase, turnNumber }: PhaseTrackerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-ocean-500 text-xs font-mono mr-2">
        Turn {turnNumber}
      </div>
      <div className="flex gap-1">
        {DISPLAY_PHASES.map((phase) => {
          const isActive = phase === currentPhase
          // Also highlight if we're in a sub-phase of combat
          const isCombatSubPhase = phase === 'combat_begin' && [
            'combat_begin', 'declare_attackers', 'declare_blockers',
            'combat_damage', 'combat_end',
          ].includes(currentPhase)

          const highlighted = isActive || isCombatSubPhase

          return (
            <motion.div
              key={phase}
              className={`
                px-2 py-0.5 rounded text-[10px] font-body transition-all
                ${highlighted
                  ? 'phase-active bg-ocean-800/60 border border-dory-glow/30'
                  : 'text-ocean-600 bg-ocean-950/30'
                }
              `}
              animate={highlighted ? { scale: 1.05 } : { scale: 1 }}
            >
              {PHASE_LABELS[phase]}
            </motion.div>
          )
        })}
      </div>
      {currentPhase === 'mulligan' && (
        <div className="text-dory-glow text-xs animate-pulse ml-2">
          Mulligan Phase
        </div>
      )}
    </div>
  )
}
