import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
  const [logOpen, setLogOpen] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const isMyTurn = activePlayer === 'player1'

  // ─── Show brief feedback messages ───────────────────────────────────
  const showFeedback = useCallback((msg: string) => {
    setActionFeedback(msg)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setActionFeedback(null), 2000)
  }, [])

  // ─── Compute which cards in hand are playable ───────────────────────
  const playableCardIds = useMemo(() => {
    if (!isMyPriority || waitingForMulligan || gameOver) return new Set<string>()

    const ids = new Set<string>()
    const untappedLandCount = player1.battlefield.filter(c => {
      const d = getCardDefinition(c.definitionId)
      return d.type === 'land' && !c.tapped
    }).length
    const totalMana = player1.manaPool + untappedLandCount

    for (const card of player1.hand) {
      const def = getCardDefinition(card.definitionId)

      if (def.type === 'land') {
        // Can play a land if: it's our main phase, our turn, haven't played one yet, stack empty
        if (isMyTurn && !player1.landPlayedThisTurn &&
            (phase === 'main1' || phase === 'main2') && stack.length === 0) {
          ids.add(card.id)
        }
      } else {
        // Can cast a spell if we have enough mana
        if (totalMana < def.cmc) continue

        // Sorcery-speed cards need: our turn, main phase, empty stack
        if (def.type === 'sorcery' || def.type === 'creature' || def.type === 'enchantment') {
          if (!isMyTurn || (phase !== 'main1' && phase !== 'main2') || stack.length > 0) continue
        }

        ids.add(card.id)
      }
    }

    return ids
  }, [isMyPriority, isMyTurn, waitingForMulligan, gameOver, player1.hand, player1.battlefield,
      player1.manaPool, player1.landPlayedThisTurn, phase, stack.length])

  // ─── CPU Game Loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'cpu' || gameOver) return

    const cpuNeedsToAct =
      (priorityPlayer === 'player2' && !waitingForMulligan) ||
      (waitingForMulligan && !player2.hasKeptHand)

    if (!cpuNeedsToAct) return

    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current)

    const delay = waitingForMulligan ? 800 : stack.length > 0 ? 1000 : 500
    cpuTimerRef.current = setTimeout(() => {
      runCpuAction()
    }, delay)

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current)
    }
  }, [mode, gameOver, priorityPlayer, waitingForMulligan, player2.hasKeptHand, phase, stack.length, runCpuAction])

  // ─── Handle card click from hand — Arena-style single click ─────────
  const handleHandCardClick = useCallback((cardId: string) => {
    if (waitingForMulligan) return // during mulligan, cards aren't playable

    if (!isMyPriority) {
      showFeedback("Not your priority — wait for opponent")
      return
    }

    const card = player1.hand.find(c => c.id === cardId)
    if (!card) return

    const def = getCardDefinition(card.definitionId)

    // Land — just play it
    if (def.type === 'land') {
      if (!playableCardIds.has(cardId)) {
        if (player1.landPlayedThisTurn) {
          showFeedback("Already played a land this turn")
        } else {
          showFeedback("Can only play lands during your main phase")
        }
        return
      }
      playLand('player1', cardId)
      showFeedback(`Played ${def.name}`)
      return
    }

    // Spell — auto-tap and cast
    if (!playableCardIds.has(cardId)) {
      const untappedLandCount = player1.battlefield.filter(c => {
        const d = getCardDefinition(c.definitionId)
        return d.type === 'land' && !c.tapped
      }).length
      const totalMana = player1.manaPool + untappedLandCount

      if (totalMana < def.cmc) {
        showFeedback(`Need ${def.cmc} mana, have ${totalMana}`)
      } else {
        showFeedback("Can't cast that right now")
      }
      return
    }

    castSpell('player1', cardId)
    showFeedback(`Cast ${def.name}`)
  }, [isMyPriority, waitingForMulligan, player1.hand, player1.battlefield, player1.manaPool,
      player1.landPlayedThisTurn, playableCardIds, playLand, castSpell, showFeedback])

  // ─── Handle battlefield card click (manual tap for mana) ────────────
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
    if (phase !== 'declare_attackers' || !isMyTurn) return

    const dandanIds = player1.battlefield
      .filter(c => {
        const def = getCardDefinition(c.definitionId)
        return def.id === 'dandan' && !c.tapped && !c.summoningSick
      })
      .map(c => c.id)

    declareAttackers('player1', dandanIds)
  }, [phase, isMyTurn, player1.battlefield, declareAttackers])

  const handleSkipAttack = useCallback(() => {
    if (phase !== 'declare_attackers' || !isMyTurn) return
    declareAttackers('player1', [])
  }, [phase, isMyTurn, declareAttackers])

  const attackableDandanCount = player1.battlefield.filter(c => {
    const def = getCardDefinition(c.definitionId)
    return def.id === 'dandan' && !c.tapped && !c.summoningSick
  }).length

  return (
    <div className="h-full w-full wave-board-bg flex flex-col relative overflow-hidden">
      {/* Game Log */}
      <GameLog entries={gameLog} isOpen={logOpen} onToggle={() => setLogOpen(!logOpen)} />

      {/* Action feedback toast */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       glass-panel px-5 py-2.5 text-sm text-wave-cream font-body pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {actionFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opponent info bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-wave-indigo/20">
        <PlayerInfo
          player={player2}
          isActive={activePlayer === 'player2'}
          hasPriority={priorityPlayer === 'player2'}
        />
        <PhaseTracker currentPhase={phase} turnNumber={turnNumber} />
      </div>

      {/* Opponent hand (face down) */}
      <div className="flex justify-center py-1">
        <Hand cards={player2.hand} faceDown label={`${player2.name}'s Hand`} />
      </div>

      {/* Opponent battlefield */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-wave-indigo/15 py-1">
          <Battlefield cards={player2.battlefield} flipped />
        </div>

        {/* Shared zones (library + graveyard) */}
        <div className="py-2 px-8">
          <SharedZones
            library={sharedLibrary}
            graveyard={sharedGraveyard}
          />
        </div>

        {/* Stack display */}
        <AnimatePresence>
          {stack.length > 0 && (
            <motion.div
              className="flex justify-center gap-2 py-1"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="glass-panel px-3 py-2 border-wave-crest/20">
                <div className="text-[10px] text-wave-slate mb-1">Stack</div>
                <div className="flex flex-col-reverse gap-1">
                  {stack.map((item, i) => {
                    const def = getCardDefinition(item.definitionId)
                    const casterName = players[item.caster]?.name ?? 'Unknown'
                    return (
                      <div
                        key={item.id}
                        className={`text-xs px-2 py-1 rounded ${
                          i === stack.length - 1
                            ? 'text-wave-crest bg-wave-prussian/60'
                            : 'text-wave-slate bg-wave-deep/60'
                        }`}
                      >
                        {def.name} <span className="text-wave-indigo">({casterName})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Your battlefield */}
        <div className="border-t border-wave-indigo/15 py-1">
          <Battlefield
            cards={player1.battlefield}
            onCardClick={handleBattlefieldClick}
            interactive={isMyPriority}
          />
        </div>
      </div>

      {/* Your hand */}
      <div className="flex justify-center py-1">
        <Hand
          cards={player1.hand}
          onCardClick={handleHandCardClick}
          interactive={isMyPriority || waitingForMulligan}
          playableCardIds={playableCardIds}
          label="Your Hand"
        />
      </div>

      {/* Your info bar + action buttons */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-wave-indigo/20">
        <PlayerInfo
          player={player1}
          isActive={isMyTurn}
          hasPriority={isMyPriority}
        />

        <div className="flex gap-2 items-center">
          {/* Phase hint */}
          {!waitingForMulligan && isMyPriority && !gameOver && (
            <span className="text-wave-slate text-xs mr-2">
              {phase === 'declare_attackers' && isMyTurn
                ? 'Declare attackers'
                : stack.length > 0
                  ? 'Respond or pass'
                  : phase === 'main1' || phase === 'main2'
                    ? 'Click a card to play it'
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
          {phase === 'declare_attackers' && isMyTurn && isMyPriority && (
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
              className="text-wave-indigo hover:text-red-400 text-xs transition-colors"
            >
              Concede
            </button>
          )}

          {/* Back to menu */}
          <button
            onClick={() => navigate('/')}
            className="text-wave-indigo hover:text-wave-foam text-xs transition-colors"
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
              <p className="text-wave-slate mb-6">{winReason}</p>
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
