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
          {library.length > 2 && (
            <div className="absolute -bottom-1 -right-1 w-[76px] h-[106px] card-back rounded-lg opacity-30" />
          )}
          {library.length > 1 && (
            <div className="absolute -bottom-0.5 -right-0.5 w-[76px] h-[106px] card-back rounded-lg opacity-50" />
          )}
          <motion.div
            className="w-[76px] h-[106px] card-back rounded-lg flex items-center justify-center relative"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-wave-slate/30 text-xl">🐠</span>
          </motion.div>
        </div>
        <div className="text-wave-slate text-xs font-mono">
          Library ({library.length})
        </div>
      </div>

      {/* Center divider */}
      <div className="flex-1 flex items-center justify-center">
        <div className="wave-divider w-full" />
      </div>

      {/* Shared Graveyard */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          className={`
            w-[76px] h-[106px] rounded-lg flex items-center justify-center
            ${graveyard.length > 0
              ? 'bg-wave-deep/80 border border-wave-indigo/30 cursor-pointer'
              : 'bg-wave-deepest/50 border border-wave-indigo/15'
            }
          `}
          onClick={onGraveyardClick}
          whileHover={graveyard.length > 0 ? { scale: 1.05 } : {}}
        >
          {topGraveyardDef ? (
            <div className="text-center p-1.5">
              <div className="text-[10px] text-wave-foam/80 truncate">{topGraveyardDef.name}</div>
              <div className="text-[8px] text-wave-slate/60">{topGraveyardDef.type}</div>
            </div>
          ) : (
            <span className="text-wave-indigo/30 text-xs">empty</span>
          )}
        </motion.div>
        <div className="text-wave-slate text-xs font-mono">
          Graveyard ({graveyard.length})
        </div>
      </div>
    </div>
  )
}
