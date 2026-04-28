/**
 * Game Store — Zustand state management for Project Dory
 *
 * Implements proper MTG rules:
 * - APNAP priority (Active Player, Non-Active Player)
 * - Mana pools empty at the end of each step/phase
 * - Stack resolves LIFO; both players must pass for resolution
 * - Untap step: no priority given
 * - Summoning sickness: creatures can't attack the turn they enter
 * - Dandân sacrifice trigger: checked whenever state changes
 *
 * DanDân-specific:
 * - Shared library and graveyard
 * - "Owner" = whoever cast the card
 * - Free mulligan if hand has <2 lands or <2 spells
 */

import { create } from 'zustand'
import type { GameState, GameMode, GamePhase } from '../engine/gameState'
import { createInitialGameState } from '../engine/gameState'
import { buildDeck, shuffleDeck, getCardDefinition } from '../engine/cards'
import type { CardInstance, LogEntry } from '../engine/cards/types'
import {
  resolveTopOfStack,
  drawCards as engineDrawCards,
  checkDandanSacrifice,
} from '../engine/spellResolver'
import { decideCpuAction } from '../engine/ai/cpu'

// ─── Phase ordering ─────────────────────────────────────────────────────────

const PHASE_ORDER: GamePhase[] = [
  'untap', 'upkeep', 'draw', 'main1',
  'combat_begin', 'declare_attackers', 'declare_blockers',
  'combat_damage', 'combat_end',
  'main2', 'end_step', 'cleanup',
]

function nextPhase(current: GamePhase): GamePhase {
  const idx = PHASE_ORDER.indexOf(current)
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return 'untap'
  return PHASE_ORDER[idx + 1]!
}

// ─── Store interface ────────────────────────────────────────────────────────

interface GameStore extends GameState {
  /** Extra turn tracking */
  extraTurns: number
  extraTurnPlayer: string | null

  /** Tracks whether the non-active player has passed (for priority resolution) */
  lastPasser: string | null

  /** Tracks declared attackers for combat damage */
  declaredAttackerIds: string[]

  // ─── Actions ────────────────────────────────────────────────────────
  startGame: (mode: GameMode) => void
  keepHand: (playerId: string) => void
  takeMulligan: (playerId: string) => void
  playLand: (playerId: string, cardInstanceId: string) => void
  castSpell: (playerId: string, cardInstanceId: string) => void
  passPriority: () => void
  tapLandForMana: (playerId: string, cardInstanceId: string) => void
  declareAttackers: (playerId: string, attackerIds: string[]) => void
  concede: (playerId: string) => void

