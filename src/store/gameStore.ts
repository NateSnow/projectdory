import { create } from 'zustand'
import type { GameState, GameMode, GamePhase } from '../engine/gameState'
import { createInitialGameState } from '../engine/gameState'
import { buildDeck, shuffleDeck, getCardDefinition } from '../engine/cards'
import type { CardInstance, LogEntry } from '../engine/cards/types'

interface GameStore extends GameState {
  /** Initialize a new game */
  startGame: (mode: GameMode) => void

  /** Draw cards for a player from the shared library */
  drawCards: (playerId: string, count: number) => void

  /** Player keeps their hand (mulligan phase) */
  keepHand: (playerId: string) => void

  /** Player takes a mulligan */
  takeMulligan: (playerId: string) => void

  /** Play a land from hand */
  playLand: (playerId: string, cardInstanceId: string) => void

  /** Cast a spell from hand */
  castSpell: (playerId: string, cardInstanceId: string) => void

  /** Pass priority */
  passPriority: () => void

  /** Advance to next phase */
  advancePhase: () => void

  /** Tap a land for mana */
  tapLandForMana: (playerId: string, cardInstanceId: string) => void

  /** Declare attackers */
  declareAttackers: (playerId: string, attackerIds: string[]) => void

  /** Deal combat damage */
  resolveCombatDamage: () => void

  /** Add a log entry */
  addLog: (player: string, action: string) => void

  /** Set the winner */
  setWinner: (winnerId: string, reason: string) => void

  /** Concede the game */
  concede: (playerId: string) => void
}

