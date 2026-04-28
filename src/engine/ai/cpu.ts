/**
 * CPU AI for DanDân
 *
 * The AI follows a priority-based decision system tuned for the DanDân format:
 *
 * 1. Counter opponent's key spells (Memory Lapse)
 * 2. Remove opponent's Dandân (Crystal Spray, Unsubstantiate, Magical Hack)
 * 3. Play Dandân when safe (opponent tapped out or no counters likely)
 * 4. Steal with Control Magic when possible
 * 5. Draw spells for card advantage
 * 6. Play lands and manage mana
 *
 * The AI uses heuristics rather than look-ahead to keep things responsive.
 */

import type { GameState, GamePhase } from '../gameState'
import type { CardInstance } from '../cards/types'
import { getCardDefinition } from '../cards'
import { countAvailableMana, playerControlsIsland } from '../spellResolver'

const CPU_ID = 'player2'
const HUMAN_ID = 'player1'

export interface CpuAction {
  type: 'play_land' | 'cast_spell' | 'tap_land' | 'attack' | 'pass' | 'keep_hand' | 'mulligan'
  cardId?: string
  attackerIds?: string[]
}

/**
 * Decide what the CPU should do given the current game state.
 * Returns an action the game loop should execute.
 */
export function decideCpuAction(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!
  const phase = state.phase

  // ─── Mulligan ─────────────────────────────────────────────────────
  if (state.waitingForMulligan && !cpu.hasKeptHand) {
    return decideMulligan(state)
  }

  // ─── Responding to opponent's spell (CPU has priority, stack not empty) ──
  if (state.priorityPlayer === CPU_ID && state.stack.length > 0) {
    return decideResponse(state)
  }

  // ─── CPU's turn actions ───────────────────────────────────────────
  if (state.activePlayer === CPU_ID && state.priorityPlayer === CPU_ID) {
    switch (phase) {
      case 'main1':
      case 'main2':
        return decideMainPhase(state, phase)
      case 'declare_attackers':
        return decideAttack(state)
      default:
        return { type: 'pass' }
    }
  }

  // ─── CPU has priority on opponent's turn (can cast instants) ──────
  if (state.priorityPlayer === CPU_ID && state.activePlayer === HUMAN_ID) {
    return decideInstantSpeed(state)
  }

  return { type: 'pass' }
}

// ─── Mulligan Decision ──────────────────────────────────────────────────────

function decideMulligan(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!
  const hand = cpu.hand

  // Count lands and spells
  const lands = hand.filter(c => getCardDefinition(c.definitionId).type === 'land')
  const spells = hand.filter(c => getCardDefinition(c.definitionId).type !== 'land')

  // DanDân mulligan rule: free mulligan if <2 lands or <2 spells
  if (cpu.mulligansTaken === 0 && (lands.length < 2 || spells.length < 2)) {
    return { type: 'mulligan' }
  }

  // Keep if we have 2-5 lands and at least 2 spells
  if (lands.length >= 2 && lands.length <= 5 && spells.length >= 2) {
    return { type: 'keep_hand' }
  }

  // After first mulligan, be less picky
  if (cpu.mulligansTaken >= 1) {
    return { type: 'keep_hand' }
  }

  return { type: 'mulligan' }
}

// ─── Response to Opponent's Spell ───────────────────────────────────────────

function decideResponse(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!

  // First, tap lands to get mana if needed
  const manaAction = autoTapForMana(state, CPU_ID)
  if (manaAction) return manaAction

  const topSpell = state.stack[state.stack.length - 1]
  if (!topSpell || topSpell.caster === CPU_ID) return { type: 'pass' }

  const topDef = getCardDefinition(topSpell.definitionId)

  // Priority 1: Counter dangerous spells with Memory Lapse
  const memoryLapse = findInHand(cpu, 'memory_lapse')
  if (memoryLapse && cpu.manaPool >= 2) {
    // Counter these high-priority spells
    const dangerousSpells = ['dandan', 'control_magic', 'capture_of_jingzhou', 'days_undoing']
    if (dangerousSpells.includes(topSpell.definitionId)) {
      return { type: 'cast_spell', cardId: memoryLapse.id }
    }
    // Also counter removal targeting our Dandân
    const removalSpells = ['crystal_spray', 'unsubstantiate', 'magical_hack', 'metamorphose']
    if (removalSpells.includes(topSpell.definitionId) && hasDandanOnBoard(state, CPU_ID)) {
      return { type: 'cast_spell', cardId: memoryLapse.id }
    }
  }

  // Priority 2: Bounce their spell with Unsubstantiate
  const unsub = findInHand(cpu, 'unsubstantiate')
  if (unsub && cpu.manaPool >= 2 && topDef.cmc >= 3) {
    return { type: 'cast_spell', cardId: unsub.id }
  }

  return { type: 'pass' }
}

