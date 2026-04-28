import { motion } from 'framer-motion'
import type { CardInstance } from '../engine/cards/types'
import { getCardDefinition } from '../engine/cards'

interface SharedZonesProps {
  library: CardInstance[]
  graveyard: CardInstance[]
  onGraveyardClick?: () => void
}

export default function SharedZones({ library, graveyard, onGraveyardClick }: SharedZonesProps) {
  const topGraveyard = graveyard.length > 0 ? graveyard[graveyard.length - 1] : null
  const topGraveyardDef = topGraveyard ? getCardDefinition(topGraveyard.definitionId) : null

  return (
    <div className="flex items-center gap-6">
      {/* Shared Library */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          {/* Stack effect */}
          {library.length > 2 && (
            <div className="absolute -bottom-1 -right-1 w-16 h-[88px] card-back rounded-lg opacity-30" />
          )}
          {library.length > 1 && (
            <div className="absolute -bottom-0.5 -right-0.5 w-16 h-[88px] card-back rounded-lg opacity-50" />
          )}
          <motion.div
            className="w-16 h-[88px] card-back rounded-lg flex items-center justify-center relative"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-ocean-400/40 text-lg">🐠</span>
          </motion.div>
        </div>
        <div className="text-ocean-500 text-[10px] font-mono">
          Library ({library.length})
        </div>
      </div>

      {/* Phase / Stack area placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-ocean-700/30 text-xs italic">shared zones</div>
      </div>

      {/* Shared Graveyard */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          className={`
            w-16 h-[88px] rounded-lg flex items-center justify-center
            ${graveyard.length > 0
              ? 'bg-ocean-900/60 border border-ocean-700/40 cursor-pointer'
              : 'bg-ocean-950/30 border border-ocean-800/20'
            }
          `}
          onClick={onGraveyardClick}
          whileHover={graveyard.length > 0 ? { scale: 1.05 } : {}}
        >
          {topGraveyardDef ? (
            <div className="text-center p-1">
              <div className="text-[7px] text-ocean-300 truncate">{topGraveyardDef.name}</div>
              <div className="text-[6px] text-ocean-500">{topGraveyardDef.type}</div>
            </div>
          ) : (
            <span className="text-ocean-700/30 text-xs">empty</span>
          )}
        </motion.div>
        <div className="text-ocean-500 text-[10px] font-mono">
          Graveyard ({graveyard.length})
        </div>
      </div>
    </div>
  )
}
