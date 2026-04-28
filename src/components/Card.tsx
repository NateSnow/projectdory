import { useState } from 'react'
import { motion } from 'framer-motion'
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
}

const SIZE_MAP = {
  sm: { width: 63, height: 88 },
  md: { width: 100, height: 140 },
  lg: { width: 146, height: 204 },
}

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
}: CardProps) {
  const [imgError, setImgError] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const def = getCardDefinition(card.definitionId)
  const dimensions = SIZE_MAP[size]

  const scryfallSize = size === 'sm' ? 'small' : 'normal'
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
        relative rounded-lg overflow-hidden cursor-pointer select-none
        ${highlighted ? 'ring-2 ring-wave-crest shadow-glow' : 'shadow-card'}
        ${interactive ? 'hover:shadow-card-hover' : ''}
        ${tapped ? 'rotate-90' : ''}
        ${className}
      `}
      style={{ width: dimensions.width, height: dimensions.height }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      whileHover={interactive ? { y: -8, scale: 1.05 } : {}}
      whileTap={interactive ? { scale: 0.95 } : {}}
      layout
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
        /* Fallback text card */
        <div className="w-full h-full bg-wave-deep border border-wave-indigo rounded-lg p-1.5 flex flex-col">
          <div className="text-[8px] font-bold text-wave-foam truncate">{def.name}</div>
          <div className="text-[7px] text-wave-slate truncate">{def.manaCost}</div>
          <div className="flex-1 mt-1">
            <div className="text-[6px] text-wave-slate/70 leading-tight line-clamp-4">
              {def.oracleText}
            </div>
          </div>
          {def.power !== undefined && (
            <div className="text-[8px] text-wave-foam/80 text-right">
              {def.power}/{def.toughness}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