// ─── Main Phase Decision ────────────────────────────────────────────────────

function decideMainPhase(state: GameState, phase: GamePhase): CpuAction {
  const cpu = state.players[CPU_ID]!

  // Step 1: Play a land if we haven't yet
  if (!cpu.landPlayedThisTurn) {
    const land = chooseLandToPlay(cpu)
    if (land) return { type: 'play_land', cardId: land.id }
  }

  // Step 2: Tap lands for mana
  const manaAction = autoTapForMana(state, CPU_ID)
  if (manaAction) return manaAction

  // Step 3: Evaluate what to cast
  const humanMana = countAvailableMana(state, HUMAN_ID)
  const cpuMana = cpu.manaPool

  // Priority A: Play Dandân if opponent is tapped out or low on mana
  if (phase === 'main1') {
    const dandan = findInHand(cpu, 'dandan')
    if (dandan && cpuMana >= 2) {
      // Safe to play if opponent can't counter (tapped out or <2 mana)
      if (humanMana < 2 || !opponentLikelyHasCounter(state)) {
        return { type: 'cast_spell', cardId: dandan.id }
      }
      // If we have backup counter, play it anyway
      if (findInHand(cpu, 'memory_lapse') && cpuMana >= 4) {
        return { type: 'cast_spell', cardId: dandan.id }
      }
    }
  }

  // Priority B: Remove opponent's Dandân
  if (hasDandanOnBoard(state, HUMAN_ID)) {
    // Control Magic (steal it!)
    const controlMagic = findInHand(cpu, 'control_magic')
    if (controlMagic && cpuMana >= 4) {
      return { type: 'cast_spell', cardId: controlMagic.id }
    }

    // Crystal Spray (destroy + draw)
    const crystalSpray = findInHand(cpu, 'crystal_spray')
    if (crystalSpray && cpuMana >= 3) {
      return { type: 'cast_spell', cardId: crystalSpray.id }
    }

    // Unsubstantiate (bounce)
    const unsub = findInHand(cpu, 'unsubstantiate')
    if (unsub && cpuMana >= 2) {
      return { type: 'cast_spell', cardId: unsub.id }
    }

    // Magical Hack (destroy)
    const magicalHack = findInHand(cpu, 'magical_hack')
    if (magicalHack && cpuMana >= 1) {
      return { type: 'cast_spell', cardId: magicalHack.id }
    }

    // Metamorphose (bounce to top of library, they draw 2)
    const metamorphose = findInHand(cpu, 'metamorphose')
    if (metamorphose && cpuMana >= 2) {
      return { type: 'cast_spell', cardId: metamorphose.id }
    }
  }

  // Priority C: Draw spells (main phase sorceries)
  if (phase === 'main2' || !hasDandanInHand(cpu)) {
    // Chart a Course
    const chart = findInHand(cpu, 'chart_a_course')
    if (chart && cpuMana >= 2) {
      return { type: 'cast_spell', cardId: chart.id }
    }

    // Day's Undoing (if hand is small)
    const daysUndoing = findInHand(cpu, 'days_undoing')
    if (daysUndoing && cpuMana >= 3 && cpu.hand.length <= 3) {
      return { type: 'cast_spell', cardId: daysUndoing.id }
    }

    // Capture of Jingzhou (extra turn!)
    const capture = findInHand(cpu, 'capture_of_jingzhou')
    if (capture && cpuMana >= 5 && hasDandanOnBoard(state, CPU_ID)) {
      return { type: 'cast_spell', cardId: capture.id }
    }
  }

  // Priority D: Instant-speed draw spells during main phase
  const instantDraw = decideInstantDraw(state)
  if (instantDraw) return instantDraw

  return { type: 'pass' }
}

// ─── Attack Decision ────────────────────────────────────────────────────────

function decideAttack(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!

  // Check if opponent controls an Island (Dandân can't attack otherwise)
  if (!playerControlsIsland(state, HUMAN_ID)) {
    return { type: 'attack', attackerIds: [] }
  }

  // Attack with all eligible Dandân
  const attackers = cpu.battlefield
    .filter(c => {
      const def = getCardDefinition(c.definitionId)
      return def.id === 'dandan' && !c.tapped && !c.summoningSick
    })
    .map(c => c.id)

  return { type: 'attack', attackerIds: attackers }
}

