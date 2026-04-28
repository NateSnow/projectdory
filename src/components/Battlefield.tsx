import { motion } from 'framer-motion'
import Card from './Card'
import type { CardInstance } from '../engine/cards/types'
import { getCardDefinition } from '../engine/cards'

interface BattlefieldProps {
  cards: CardInstance[]
  onCardClick?: (cardId: string) => void
  selectedCardId?: string | null
  interactive?: boolean
  flipped?: boolean
}

export default function Battlefield({
  cards,
  onCardClick,
  selectedCardId,
  interactive = false,
  flipped = false,
}: BattlefieldProps) {
  const lands = cards.filter(c => getCardDefinition(c.definitionId).type === 'land')
  const nonLands = cards.filter(c => getCardDefinition(c.definitionId).type !== 'land')

  const renderRow = (rowCards: CardInstance[], label: string) => (
    <div className="flex gap-2 items-center justify-center flex-wrap">
      {rowCards.length === 0 ? (
        <div className="text-wave-indigo/40 text-xs italic">{label}</div>
      ) : (
        rowCards.map((card) => (
          <motion.div
            key={card.id}
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <Card
              card={card}
              tapped={card.tapped}
              size="sm"
              onClick={() => onCardClick?.(card.id)}
              highlighted={selectedCardId === card.id}
              interactive={interactive}
              showHoverPreview={interactive}
            />
          </motion.div>
        ))
      )}
    </div>
  )

  return (
    <div className={`flex flex-col gap-2 px-4 py-2 ${flipped ? 'flex-col-reverse' : ''}`}>
      {renderRow(nonLands, 'creatures & enchantments')}
      {renderRow(lands, 'lands')}
    </div>
  )
}
