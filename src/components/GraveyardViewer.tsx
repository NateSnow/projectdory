import { motion, AnimatePresence } from 'framer-motion'
import type { CardInstance } from '../engine/cards/types'
import { getCardDefinition } from '../engine/cards'
import Card from './Card'

interface GraveyardViewerProps {
  cards: CardInstance[]
  isOpen: boolean
  onClose: () => void
}

export default function GraveyardViewer({ cards, isOpen, onClose }: GraveyardViewerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          {/* Panel */}
          <motion.div
            className="relative glass-panel p-5 max-w-3xl w-[90%] max-h-[80vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg text-wave-cream">
                Shared Graveyard ({cards.length} cards)
              </h3>
              <button
                onClick={onClose}
                className="text-wave-slate hover:text-wave-cream text-xl transition-colors px-2"
              >
                ✕
              </button>
            </div>

            {/* Card grid */}
            <div className="flex-1 overflow-y-auto">
              {cards.length === 0 ? (
                <div className="text-wave-indigo text-sm text-center py-8 italic">
                  The graveyard is empty
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pb-2">
                  {[...cards].reverse().map((card, i) => (
                    <div key={`${card.id}-${i}`} className="flex flex-col items-center gap-1">
                      <Card
                        card={card}
                        size="sm"
                        showHoverPreview
                        interactive
                      />
                      <span className="text-[9px] text-wave-slate truncate max-w-[80px]">
                        {getCardDefinition(card.definitionId).name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