  /** Internal: run the CPU's turn logic */
  runCpuAction: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(state: GameState, player: string, action: string): LogEntry {
  return {
    turn: state.turnNumber,
    phase: state.phase,
    player,
    action,
    timestamp: Date.now(),
  }
}

function opponentOf(state: GameState, playerId: string): string {
  return state.playerOrder.find(p => p !== playerId)!
}

/**
 * Empty mana pools for both players (happens at end of each step/phase).
 */
function emptyManaPools(state: GameState): GameState {
  const updated = { ...state.players }
  for (const pid of state.playerOrder) {
    updated[pid] = { ...updated[pid]!, manaPool: 0 }
  }
  return { ...state, players: updated }
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialGameState('cpu'),
  extraTurns: 0,
  extraTurnPlayer: null,
  lastPasser: null,
  declaredAttackerIds: [],

  // ═══════════════════════════════════════════════════════════════════════════
  // START GAME
  // ═══════════════════════════════════════════════════════════════════════════

  startGame: (mode: GameMode) => {
    const state = createInitialGameState(mode)
    const deck = shuffleDeck(buildDeck())

    // Deal 7 cards to each player (alternating, active player first)
    const p1Hand: CardInstance[] = []
    const p2Hand: CardInstance[] = []
    for (let i = 0; i < 7; i++) {
      p1Hand.push(deck.shift()!)
      p2Hand.push(deck.shift()!)
    }

    state.sharedLibrary = deck
    state.players['player1']!.hand = p1Hand
    state.players['player2']!.hand = p2Hand
    state.waitingForMulligan = true

    set({
      ...state,
      extraTurns: 0,
      extraTurnPlayer: null,
      lastPasser: null,
      declaredAttackerIds: [],
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULLIGAN
  // ═══════════════════════════════════════════════════════════════════════════

  keepHand: (playerId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      const updatedPlayers = {
        ...state.players,
        [playerId]: { ...player, hasKeptHand: true },
      }

      const allKept = Object.values(updatedPlayers).every(p => p.hasKeptHand)

      const newLog = [...state.gameLog, log(state, player.name, 'kept hand')]

      if (allKept) {
        // Skip directly to upkeep (untap has nothing to untap on turn 1)
        // Per MTG rules: no priority during untap step
        // First player skips their draw on turn 1
        return {
          ...state,
          players: updatedPlayers,
          phase: 'main1' as GamePhase,
          waitingForMulligan: false,
          lastPasser: null,
          gameLog: [
            ...newLog,
            log(state, 'Game', 'Turn 1 begins — first player skips draw'),
          ],
        }
      }

      return { ...state, players: updatedPlayers, gameLog: newLog }
    })
  },

  takeMulligan: (playerId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state

      // Put hand back and shuffle
      const newLibrary = shuffleDeck([...state.sharedLibrary, ...player.hand])
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
          log(state, player.name, `took mulligan (hand size: ${newHandSize})`),
        ],
      }
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAY LAND (special action — doesn't use the stack)
  // ═══════════════════════════════════════════════════════════════════════════

  playLand: (playerId: string, cardInstanceId: string) => {
    set((state) => {
      const player = state.players[playerId]
      if (!player) return state
      if (player.landPlayedThisTurn) return state
      if (state.activePlayer !== playerId) return state
      if (state.phase !== 'main1' && state.phase !== 'main2') return state
      if (state.stack.length > 0) return state // can't play land while stack has items

      const cardIndex = player.hand.findIndex(c => c.id === cardInstanceId)
      if (cardIndex === -1) return state

      const card = player.hand[cardIndex]!
      const def = getCardDefinition(card.definitionId)
      if (def.type !== 'land') return state

      const newHand = [...player.hand]
      newHand.splice(cardIndex, 1)

      // Determine if it enters tapped
      let entersTapped = def.entersTapped ?? false

      // Mystic Sanctuary: enters untapped if you control 3+ other Islands
      if (def.id === 'mystic_sanctuary') {
        const islandCount = player.battlefield.filter(c => {
          const d = getCardDefinition(c.definitionId)
          return d.subtype?.includes('Island') || d.id === 'island'
        }).length
        entersTapped = islandCount < 3
      }

      const landInstance: CardInstance = {
        ...card,
        owner: playerId,
        controller: playerId,
        tapped: entersTapped,
      }

      let result: GameState = {
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
          log(state, player.name, `played ${def.name}${entersTapped ? ' (tapped)' : ''}`),
        ],
      }

      // Check Dandân sacrifice triggers after land state changes
      for (const pid of result.playerOrder) {
        result = checkDandanSacrifice(result, pid)
      }

      return result
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAST SPELL (goes on the stack)
  // ═══════════════════════════════════════════════════════════════════════════

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

      // Sorcery-speed check: must be active player, main phase, empty stack
      if (def.type === 'sorcery' || def.type === 'creature' || def.type === 'enchantment') {
        if (state.activePlayer !== playerId) return state
        if (state.phase !== 'main1' && state.phase !== 'main2') return state
        if (state.stack.length > 0) return state
      }

      // Instant-speed: can cast anytime you have priority
      // (already guaranteed by the caller checking priorityPlayer)

      const newHand = [...player.hand]
      newHand.splice(cardIndex, 1)

      const stackItem = {
        id: `stack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cardInstanceId: card.id,
        definitionId: card.definitionId,
        caster: playerId,
      }

      // After casting, the caster retains priority (MTG rule: caster gets priority
      // back after casting, then passes to opponent). We simplify: give opponent priority.
      const opp = opponentOf(state, playerId)

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
        priorityPlayer: opp,
        lastPasser: null, // reset — new spell means both need to pass again
        gameLog: [
          ...state.gameLog,
          log(state, player.name, `cast ${def.name}`),
        ],
      }
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAP LAND FOR MANA (mana ability — doesn't use the stack)
  // ═══════════════════════════════════════════════════════════════════════════

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

      // Haunted Fengraf produces colorless — we treat it as 1 blue for simplicity
      // since the format is mono-blue
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS PRIORITY — The core game flow engine
  // ═══════════════════════════════════════════════════════════════════════════

  passPriority: () => {
    set((state) => {
      if (state.gameOver) return state

      const current = state.priorityPlayer
      const opp = opponentOf(state, current)

      // ─── Case 1: Stack has items ──────────────────────────────────
      if (state.stack.length > 0) {
        // If the other player already passed (lastPasser === opp), both have
        // now passed in succession → resolve top of stack
        if (state.lastPasser === opp) {
          const resolved = resolveTopOfStack(state as GameState)

          // After resolution, active player gets priority
          return Object.assign({}, resolved, {
            lastPasser: null,
            priorityPlayer: resolved.activePlayer,
            extraTurns: state.extraTurns,
            extraTurnPlayer: state.extraTurnPlayer,
            declaredAttackerIds: state.declaredAttackerIds,
          })
        }

        // Otherwise, pass to opponent
        return {
          ...state,
          priorityPlayer: opp,
          lastPasser: current,
        }
      }

      // ─── Case 2: Stack is empty, both pass → advance phase ────────
      if (state.lastPasser === opp) {
        // Both passed with empty stack — move to next phase
        return advanceToNextPhase(state)
      }

      // First pass with empty stack — give opponent a chance
      return {
        ...state,
        priorityPlayer: opp,
        lastPasser: current,
      }
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DECLARE ATTACKERS
  // ═══════════════════════════════════════════════════════════════════════════

  declareAttackers: (playerId: string, attackerIds: string[]) => {
    set((state) => {
      if (state.phase !== 'declare_attackers') return state
      if (state.activePlayer !== playerId) return state

      const player = state.players[playerId]!
      const opp = opponentOf(state, playerId)

      // Validate: Dandân can't attack unless defender controls an Island
      if (attackerIds.length > 0) {
        const defenderHasIsland = state.players[opp]!.battlefield.some(c => {
          const def = getCardDefinition(c.definitionId)
          return def.subtype?.includes('Island') || def.id === 'island'
        })
        if (!defenderHasIsland) {
          attackerIds = []
        }
      }

      // Validate: no summoning-sick creatures
      const validAttackerIds = attackerIds.filter(id => {
        const card = player.battlefield.find(c => c.id === id)
        if (!card) return false
        const def = getCardDefinition(card.definitionId)
        return def.id === 'dandan' && !card.tapped && !card.summoningSick
      })

      // Tap attackers
      const newBattlefield = player.battlefield.map(c => {
        if (validAttackerIds.includes(c.id)) {
          return { ...c, tapped: true }
        }
        return c
      })

      const newLog = validAttackerIds.length > 0
        ? [...state.gameLog, log(state, player.name, `attacked with ${validAttackerIds.length} Dandân`)]
        : state.gameLog

      // If no attackers, skip blockers and damage steps
      if (validAttackerIds.length === 0) {
        const poolsEmptied = emptyManaPools(state)
        return Object.assign({}, poolsEmptied, {
          phase: 'main2' as GamePhase,
          priorityPlayer: state.activePlayer,
          lastPasser: null,
          declaredAttackerIds: [] as string[],
          extraTurns: state.extraTurns,
          extraTurnPlayer: state.extraTurnPlayer,
          players: {
            ...poolsEmptied.players,
            [playerId]: { ...poolsEmptied.players[playerId]!, battlefield: newBattlefield },
          },
          gameLog: newLog,
        })
      }

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            battlefield: newBattlefield,
            attackedThisTurn: true,
          },
        },
        declaredAttackerIds: validAttackerIds,
        gameLog: newLog,
      }
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONCEDE
  // ═══════════════════════════════════════════════════════════════════════════

  concede: (playerId: string) => {
    set((state) => {
      const player = state.players[playerId]
      const opp = opponentOf(state, playerId)
      return {
        ...state,
        gameOver: true,
        winner: opp,
        winReason: `${player?.name ?? playerId} conceded`,
      }
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CPU ACTION RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  runCpuAction: () => {
    const state = get()
    if (state.gameOver) return
    if (state.priorityPlayer !== 'player2' && !(state.waitingForMulligan && !state.players['player2']!.hasKeptHand)) return

    const action = decideCpuAction(state)

    switch (action.type) {
      case 'keep_hand':
        get().keepHand('player2')
        break
      case 'mulligan':
        get().takeMulligan('player2')
        break
      case 'play_land':
        if (action.cardId) get().playLand('player2', action.cardId)
        break
      case 'cast_spell':
        if (action.cardId) get().castSpell('player2', action.cardId)
        break
      case 'tap_land':
        if (action.cardId) get().tapLandForMana('player2', action.cardId)
        break
      case 'attack':
        get().declareAttackers('player2', action.attackerIds ?? [])
        break
      case 'pass':
        get().passPriority()
        break
    }
  },
}))

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE ADVANCEMENT — Pure function
// ═══════════════════════════════════════════════════════════════════════════════

function advanceToNextPhase(state: GameState & { extraTurns: number; extraTurnPlayer: string | null; declaredAttackerIds: string[] }): GameState & { extraTurns: number; extraTurnPlayer: string | null; lastPasser: string | null; declaredAttackerIds: string[] } {
  const current = state.phase
  let next = nextPhase(current)
  let result: GameState & { extraTurns: number; extraTurnPlayer: string | null; lastPasser: string | null; declaredAttackerIds: string[] } = {
    ...state,
    lastPasser: null,
  }

  // Empty mana pools between steps/phases
  result = { ...emptyManaPools(result), extraTurns: result.extraTurns, extraTurnPlayer: result.extraTurnPlayer, lastPasser: null, declaredAttackerIds: result.declaredAttackerIds }

  // ─── Combat Damage Resolution ─────────────────────────────────────
  if (current === 'declare_attackers' && result.declaredAttackerIds.length > 0) {
    // Skip blockers (no blocking in DanDân — only creature is Dandân and
    // there's no blocking mechanic used in practice)
    next = 'combat_damage'
  }

  if (next === 'combat_damage') {
    // Resolve combat damage
    const attacker = result.activePlayer
    const defender = opponentOf(result, attacker)
    const attackerState = result.players[attacker]!
    const defenderState = result.players[defender]!

    const attackingCount = result.declaredAttackerIds.length
    if (attackingCount > 0) {
      const totalDamage = attackingCount * 4
      const newLife = defenderState.life - totalDamage
      const newHits = defenderState.dandanHits + attackingCount

      result = {
        ...result,
        players: {
          ...result.players,
          [defender]: {
            ...defenderState,
            life: newLife,
            dandanHits: newHits,
          },
        },
        gameLog: [
          ...result.gameLog,
          {
            turn: result.turnNumber,
            phase: 'combat_damage',
            player: attackerState.name,
            action: `dealt ${totalDamage} combat damage (${attackingCount} Dandân)`,
            timestamp: Date.now(),
          },
        ],
        declaredAttackerIds: [],
      }

      if (newLife <= 0) {
        return {
          ...result,
          phase: 'combat_damage' as GamePhase,
          gameOver: true,
          winner: attacker,
          winReason: `${defenderState.name}'s life reached ${newLife}`,
        }
      }
    }

    // Skip to combat_end then main2
    next = 'main2'
  }

  // ─── Cleanup → New Turn ───────────────────────────────────────────
  if (next === 'untap') {
    // Determine next active player
    let nextActivePlayer: string

    if (result.extraTurns > 0 && result.extraTurnPlayer) {
      // Extra turn for the player who cast Capture of Jingzhou
      nextActivePlayer = result.extraTurnPlayer
      result = {
        ...result,
        extraTurns: result.extraTurns - 1,
        extraTurnPlayer: result.extraTurns - 1 > 0 ? result.extraTurnPlayer : null,
      }
    } else {
      nextActivePlayer = opponentOf(result, result.activePlayer)
    }

    const nextTurn = result.turnNumber + 1

    // Untap all permanents for the new active player
    const activePlayerState = result.players[nextActivePlayer]!
    const untappedBattlefield = activePlayerState.battlefield.map(c => ({
      ...c,
      tapped: false,
      summoningSick: false, // creatures lose summoning sickness at start of controller's turn
    }))

    result = {
      ...result,
      activePlayer: nextActivePlayer,
      turnNumber: nextTurn,
      players: {
        ...result.players,
        [nextActivePlayer]: {
          ...activePlayerState,
          battlefield: untappedBattlefield,
          landPlayedThisTurn: false,
          attackedThisTurn: false,
          manaPool: 0,
        },
      },
      gameLog: [
        ...result.gameLog,
        {
          turn: nextTurn,
          phase: 'untap',
          player: activePlayerState.name,
          action: `Turn ${nextTurn} begins`,
          timestamp: Date.now(),
        },
      ],
    }

    // Check Dandân sacrifice after untap
    for (const pid of result.playerOrder) {
      result = { ...checkDandanSacrifice(result, pid), extraTurns: result.extraTurns, extraTurnPlayer: result.extraTurnPlayer, lastPasser: null, declaredAttackerIds: result.declaredAttackerIds }
    }

    // Skip untap (no priority) and upkeep, go straight to draw
    next = 'draw'
  }

  // ─── Draw Step ────────────────────────────────────────────────────
  if (next === 'draw') {
    // Active player draws a card (turn-based action, doesn't use stack)
    const drawResult = engineDrawCards(result, result.activePlayer, 1)
    result = { ...drawResult, extraTurns: result.extraTurns, extraTurnPlayer: result.extraTurnPlayer, lastPasser: null, declaredAttackerIds: result.declaredAttackerIds }

    if (result.gameOver) {
      return { ...result, phase: 'draw' as GamePhase }
    }

    result = {
      ...result,
      gameLog: [
        ...result.gameLog,
        {
          turn: result.turnNumber,
          phase: 'draw',
          player: result.players[result.activePlayer]!.name,
          action: 'drew a card',
          timestamp: Date.now(),
        },
      ],
    }

    // After draw, go to main1 (players get priority in main phase)
    next = 'main1'
  }

  // ─── Set the new phase and give active player priority ────────────
  result = {
    ...result,
    phase: next,
    priorityPlayer: result.activePlayer,
    lastPasser: null,
  }

  return result
}