// ─── Instant-Speed Actions (Opponent's Turn) ────────────────────────────────

function decideInstantSpeed(state: GameState): CpuAction {

  // Tap lands for mana if we want to cast something
  const manaAction = autoTapForMana(state, CPU_ID)
  if (manaAction) return manaAction

  // End step is a good time to cast draw spells
  if (state.phase === 'end_step' || state.phase === 'combat_end') {
    const draw = decideInstantDraw(state)
    if (draw) return draw
  }

  return { type: 'pass' }
}

// ─── Instant Draw Spell Decision ────────────────────────────────────────────

function decideInstantDraw(state: GameState): CpuAction | null {
  const cpu = state.players[CPU_ID]!
  const cpuMana = cpu.manaPool

  // Brainstorm
  const brainstorm = findInHand(cpu, 'brainstorm')
  if (brainstorm && cpuMana >= 1) {
    return { type: 'cast_spell', cardId: brainstorm.id }
  }

  // Accumulated Knowledge
  const ak = findInHand(cpu, 'accumulated_knowledge')
  if (ak && cpuMana >= 2) {
    return { type: 'cast_spell', cardId: ak.id }
  }

  // Telling Time
  const tellingTime = findInHand(cpu, 'telling_time')
  if (tellingTime && cpuMana >= 2) {
    return { type: 'cast_spell', cardId: tellingTime.id }
  }

  // Mental Note
  const mentalNote = findInHand(cpu, 'mental_note')
  if (mentalNote && cpuMana >= 1) {
    return { type: 'cast_spell', cardId: mentalNote.id }
  }

  // Predict
  const predict = findInHand(cpu, 'predict')
  if (predict && cpuMana >= 2) {
    return { type: 'cast_spell', cardId: predict.id }
  }

  return null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findInHand(player: { hand: CardInstance[] }, definitionId: string): CardInstance | undefined {
  return player.hand.find(c => c.definitionId === definitionId)
}

function hasDandanOnBoard(state: GameState, playerId: string): boolean {
  return state.players[playerId]!.battlefield.some(c =>
    getCardDefinition(c.definitionId).id === 'dandan'
  )
}

function hasDandanInHand(player: { hand: CardInstance[] }): boolean {
  return player.hand.some(c => c.definitionId === 'dandan')
}

function opponentLikelyHasCounter(state: GameState): boolean {
  const human = state.players[HUMAN_ID]!
  // If opponent has 2+ mana available and 2+ cards in hand, assume they might have Memory Lapse
  const humanMana = countAvailableMana(state, HUMAN_ID)
  return humanMana >= 2 && human.hand.length >= 2
}

/**
 * Choose the best land to play from hand.
 * Prefer basic Islands first (they come in untapped), then utility lands.
 */
function chooseLandToPlay(player: { hand: CardInstance[] }): CardInstance | undefined {
  const lands = player.hand.filter(c => getCardDefinition(c.definitionId).type === 'land')
  if (lands.length === 0) return undefined

  // Prefer untapped lands (basic Island)
  const untappedLand = lands.find(c => {
    const def = getCardDefinition(c.definitionId)
    return !def.entersTapped
  })
  if (untappedLand) return untappedLand

  // Otherwise play any land
  return lands[0]
}

/**
 * Auto-tap untapped lands for mana. Returns a tap action if there are
 * untapped lands and the CPU has spells it wants to cast.
 */
function autoTapForMana(state: GameState, playerId: string): CpuAction | null {
  const player = state.players[playerId]!

  // Find untapped lands that produce blue mana
  const untappedLands = player.battlefield.filter(c => {
    const def = getCardDefinition(c.definitionId)
    return def.type === 'land' && !c.tapped && def.id !== 'haunted_fengraf'
  })

  if (untappedLands.length === 0) return null

  // Check if we have spells we want to cast that need more mana
  const spellsInHand = player.hand.filter(c => getCardDefinition(c.definitionId).type !== 'land')
  const cheapestSpell = spellsInHand.reduce((min, c) => {
    const cmc = getCardDefinition(c.definitionId).cmc
    return cmc < min ? cmc : min
  }, Infinity)

  // Tap lands if we need mana for something
  if (player.manaPool < cheapestSpell && cheapestSpell !== Infinity) {
    return { type: 'tap_land', cardId: untappedLands[0]!.id }
  }

  // Also tap if we're responding to a spell and need mana
  if (state.stack.length > 0 && player.manaPool < 2) {
    return { type: 'tap_land', cardId: untappedLands[0]!.id }
  }

  return null
}
