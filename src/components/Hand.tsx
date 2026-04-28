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
}

export default function Hand({
  cards,
  faceDown = false,
  onCardClick,
  selectedCardId,
  interactive = false,
  label,
}: HandProps) {
  const cardCount = cards.length
  const maxSpread = 400
  const cardWidth = 100
  const totalWidth = Math.min(cardCount * 60, maxSpread)
  const spacing = cardCount > 1 ? totalWidth / (cardCount - 1) : 0

  return (
    <div className="flex flex-col items-center">
      {label && (
        <div className="text-wave-slate text-xs mb-1 font-body">{label}</div>
      )}
      <div
        className="relative flex items-end justify-center"
        style={{
          width: totalWidth + cardWidth,
          height: faceDown ? 100 : 160,
        }}
      >
        {cards.map((card, index) => {
          const offset = cardCount > 1
            ? (index - (cardCount - 1) / 2) * spacing
            : 0
          const rotation = cardCount > 1
            ? (index - (cardCount - 1) / 2) * 3
            : 0
          const yOffset = Math.abs(index - (cardCount - 1) / 2) * 4

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
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <Card
                card={card}
                faceDown={faceDown}
                size="md"
                onClick={() => onCardClick?.(card.id)}
                highlighted={selectedCardId === card.id}
                interactive={interactive}
              />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
