import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getCardDefinition } from '../engine/cards'
import { getCardImageUrl, getCardImageFallbackUrl } from '../hooks/useScryfall'
import type { CardInstance } from '../engine/cards/types'

interface CardProps {
  card: CardInstance
  faceDown?: boolean
  tapped?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  onRightClick?: () => void
  highlighted?: boolean
  interactive?: boolean
  className?: string
  /** Show a large hover preview floating above the card */
  showHoverPreview?: boolean
}

const SIZE_MAP = {
  sm: { width: 80, height: 112 },
  md: { width: 130, height: 182 },
  lg: { width: 200, height: 280 },
}

/** The large preview shown on hover */
const PREVIEW_SIZE = { width: 250, height: 350 }

export default function Card({
  card,
  faceDown = false,
  tapped = false,
  size = 'md',
  onClick,
  onRightClick,
  highlighted = false,
  interactive = false,
  className = '',
  showHoverPreview = false,
}: CardProps) {
  const [imgError, setImgError] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const [hovered, setHovered] = useState(false)
  const def = getCardDefinition(card.definitionId)
  const dimensions = SIZE_MAP[size]

  // Use 'normal' size for all cards now since they're bigger
  const scryfallSize = 'normal'
  const imageUrl = useFallback
    ? getCardImageFallbackUrl(def.name, scryfallSize)
    : getCardImageUrl(def.name, scryfallSize)

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    onRightClick?.()
  }

  if (faceDown) {
    return (
      <motion.div
        className={`card-back rounded-lg flex items-center justify-center select-none ${className}`}
        style={{ width: dimensions.width, height: dimensions.height }}
        whileHover={interactive ? { y: -4 } : {}}
      >
        <div className="text-wave-slate/30 text-2xl font-display">🐠</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`
        relative rounded-lg overflow-visible cursor-pointer select-none
        ${tapped ? 'rotate-90' : ''}
        ${className}
      `}
      style={{ width: dimensions.width, height: dimensions.height }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={interactive ? { y: -12, scale: 1.08, zIndex: 50 } : {}}
      whileTap={interactive ? { scale: 0.95 } : {}}
      layout
    >
      {/* The actual card */}
      <div
        className={`
          w-full h-full rounded-lg overflow-hidden
          ${highlighted ? 'ring-2 ring-wave-crest shadow-glow' : 'shadow-card'}
          ${interactive ? 'hover:shadow-card-hover' : ''}
        `}
      >
        {!imgError ? (
          <img
            src={imageUrl}
            alt={def.name}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
            onError={() => {
              if (!useFallback) {
                setUseFallback(true)
              } else {
                setImgError(true)
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-wave-deep border border-wave-indigo rounded-lg p-2 flex flex-col">
            <div className="text-xs font-bold text-wave-foam truncate">{def.name}</div>
            <div className="text-[10px] text-wave-slate truncate">{def.manaCost}</div>
            <div className="flex-1 mt-1">
              <div className="text-[9px] text-wave-slate/70 leading-tight line-clamp-6">
                {def.oracleText}
              </div>
            </div>
            {def.power !== undefined && (
              <div className="text-xs text-wave-foam/80 text-right font-bold">
                {def.power}/{def.toughness}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Large hover preview — floats above the card */}
      <AnimatePresence>
        {showHoverPreview && hovered && !faceDown && !tapped && (
          <motion.div
            className="absolute z-[100] pointer-events-none"
            style={{
              width: PREVIEW_SIZE.width,
              height: PREVIEW_SIZE.height,
              bottom: dimensions.height + 12,
              left: '50%',
              translateX: '-50%',
            }}
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 20 }}
            transition={{ duration: 0.15 }}
          >
            <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-wave-crest/30">
              {!imgError ? (
                <img
                  src={imageUrl}
                  alt={def.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full bg-wave-deep border border-wave-indigo rounded-xl p-4 flex flex-col">
                  <div className="text-base font-bold text-wave-foam">{def.name}</div>
                  <div className="text-sm text-wave-slate">{def.manaCost}</div>
                  <div className="text-xs text-wave-slate/60 mt-1">{def.type}{def.subtype ? ` — ${def.subtype}` : ''}</div>
                  <div className="flex-1 mt-2">
                    <div className="text-sm text-wave-foam/80 leading-relaxed whitespace-pre-line">
                      {def.oracleText}
                    </div>
                  </div>
                  {def.power !== undefined && (
                    <div className="text-lg text-wave-foam font-bold text-right mt-2">
                      {def.power}/{def.toughness}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
