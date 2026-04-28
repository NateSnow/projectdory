import { motion } from 'framer-motion'
import Card from './Card'
import type { CardInstance } from '../engine/cards/types'

interface HandProps {
  cards: CardInstance[]
  faceDown?: boolean
  onCardClick?: (cardId: string) => void
  selectedCardId?: string | null
  interactive?: boolean
  label?: string
  /** Set of card instance IDs that can currently be played */
  playableCardIds?: Set<string>
}

export default function Hand({
  cards,
  faceDown = false,
  onCardClick,
  selectedCardId,
  interactive = false,
  label,
  playableCardIds,
}: HandProps) {
  const cardCount = cards.length
  const cardWidth = faceDown ? 80 : 130
  const maxSpread = 600
  const totalWidth = Math.min(cardCount * 80, maxSpread)
  const spacing = cardCount > 1 ? totalWidth / (cardCount - 1) : 0

  return (
    <div className="flex flex-col items-center">
      {label && (
        <div className="text-wave-slate text-xs mb-1 font-body">{label}</div>
      )}
      <div
        className="relative flex items-end justify-center"
        style={{
          width: totalWidth + cardWidth + 40,
          height: faceDown ? 120 : 200,
        }}
      >
        {cards.map((card, index) => {
          const offset = cardCount > 1
            ? (index - (cardCount - 1) / 2) * spacing
            : 0
          const rotation = cardCount > 1
            ? (index - (cardCount - 1) / 2) * 2.5
            : 0
          const yOffset = Math.abs(index - (cardCount - 1) / 2) * 3
          const isPlayable = playableCardIds?.has(card.id) ?? false

          return (
            <motion.div
              key={card.id}
              className="absolute"
              style={{
                left: '50%',
                zIndex: index,
              }}
              initial={false}
              animate={{
                x: offset - cardWidth / 2,
                y: yOffset,
                rotate: rotation,
              }}
              whileHover={{ zIndex: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <Card
                card={card}
                faceDown={faceDown}
                size={faceDown ? 'sm' : 'md'}
                onClick={() => onCardClick?.(card.id)}
                highlighted={selectedCardId === card.id || isPlayable}
                interactive={interactive}
                showHoverPreview={!faceDown && interactive}
                playable={isPlayable}
              />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
