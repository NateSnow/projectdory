import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { getCardDefinition } from '../engine/cards'
import Hand from './Hand'
import Battlefield from './Battlefield'
import PlayerInfo from './PlayerInfo'
import PhaseTracker from './PhaseTracker'
import SharedZones from './SharedZones'
import GameLog from './GameLog'

export default function GameBoard() {
  const navigate = useNavigate()
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    players, sharedLibrary, sharedGraveyard,
    activePlayer, priorityPlayer, phase, turnNumber, stack,
    gameOver, winner, winReason, gameLog, mode,
    waitingForMulligan,
    keepHand, takeMulligan, playLand, castSpell, passPriority,
    tapLandForMana, declareAttackers,
    concede, runCpuAction,
  } = useGameStore()

  const player1 = players['player1']!
  const player2 = players['player2']!
  const isMyPriority = priorityPlayer === 'player1'

  // ─── CPU Game Loop ──────────────────────────────────────────────────
  // The CPU acts whenever it has priority or needs to make a mulligan decision.
  // We use a timer to add a natural delay between CPU actions.
  useEffect(() => {
    if (mode !== 'cpu' || gameOver) return

    const cpuNeedsToAct =
      (priorityPlayer === 'player2' && !waitingForMulligan) ||
      (waitingForMulligan && !player2.hasKeptHand)

    if (!cpuNeedsToAct) return

    // Clear any existing timer
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current)

    // Add delay for natural feel
    const delay = waitingForMulligan ? 800 : stack.length > 0 ? 1000 : 500
    cpuTimerRef.current = setTimeout(() => {
      runCpuAction()
    }, delay)

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current)
    }
  }, [mode, gameOver, priorityPlayer, waitingForMulligan, player2.hasKeptHand, phase, stack.length, runCpuAction])

  // ─── Handle card click from hand ────────────────────────────────────
  const handleHandCardClick = useCallback((cardId: string) => {
    if (!isMyPriority && !waitingForMulligan) return

    const card = player1.hand.find(c => c.id === cardId)
    if (!card) return

    const def = getCardDefinition(card.definitionId)

    if (selectedCard === cardId) {
      // Double-click to play
      if (def.type === 'land') {
        playLand('player1', cardId)
      } else if (player1.manaPool >= def.cmc) {
        castSpell('player1', cardId)
      }
      setSelectedCard(null)
    } else {
      setSelectedCard(cardId)
    }
  }, [isMyPriority, waitingForMulligan, player1.hand, player1.manaPool, selectedCard, playLand, castSpell])

  // ─── Handle battlefield card click (tap for mana) ───────────────────
  const handleBattlefieldClick = useCallback((cardId: string) => {
    const card = player1.battlefield.find(c => c.id === cardId)
    if (!card) return

    const def = getCardDefinition(card.definitionId)
    if (def.type === 'land' && !card.tapped) {
      tapLandForMana('player1', cardId)
    }
  }, [player1.battlefield, tapLandForMana])

  // ─── Handle attack ──────────────────────────────────────────────────
  const handleAttack = useCallback(() => {
    if (phase !== 'declare_attackers' || activePlayer !== 'player1') return

    const dandanIds = player1.battlefield
      .filter(c => {
        const def = getCardDefinition(c.definitionId)
        return def.id === 'dandan' && !c.tapped && !c.summoningSick
      })
      .map(c => c.id)

    declareAttackers('player1', dandanIds)
  }, [phase, activePlayer, player1.battlefield, declareAttackers])

  // ─── Handle skip attack ─────────────────────────────────────────────
  const handleSkipAttack = useCallback(() => {
    if (phase !== 'declare_attackers' || activePlayer !== 'player1') return
    declareAttackers('player1', [])
  }, [phase, activePlayer, declareAttackers])

  // ─── Count playable Dandân for attack button ────────────────────────
  const attackableDandanCount = player1.battlefield.filter(c => {
    const def = getCardDefinition(c.definitionId)
    return def.id === 'dandan' && !c.tapped && !c.summoningSick
  }).length

  return (
    <div className="h-full w-full bg-ocean-gradient flex flex-col relative overflow-hidden">
      {/* Game Log */}
      <GameLog entries={gameLog} isOpen={logOpen} onToggle={() => setLogOpen(!logOpen)} />

      {/* Opponent info bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-ocean-800/30">
        <PlayerInfo
          player={player2}
          isActive={activePlayer === 'player2'}
          hasPriority={priorityPlayer === 'player2'}
        />
        <PhaseTracker currentPhase={phase} turnNumber={turnNumber} />
      </div>

      {/* Opponent hand (face down) */}
      <div className="flex justify-center py-2">
        <Hand cards={player2.hand} faceDown label={`${player2.name}'s Hand`} />
      </div>

      {/* Opponent battlefield */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-ocean-800/20 py-1">
          <Battlefield cards={player2.battlefield} flipped />
        </div>

        {/* Shared zones (library + graveyard) */}
        <div className="py-3 px-8">
          <SharedZones
            library={sharedLibrary}
            graveyard={sharedGraveyard}
          />
        </div>

        {/* Stack display */}
        <AnimatePresence>
          {stack.length > 0 && (
            <motion.div
              className="flex justify-center gap-2 py-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="glass-panel px-3 py-2 border-dory-glow/30">
                <div className="text-[10px] text-ocean-500 mb-1">Stack</div>
                <div className="flex flex-col-reverse gap-1">
                  {stack.map((item, i) => {
                    const def = getCardDefinition(item.definitionId)
                    const casterName = players[item.caster]?.name ?? 'Unknown'
                    return (
                      <div
                        key={item.id}
                        className={`text-xs px-2 py-1 rounded ${
                          i === stack.length - 1
                            ? 'text-dory-glow bg-ocean-800/60'
                            : 'text-ocean-400 bg-ocean-900/40'
                        }`}
                      >
                        {def.name} <span className="text-ocean-500">({casterName})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Your battlefield */}
        <div className="border-t border-ocean-800/20 py-1">
          <Battlefield
            cards={player1.battlefield}
            onCardClick={handleBattlefieldClick}
            interactive={isMyPriority}
          />
        </div>
      </div>

      {/* Your hand */}
      <div className="flex justify-center py-2">
        <Hand
          cards={player1.hand}
          onCardClick={handleHandCardClick}
          selectedCardId={selectedCard}
          interactive={isMyPriority || waitingForMulligan}
          label="Your Hand"
        />
      </div>

      {/* Your info bar + action buttons */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-ocean-800/30">
        <PlayerInfo
          player={player1}
          isActive={activePlayer === 'player1'}
          hasPriority={priorityPlayer === 'player1'}
        />

        <div className="flex gap-2 items-center">
          {/* Phase hint */}
          {!waitingForMulligan && isMyPriority && !gameOver && (
            <span className="text-ocean-500 text-xs mr-2">
              {phase === 'declare_attackers' && activePlayer === 'player1'
                ? 'Declare attackers'
                : stack.length > 0
                  ? 'Respond or pass'
                  : phase === 'main1' || phase === 'main2'
                    ? 'Play cards or pass'
                    : 'Pass to continue'
              }
            </span>
          )}

          {/* Mulligan buttons */}
          {waitingForMulligan && !player1.hasKeptHand && (
            <>
              <button onClick={() => keepHand('player1')} className="btn-primary text-sm">
                Keep Hand
              </button>
              <button onClick={() => takeMulligan('player1')} className="btn-secondary text-sm">
                Mulligan
              </button>
            </>
          )}

          {/* Attack buttons */}
          {phase === 'declare_attackers' && activePlayer === 'player1' && isMyPriority && (
            <>
              {attackableDandanCount > 0 && (
                <button onClick={handleAttack} className="btn-primary text-sm">
                  ⚔️ Attack ({attackableDandanCount})
                </button>
              )}
              <button onClick={handleSkipAttack} className="btn-secondary text-sm">
                Skip Attack
              </button>
            </>
          )}

          {/* Pass priority */}
          {!waitingForMulligan && isMyPriority && !gameOver && phase !== 'declare_attackers' && (
            <button onClick={passPriority} className="btn-secondary text-sm">
              Pass →
            </button>
          )}

          {/* Concede */}
          {!gameOver && (
            <button
              onClick={() => concede('player1')}
              className="text-ocean-600 hover:text-red-400 text-xs transition-colors"
            >
              Concede
            </button>
          )}

          {/* Back to menu */}
          <button
            onClick={() => navigate('/')}
            className="text-ocean-600 hover:text-ocean-300 text-xs transition-colors"
          >
            Menu
          </button>
        </div>
      </div>

      {/* Game Over overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            className="absolute inset-0 bg-black/70 flex items-center justify-center z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-panel p-8 text-center max-w-md"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="text-4xl mb-4">
                {winner === 'player1' ? '🏆' : '🐟'}
              </div>
              <h2 className="font-display text-3xl text-white mb-2">
                {winner === 'player1' ? 'Victory!' : 'Defeat'}
              </h2>
              <p className="text-ocean-400 mb-6">{winReason}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    useGameStore.getState().startGame(mode)
                  }}
                  className="btn-primary"
                >
                  Play Again
                </button>
                <button onClick={() => navigate('/')} className="btn-secondary">
                  Main Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
