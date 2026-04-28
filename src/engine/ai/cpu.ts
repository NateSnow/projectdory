/**
 * CPU AI for DanDân
 *
 * The store's castSpell action handles auto-tapping lands, so the CPU
 * just needs to decide WHAT to cast — it doesn't need to manually tap.
 * We check total available mana (manaPool + untapped lands) for affordability.
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

/** Total mana the CPU can spend (floating + untapped lands) */
function cpuTotalMana(state: GameState): number {
  const cpu = state.players[CPU_ID]!
  return cpu.manaPool + countAvailableMana(state, CPU_ID)
}

/**
 * Decide what the CPU should do given the current game state.
 */
export function decideCpuAction(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!
  const phase = state.phase

  // ─── Mulligan ─────────────────────────────────────────────────────
  if (state.waitingForMulligan && !cpu.hasKeptHand) {
    return decideMulligan(state)
  }

  // ─── Responding to opponent's spell ───────────────────────────────
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

  const lands = hand.filter(c => getCardDefinition(c.definitionId).type === 'land')
  const spells = hand.filter(c => getCardDefinition(c.definitionId).type !== 'land')

  // Free mulligan if <2 lands or <2 spells
  if (cpu.mulligansTaken === 0 && (lands.length < 2 || spells.length < 2)) {
    return { type: 'mulligan' }
  }

  if (lands.length >= 2 && lands.length <= 5 && spells.length >= 2) {
    return { type: 'keep_hand' }
  }

  if (cpu.mulligansTaken >= 1) {
    return { type: 'keep_hand' }
  }

  return { type: 'mulligan' }
}

// ─── Response to Opponent's Spell ───────────────────────────────────────────

function decideResponse(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!
  const mana = cpuTotalMana(state)

  const topSpell = state.stack[state.stack.length - 1]
  if (!topSpell || topSpell.caster === CPU_ID) return { type: 'pass' }

  // Counter dangerous spells with Memory Lapse
  const memoryLapse = findInHand(cpu, 'memory_lapse')
  if (memoryLapse && mana >= 2) {
    const dangerousSpells = ['dandan', 'control_magic', 'capture_of_jingzhou', 'days_undoing']
    if (dangerousSpells.includes(topSpell.definitionId)) {
      return { type: 'cast_spell', cardId: memoryLapse.id }
    }
    const removalSpells = ['crystal_spray', 'unsubstantiate', 'magical_hack', 'metamorphose']
    if (removalSpells.includes(topSpell.definitionId) && hasDandanOnBoard(state, CPU_ID)) {
      return { type: 'cast_spell', cardId: memoryLapse.id }
    }
  }

  // Bounce their expensive spell with Unsubstantiate
  const unsub = findInHand(cpu, 'unsubstantiate')
  const topDef = getCardDefinition(topSpell.definitionId)
  if (unsub && mana >= 2 && topDef.cmc >= 3) {
    return { type: 'cast_spell', cardId: unsub.id }
  }

  return { type: 'pass' }
}

// ─── Main Phase Decision ────────────────────────────────────────────────────

function decideMainPhase(state: GameState, phase: GamePhase): CpuAction {
  const cpu = state.players[CPU_ID]!
  const mana = cpuTotalMana(state)

  // Step 1: Play a land if we haven't yet
  if (!cpu.landPlayedThisTurn) {
    const land = chooseLandToPlay(cpu)
    if (land) return { type: 'play_land', cardId: land.id }
  }

  // Recalculate mana after potential land play (the land play happens
  // in a separate action, so on the NEXT call mana will be updated)
  const humanMana = countAvailableMana(state, HUMAN_ID)

  // Priority A: Play Dandân if opponent is tapped out or low on mana
  if (phase === 'main1') {
    const dandan = findInHand(cpu, 'dandan')
    if (dandan && mana >= 2) {
      if (humanMana < 2 || !opponentLikelyHasCounter(state)) {
        return { type: 'cast_spell', cardId: dandan.id }
      }
      if (findInHand(cpu, 'memory_lapse') && mana >= 4) {
        return { type: 'cast_spell', cardId: dandan.id }
      }
    }
  }

  // Priority B: Remove opponent's Dandân
  if (hasDandanOnBoard(state, HUMAN_ID)) {
    const controlMagic = findInHand(cpu, 'control_magic')
    if (controlMagic && mana >= 4) return { type: 'cast_spell', cardId: controlMagic.id }

    const crystalSpray = findInHand(cpu, 'crystal_spray')
    if (crystalSpray && mana >= 3) return { type: 'cast_spell', cardId: crystalSpray.id }

    const unsub = findInHand(cpu, 'unsubstantiate')
    if (unsub && mana >= 2) return { type: 'cast_spell', cardId: unsub.id }

    const magicalHack = findInHand(cpu, 'magical_hack')
    if (magicalHack && mana >= 1) return { type: 'cast_spell', cardId: magicalHack.id }

    const metamorphose = findInHand(cpu, 'metamorphose')
    if (metamorphose && mana >= 2) return { type: 'cast_spell', cardId: metamorphose.id }
  }

  // Priority C: Sorcery-speed draw spells
  if (phase === 'main2' || !hasDandanInHand(cpu)) {
    const chart = findInHand(cpu, 'chart_a_course')
    if (chart && mana >= 2) return { type: 'cast_spell', cardId: chart.id }

    const daysUndoing = findInHand(cpu, 'days_undoing')
    if (daysUndoing && mana >= 3 && cpu.hand.length <= 3) return { type: 'cast_spell', cardId: daysUndoing.id }

    const capture = findInHand(cpu, 'capture_of_jingzhou')
    if (capture && mana >= 5 && hasDandanOnBoard(state, CPU_ID)) return { type: 'cast_spell', cardId: capture.id }
  }

  // Priority D: Instant-speed draw spells (can cast during main phase too)
  const instantDraw = decideInstantDraw(state)
  if (instantDraw) return instantDraw

  return { type: 'pass' }
}

// ─── Attack Decision ────────────────────────────────────────────────────────

function decideAttack(state: GameState): CpuAction {
  const cpu = state.players[CPU_ID]!

  if (!playerControlsIsland(state, HUMAN_ID)) {
    return { type: 'attack', attackerIds: [] }
  }

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
  const mana = cpuTotalMana(state)

  const brainstorm = findInHand(cpu, 'brainstorm')
  if (brainstorm && mana >= 1) return { type: 'cast_spell', cardId: brainstorm.id }

  const ak = findInHand(cpu, 'accumulated_knowledge')
  if (ak && mana >= 2) return { type: 'cast_spell', cardId: ak.id }

  const tellingTime = findInHand(cpu, 'telling_time')
  if (tellingTime && mana >= 2) return { type: 'cast_spell', cardId: tellingTime.id }

  const mentalNote = findInHand(cpu, 'mental_note')
  if (mentalNote && mana >= 1) return { type: 'cast_spell', cardId: mentalNote.id }

  const predict = findInHand(cpu, 'predict')
  if (predict && mana >= 2) return { type: 'cast_spell', cardId: predict.id }

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
  const humanMana = countAvailableMana(state, HUMAN_ID)
  return humanMana >= 2 && human.hand.length >= 2
}

function chooseLandToPlay(player: { hand: CardInstance[] }): CardInstance | undefined {
  const lands = player.hand.filter(c => getCardDefinition(c.definitionId).type === 'land')
  if (lands.length === 0) return undefined

  const untappedLand = lands.find(c => !getCardDefinition(c.definitionId).entersTapped)
  if (untappedLand) return untappedLand

  return lands[0]
}