const PHASE_ORDER: GamePhase[] = [
  'untap', 'upkeep', 'draw', 'main1',
  'combat_begin', 'declare_attackers', 'declare_blockers',
  'combat_damage', 'combat_end',
  'main2', 'end_step', 'cleanup',
]

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial empty state
  ...createInitialGameState('cpu'),

  startGame: (mode: GameMode) => {
    const state = createInitialGameState(mode)
    const deck = shuffleDeck(buildDeck())

    // Deal 7 cards to each player
    const p1Hand = deck.splice(0, 7)
    const p2Hand = deck.splice(0, 7)

    state.sharedLibrary = deck
    state.players['player1']!.hand = p1Hand
    state.players['player2']!.hand = p2Hand
    state.waitingForMulligan = true

    set(state)
  },

  drawCards: (playerId: string, count: number) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      const newLibrary = [...state.sharedLibrary]
      const newHand = [...player.hand]
      const drawn: CardInstance[] = []

      for (let i = 0; i < count; i++) {
        if (newLibrary.length === 0) {
          // Deck-out loss
          return {
            ...state,
            gameOver: true,
            winner: state.playerOrder.find(p => p !== playerId),
            winReason: `${player.name} tried to draw from an empty library`,
          }
        }
        const card = newLibrary.shift()!
        drawn.push(card)
        newHand.push(card)
      }

      const cardNames = drawn.map(c => getCardDefinition(c.definitionId).name).join(', ')

      return {
        ...state,
        sharedLibrary: newLibrary,
        players: {
          ...state.players,
          [playerId]: { ...player, hand: newHand },
        },
        gameLog: [
          ...state.gameLog,
          {
            turn: state.turnNumber,
            phase: state.phase,
            player: player.name,
            action: `drew ${count} card${count > 1 ? 's' : ''} (${playerId === 'player1' ? cardNames : 'hidden'})`,
            timestamp: Date.now(),
          },
        ],
      }
    })
  },

  keepHand: (playerId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      const updatedPlayer = { ...player, hasKeptHand: true }
      const updatedPlayers = { ...state.players, [playerId]: updatedPlayer }

      // Check if both players have kept
      const allKept = Object.values(updatedPlayers).every(p => p.hasKeptHand)

      return {
        ...state,
        players: updatedPlayers,
        phase: allKept ? 'untap' : state.phase,
        waitingForMulligan: !allKept,
        gameLog: [
          ...state.gameLog,
          {
            turn: state.turnNumber,
            phase: 'mulligan',
            player: player.name,
            action: 'kept hand',
            timestamp: Date.now(),
          },
        ],
      }
    })
  },

  takeMulligan: (playerId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      // Put hand back into library and shuffle
      const newLibrary = shuffleDeck([...state.sharedLibrary, ...player.hand])

      // Draw new hand (7 minus mulligans taken, minimum 1)
      const newHandSize = Math.max(1, 7 - player.mulligansTaken)
      const newHand = newLibrary.splice(0, newHandSize)

      return {
        ...state,
        sharedLibrary: newLibrary,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            hand: newHand,
            mulligansTaken: player.mulligansTaken + 1,
          },
        },
        gameLog: [
          ...state.gameLog,
          {
            turn: state.turnNumber,
            phase: 'mulligan',
            player: player.name,
            action: `took mulligan (hand size: ${newHandSize})`,
            timestamp: Date.now(),
          },
        ],
      }
    })
  },

  playLand: (playerId: string, cardInstanceId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player || player.landPlayedThisTurn) return state
      if (state.phase !== 'main1' && state.phase !== 'main2') return state
      if (state.activePlayer !== playerId) return state

      const cardIndex = player.hand.findIndex(c => c.id === cardInstanceId)
      if (cardIndex === -1) return state

      const card = player.hand[cardIndex]!
      const def = getCardDefinition(card.definitionId)
      if (def.type !== 'land') return state

      const newHand = [...player.hand]
      newHand.splice(cardIndex, 1)

      const landInstance: CardInstance = {
        ...card,
        owner: playerId,
        controller: playerId,
        tapped: def.entersTapped ?? false,
      }

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            hand: newHand,
            battlefield: [...player.battlefield, landInstance],
            landPlayedThisTurn: true,
          },
        },
        gameLog: [
          ...state.gameLog,
          {
            turn: state.turnNumber,
            phase: state.phase,
            player: player.name,
            action: `played ${def.name}`,
            timestamp: Date.now(),
          },
        ],
      }
    })
  },

  castSpell: (playerId: string, cardInstanceId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      const cardIndex = player.hand.findIndex(c => c.id === cardInstanceId)
      if (cardIndex === -1) return state

      const card = player.hand[cardIndex]!
      const def = getCardDefinition(card.definitionId)

      // Check mana
      if (player.manaPool < def.cmc) return state

      // Sorcery speed check
      if (def.type === 'sorcery' || def.type === 'creature' || def.type === 'enchantment') {
        if (state.activePlayer !== playerId) return state
        if (state.phase !== 'main1' && state.phase !== 'main2') return state
        if (state.stack.length > 0) return state
      }

      const newHand = [...player.hand]
      newHand.splice(cardIndex, 1)

      const stackItem = {
        id: `stack_${Date.now()}`,
        cardInstanceId: card.id,
        definitionId: card.definitionId,
        caster: playerId,
      }

      // Switch priority to opponent
      const opponent = state.playerOrder.find(p => p !== playerId)!

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            hand: newHand,
            manaPool: player.manaPool - def.cmc,
          },
        },
        stack: [...state.stack, stackItem],
        priorityPlayer: opponent,
        gameLog: [
          ...state.gameLog,
          {
            turn: state.turnNumber,
            phase: state.phase,
            player: player.name,
            action: `cast ${def.name}`,
            timestamp: Date.now(),
          },
        ],
      }
    })
  },

  passPriority: () => {
    set((state) => {
      const currentPriority = state.priorityPlayer
      const opponent = state.playerOrder.find(p => p !== currentPriority)!

      // If opponent already passed (we're back to active player passing)
      // then resolve top of stack or advance phase
      if (currentPriority === state.activePlayer && state.stack.length === 0) {
        // Both passed with empty stack — advance phase
        const currentPhaseIndex = PHASE_ORDER.indexOf(state.phase)
        const nextPhaseIndex = (currentPhaseIndex + 1) % PHASE_ORDER.length
        const nextPhase = PHASE_ORDER[nextPhaseIndex]!

        let nextActivePlayer = state.activePlayer
        let nextTurn = state.turnNumber

        // If we wrapped around to untap, it's a new turn
        if (nextPhase === 'untap') {
          nextActivePlayer = state.playerOrder.find(p => p !== state.activePlayer)!
          nextTurn = state.turnNumber + 1
        }

        return {
          ...state,
          phase: nextPhase,
          activePlayer: nextActivePlayer,
          priorityPlayer: nextActivePlayer,
          turnNumber: nextTurn,
          players: nextPhase === 'untap'
            ? {
                ...state.players,
                [nextActivePlayer]: {
                  ...state.players[nextActivePlayer]!,
                  landPlayedThisTurn: false,
                  attackedThisTurn: false,
                  manaPool: 0,
                  battlefield: state.players[nextActivePlayer]!.battlefield.map(c => ({
                    ...c,
                    tapped: false,
                    summoningSick: false,
                  })),
                },
              }
            : state.players,
        }
      }

      // Pass to opponent
      return {
        ...state,
        priorityPlayer: opponent,
      }
    })
  },

  advancePhase: () => {
    get().passPriority()
  },

  tapLandForMana: (playerId: string, cardInstanceId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      const cardIndex = player.battlefield.findIndex(c => c.id === cardInstanceId)
      if (cardIndex === -1) return state

      const card = player.battlefield[cardIndex]!
      if (card.tapped) return state

      const def = getCardDefinition(card.definitionId)
      if (def.type !== 'land') return state

      const newBattlefield = [...player.battlefield]
      newBattlefield[cardIndex] = { ...card, tapped: true }

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            battlefield: newBattlefield,
            manaPool: player.manaPool + 1,
          },
        },
      }
    })
  },

  declareAttackers: (playerId: string, attackerIds: string[]) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state
      if (state.phase !== 'declare_attackers') return state

      const opponent = state.playerOrder.find(p => p !== playerId)!
      const opponentState = state.players[opponent]!

      // Check if opponent controls an Island (Dandân restriction)
      const opponentHasIsland = opponentState.battlefield.some(c => {
        const def = getCardDefinition(c.definitionId)
        return def.subtype?.includes('Island') || def.id === 'island'
      })

      if (!opponentHasIsland && attackerIds.length > 0) return state

      const newBattlefield = player.battlefield.map(c => {
        if (attackerIds.includes(c.id)) {
          return { ...c, tapped: true }
        }
        return c
      })

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            battlefield: newBattlefield,
            attackedThisTurn: attackerIds.length > 0,
          },
        },
        gameLog: attackerIds.length > 0
          ? [
              ...state.gameLog,
              {
                turn: state.turnNumber,
                phase: state.phase,
                player: player.name,
                action: `attacked with ${attackerIds.length} Dandân`,
                timestamp: Date.now(),
              },
            ]
          : state.gameLog,
      }
    })
  },

  resolveCombatDamage: () => {
    set((state) => {
      if (state.phase !== 'combat_damage') return state

      const attacker = state.activePlayer
      const defender = state.playerOrder.find(p => p !== attacker)!
      const attackerState = state.players[attacker]!
      const defenderState = state.players[defender]!

      // Count tapped Dandân (attackers)
      const attackingDandan = attackerState.battlefield.filter(c => {
        const def = getCardDefinition(c.definitionId)
        return def.id === 'dandan' && c.tapped
      })

      if (attackingDandan.length === 0) return state

      const totalDamage = attackingDandan.length * 4
      const newLife = defenderState.life - totalDamage
      const newHits = defenderState.dandanHits + attackingDandan.length

      const gameOver = newLife <= 0

      return {
        ...state,
        players: {
          ...state.players,
          [defender]: {
            ...defenderState,
            life: newLife,
            dandanHits: newHits,
          },
        },
        gameOver,
        winner: gameOver ? attacker : undefined,
        winReason: gameOver ? `${defenderState.name}'s life reached ${newLife}` : undefined,
        gameLog: [
          ...state.gameLog,
          {
            turn: state.turnNumber,
            phase: state.phase,
            player: attackerState.name,
            action: `dealt ${totalDamage} combat damage (${attackingDandan.length} Dandân)`,
            timestamp: Date.now(),
          },
        ],
      }
    })
  },

  addLog: (player: string, action: string) => {
    set((state) => ({
      ...state,
      gameLog: [
        ...state.gameLog,
        {
          turn: state.turnNumber,
          phase: state.phase,
          player,
          action,
          timestamp: Date.now(),
        } satisfies LogEntry,
      ],
    }))
  },

  setWinner: (winnerId: string, reason: string) => {
    set((state) => ({
      ...state,
      gameOver: true,
      winner: winnerId,
      winReason: reason,
    }))
  },

  concede: (playerId: string) => {
    set((state) => {
      const player = state.players[playerId]
      const opponent = state.playerOrder.find(p => p !== playerId)!
      return {
        ...state,
        gameOver: true,
        winner: opponent,
        winReason: `${player?.name ?? playerId} conceded`,
      }
    })
  },
}))
