/**
 * Spell Resolution Engine
 *
 * Each card's effect is implemented as a pure function that takes the current
 * game state and returns a new game state. This keeps resolution deterministic
 * and testable.
 *
 * DanDân-specific rules:
 * - "Your library/graveyard" always refers to the SHARED library/graveyard
 * - "Owner" of a card on the stack/battlefield = whoever cast it
 * - Simultaneous draws are dealt one at a time, active player first
 */

import type { GameState, PlayerState } from './gameState'
import type { CardInstance, StackItem } from './cards/types'
import { getCardDefinition, shuffleDeck } from './cards'

// ─── Helpers ────────────────────────────────────────────────────────────────

function opponent(state: GameState, playerId: string): string {
  return state.playerOrder.find(p => p !== playerId)!
}

function getPlayer(state: GameState, playerId: string): PlayerState {
  return state.players[playerId]!
}

function updatePlayer(state: GameState, playerId: string, updates: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...state.players[playerId]!, ...updates },
    },
  }
}

function addLogEntry(state: GameState, player: string, action: string): GameState {
  return {
    ...state,
    gameLog: [
      ...state.gameLog,
      {
        turn: state.turnNumber,
        phase: state.phase,
        player,
        action,
        timestamp: Date.now(),
      },
    ],
  }
}

/**
 * Draw cards from the shared library for a player.
 * Returns updated state. Sets gameOver if library is empty.
 */
export function drawCards(state: GameState, playerId: string, count: number): GameState {
  const player = getPlayer(state, playerId)
  const newLibrary = [...state.sharedLibrary]
  const newHand = [...player.hand]

  for (let i = 0; i < count; i++) {
    if (newLibrary.length === 0) {
      return {
        ...state,
        gameOver: true,
        winner: opponent(state, playerId),
        winReason: `${player.name} tried to draw from an empty library`,
      }
    }
    newHand.push(newLibrary.shift()!)
  }

  let result: GameState = {
    ...state,
    sharedLibrary: newLibrary,
  }
  result = updatePlayer(result, playerId, { hand: newHand })
  return result
}

/**
 * Mill cards from the shared library into the shared graveyard.
 */
function millCards(state: GameState, count: number): { state: GameState; milled: CardInstance[] } {
  const newLibrary = [...state.sharedLibrary]
  const newGraveyard = [...state.sharedGraveyard]
  const milled: CardInstance[] = []

  for (let i = 0; i < count; i++) {
    if (newLibrary.length === 0) break
    const card = newLibrary.shift()!
    milled.push(card)
    newGraveyard.push(card)
  }

  return {
    state: { ...state, sharedLibrary: newLibrary, sharedGraveyard: newGraveyard },
    milled,
  }
}

/**
 * Put a card instance into the shared graveyard.
 */
function toGraveyard(state: GameState, card: CardInstance): GameState {
  return {
    ...state,
    sharedGraveyard: [...state.sharedGraveyard, card],
  }
}

/**
 * Put a card on top of the shared library.
 */
function putOnTopOfLibrary(state: GameState, card: CardInstance): GameState {
  return {
    ...state,
    sharedLibrary: [card, ...state.sharedLibrary],
  }
}

/**
 * Remove a permanent from a player's battlefield by card instance ID.
 */
function removeFromBattlefield(state: GameState, playerId: string, cardId: string): { state: GameState; card: CardInstance | null } {
  const player = getPlayer(state, playerId)
  const idx = player.battlefield.findIndex(c => c.id === cardId)
  if (idx === -1) return { state, card: null }

  const card = player.battlefield[idx]!
  const newBattlefield = [...player.battlefield]
  newBattlefield.splice(idx, 1)

  return {
    state: updatePlayer(state, playerId, { battlefield: newBattlefield }),
    card,
  }
}

/**
 * Check if a player controls any Islands (including lands with Island subtype).
 */
export function playerControlsIsland(state: GameState, playerId: string): boolean {
  const player = getPlayer(state, playerId)
  return player.battlefield.some(c => {
    const def = getCardDefinition(c.definitionId)
    return def.type === 'land' && (def.subtype?.includes('Island') || def.id === 'island')
  })
}

/**
 * Count untapped lands that can produce blue mana for a player.
 */
export function countAvailableMana(state: GameState, playerId: string): number {
  const player = getPlayer(state, playerId)
  return player.battlefield.filter(c => {
    const def = getCardDefinition(c.definitionId)
    // Haunted Fengraf only produces colorless, not blue
    return def.type === 'land' && !c.tapped && def.id !== 'haunted_fengraf'
  }).length
}

/**
 * Check the Dandân sacrifice trigger: if a player controls no Islands,
 * sacrifice all their Dandân.
 */
export function checkDandanSacrifice(state: GameState, playerId: string): GameState {
  if (playerControlsIsland(state, playerId)) return state

  const player = getPlayer(state, playerId)
  const dandans = player.battlefield.filter(c => getCardDefinition(c.definitionId).id === 'dandan')

  if (dandans.length === 0) return state

  let result = state
  for (const dandan of dandans) {
    const removal = removeFromBattlefield(result, playerId, dandan.id)
    result = removal.state
    if (removal.card) {
      result = toGraveyard(result, removal.card)
    }
  }

  result = addLogEntry(result, player.name, `sacrificed ${dandans.length} Dandân (no Islands)`)
  return result
}

// ─── Spell Resolution ───────────────────────────────────────────────────────

/**
 * Resolve the top item on the stack.
 * Returns the updated game state after the spell's effect is applied.
 */
export function resolveTopOfStack(state: GameState): GameState {
  if (state.stack.length === 0) return state

  const newStack = [...state.stack]
  const item = newStack.pop()!
  let result: GameState = { ...state, stack: newStack }

  const def = getCardDefinition(item.definitionId)
  const caster = item.caster
  const casterName = getPlayer(result, caster).name

  result = addLogEntry(result, casterName, `${def.name} resolves`)

  // Create a card instance for the resolved spell (for graveyard)
  const resolvedCard: CardInstance = {
    id: item.cardInstanceId,
    definitionId: item.definitionId,
    owner: caster,
  }

  switch (item.definitionId) {
    case 'dandan':
      result = resolveDandan(result, caster, resolvedCard)
      break

    case 'memory_lapse':
      result = resolveMemoryLapse(result, item)
      break

    case 'brainstorm':
      result = resolveBrainstorm(result, caster, resolvedCard)
      break

    case 'accumulated_knowledge':
      result = resolveAccumulatedKnowledge(result, caster, resolvedCard)
      break

    case 'telling_time':
      result = resolveTellingTime(result, caster, resolvedCard)
      break

    case 'crystal_spray':
      result = resolveCrystalSpray(result, caster, item, resolvedCard)
      break

    case 'unsubstantiate':
      result = resolveUnsubstantiate(result, item, resolvedCard)
      break

    case 'predict':
      result = resolvePredict(result, caster, item, resolvedCard)
      break

    case 'chart_a_course':
      result = resolveChartACourse(result, caster, resolvedCard)
      break

    case 'capture_of_jingzhou':
      result = resolveCaptureOfJingzhou(result, caster, resolvedCard)
      break

    case 'days_undoing':
      result = resolveDaysUndoing(result, caster, resolvedCard)
      break

    case 'mental_note':
      result = resolveMentalNote(result, caster, resolvedCard)
      break

    case 'metamorphose':
      result = resolveMetamorphose(result, item, resolvedCard)
      break

    case 'magical_hack':
      result = resolveMagicalHack(result, caster, item, resolvedCard)
      break

    case 'control_magic':
      result = resolveControlMagic(result, caster, item, resolvedCard)
      break

    default:
      // Unknown spell — just put it in the graveyard
      result = toGraveyard(result, resolvedCard)
      break
  }

  // After any spell resolves, check Dandân sacrifice triggers for both players
  for (const pid of result.playerOrder) {
    result = checkDandanSacrifice(result, pid)
  }

  return result
}

// ─── Individual Card Resolutions ────────────────────────────────────────────

function resolveDandan(state: GameState, caster: string, card: CardInstance): GameState {
  const player = getPlayer(state, caster)
  const creatureInstance: CardInstance = {
    ...card,
    owner: caster,
    controller: caster,
    tapped: false,
    summoningSick: true,
  }
  return updatePlayer(state, caster, {
    battlefield: [...player.battlefield, creatureInstance],
  })
}

/**
 * Memory Lapse: Counter target spell. Put it on top of the shared library
 * instead of into the graveyard.
 */
function resolveMemoryLapse(state: GameState, item: StackItem): GameState {
  const resolvedCard: CardInstance = {
    id: item.cardInstanceId,
    definitionId: item.definitionId,
    owner: item.caster,
  }

  // The target is the next item on the stack (the spell being countered)
  if (state.stack.length === 0) {
    // No target — fizzles, Memory Lapse goes to graveyard
    return toGraveyard(state, resolvedCard)
  }

  // In our simplified model, Memory Lapse targets the top remaining spell on the stack
  // (which was below it before it was popped)
  const targetIdx = state.stack.length - 1
  const targetItem = state.stack[targetIdx]!
  const targetDef = getCardDefinition(targetItem.definitionId)

  const newStack = [...state.stack]
  newStack.splice(targetIdx, 1)

  let result: GameState = { ...state, stack: newStack }

  // Put the countered spell on top of the shared library
  const counteredCard: CardInstance = {
    id: targetItem.cardInstanceId,
    definitionId: targetItem.definitionId,
    owner: targetItem.caster,
  }
  result = putOnTopOfLibrary(result, counteredCard)

  // Memory Lapse itself goes to graveyard
  result = toGraveyard(result, resolvedCard)

  result = addLogEntry(result, getPlayer(result, item.caster).name,
    `countered ${targetDef.name} (put on top of library)`)

  return result
}

/**
 * Brainstorm: Draw 3 cards, then put 2 cards from your hand on top of the
 * shared library. (Simplified: CPU picks worst 2 cards; player picks randomly
 * for now — will add UI for selection later)
 */
function resolveBrainstorm(state: GameState, caster: string, card: CardInstance): GameState {
  let result = drawCards(state, caster, 3)
  if (result.gameOver) return result

  // Auto-select 2 cards to put back (pick the last 2 drawn for simplicity)
  // In a full implementation, the player would choose
  const player = getPlayer(result, caster)
  if (player.hand.length >= 2) {
    const newHand = [...player.hand]
    // Put back the last 2 cards (most recently drawn)
    const putBack1 = newHand.pop()!
    const putBack2 = newHand.pop()!
    result = updatePlayer(result, caster, { hand: newHand })
    result = putOnTopOfLibrary(result, putBack2)
    result = putOnTopOfLibrary(result, putBack1)
  }

  result = toGraveyard(result, card)
  return result
}

/**
 * Accumulated Knowledge: Draw 1 + number of Accumulated Knowledge in the
 * shared graveyard.
 */
function resolveAccumulatedKnowledge(state: GameState, caster: string, card: CardInstance): GameState {
  // Count AK in graveyard BEFORE this one goes there
  const akInGraveyard = state.sharedGraveyard.filter(
    c => c.definitionId === 'accumulated_knowledge'
  ).length

  const drawCount = 1 + akInGraveyard

  // Put AK in graveyard first (so it counts for future AKs)
  let result = toGraveyard(state, card)
  result = drawCards(result, caster, drawCount)

  result = addLogEntry(result, getPlayer(result, caster).name,
    `drew ${drawCount} cards from Accumulated Knowledge`)

  return result
}

/**
 * Telling Time: Look at top 3, put 1 in hand, 1 on top, 1 on bottom.
 * Simplified: take the first, keep second on top, put third on bottom.
 */
function resolveTellingTime(state: GameState, caster: string, card: CardInstance): GameState {
  const library = [...state.sharedLibrary]
  if (library.length < 1) {
    return toGraveyard(state, card)
  }

  const top3 = library.splice(0, Math.min(3, library.length))
  const player = getPlayer(state, caster)
  const newHand = [...player.hand]

  // Put first card in hand
  if (top3[0]) newHand.push(top3[0])
  // Second stays on top
  if (top3[1]) library.unshift(top3[1])
  // Third goes to bottom
  if (top3[2]) library.push(top3[2])

  let result: GameState = { ...state, sharedLibrary: library }
  result = updatePlayer(result, caster, { hand: newHand })
  result = toGraveyard(result, card)
  return result
}

/**
 * Crystal Spray: In DanDân, this is primarily used as removal by changing
 * "Island" to another land type on a Dandân, causing it to be sacrificed.
 * Also draws a card. Simplified: destroy target Dandân + draw a card.
 */
function resolveCrystalSpray(state: GameState, caster: string, _item: StackItem, card: CardInstance): GameState {
  let result = state
  const opponentId = opponent(result, caster)

  // Target an opponent's Dandân if possible
  const opponentPlayer = getPlayer(result, opponentId)
  const targetDandan = opponentPlayer.battlefield.find(c =>
    getCardDefinition(c.definitionId).id === 'dandan'
  )

  if (targetDandan) {
    const removal = removeFromBattlefield(result, opponentId, targetDandan.id)
    result = removal.state
    if (removal.card) {
      result = toGraveyard(result, removal.card)
      result = addLogEntry(result, getPlayer(result, caster).name,
        `destroyed ${getPlayer(result, opponentId).name}'s Dandân with Crystal Spray`)
    }
  }

  // Draw a card
  result = drawCards(result, caster, 1)

  // Crystal Spray to graveyard
  result = toGraveyard(result, card)
  return result
}

/**
 * Unsubstantiate: Return target spell or creature to its owner's hand.
 * If targeting a spell on the stack, remove it and return to hand.
 * If targeting a creature on the battlefield, bounce it.
 */
function resolveUnsubstantiate(state: GameState, item: StackItem, card: CardInstance): GameState {
  let result = state
  const caster = item.caster
  const opponentId = opponent(result, caster)

  // Try to bounce an opponent's creature first
  const opponentPlayer = getPlayer(result, opponentId)
  const targetCreature = opponentPlayer.battlefield.find(c =>
    getCardDefinition(c.definitionId).type === 'creature'
  )

  if (targetCreature) {
    const removal = removeFromBattlefield(result, opponentId, targetCreature.id)
    result = removal.state
    if (removal.card) {
      const opponentUpdated = getPlayer(result, opponentId)
      result = updatePlayer(result, opponentId, {
        hand: [...opponentUpdated.hand, removal.card],
      })
      result = addLogEntry(result, getPlayer(result, caster).name,
        `bounced ${getCardDefinition(removal.card.definitionId).name} to hand`)
    }
  } else if (result.stack.length > 0) {
    // Bounce a spell on the stack
    const targetIdx = result.stack.length - 1
    const targetSpell = result.stack[targetIdx]!
    const targetDef = getCardDefinition(targetSpell.definitionId)

    const newStack = [...result.stack]
    newStack.splice(targetIdx, 1)
    result = { ...result, stack: newStack }

    // Return to caster's hand
    const spellOwner = targetSpell.caster
    const ownerPlayer = getPlayer(result, spellOwner)
    const returnedCard: CardInstance = {
      id: targetSpell.cardInstanceId,
      definitionId: targetSpell.definitionId,
      owner: spellOwner,
    }
    result = updatePlayer(result, spellOwner, {
      hand: [...ownerPlayer.hand, returnedCard],
    })
    result = addLogEntry(result, getPlayer(result, caster).name,
      `bounced ${targetDef.name} from the stack`)
  }

  result = toGraveyard(result, card)
  return result
}

/**
 * Predict: Name a card, mill 2 from shared library. If named card was milled,
 * draw 2. Otherwise draw 1. Simplified: AI names "Dandân" (most common card).
 */
function resolvePredict(state: GameState, caster: string, item: StackItem, card: CardInstance): GameState {
  // Name the most common card — Dandân (10 copies)
  const namedCard = item.namedCard ?? 'dandan'

  const { state: afterMill, milled } = millCards(state, 2)
  let result = afterMill

  const hitNamed = milled.some(c => c.definitionId === namedCard)

  if (hitNamed) {
    result = drawCards(result, caster, 2)
    result = addLogEntry(result, getPlayer(result, caster).name,
      `Predict hit! Named "${getCardDefinition(namedCard).name}", drew 2 cards`)
  } else {
    result = drawCards(result, caster, 1)
    result = addLogEntry(result, getPlayer(result, caster).name,
      `Predict missed. Named "${getCardDefinition(namedCard).name}", drew 1 card`)
  }

  result = toGraveyard(result, card)
  return result
}

/**
 * Chart a Course: Draw 2 cards. Discard 1 unless you attacked this turn.
 * Simplified: auto-discard the last drawn card if no attack.
 */
function resolveChartACourse(state: GameState, caster: string, card: CardInstance): GameState {
  let result = drawCards(state, caster, 2)
  if (result.gameOver) return result

  const player = getPlayer(result, caster)

  if (!player.attackedThisTurn && player.hand.length > 0) {
    // Discard a card (simplified: discard the last card in hand)
    const newHand = [...player.hand]
    const discarded = newHand.pop()!
    result = updatePlayer(result, caster, { hand: newHand })
    result = toGraveyard(result, discarded)
    result = addLogEntry(result, player.name,
      `discarded ${getCardDefinition(discarded.definitionId).name} (Chart a Course)`)
  }

  result = toGraveyard(result, card)
  return result
}

/**
 * Capture of Jingzhou: Take an extra turn after this one.
 * Simplified: set a flag for an extra turn.
 */
function resolveCaptureOfJingzhou(state: GameState, caster: string, card: CardInstance): GameState {
  let result = toGraveyard(state, card)
  // We'll track extra turns with a simple counter
  result = {
    ...result,
    extraTurns: ((result as GameState & { extraTurns?: number }).extraTurns ?? 0) + 1,
    extraTurnPlayer: caster,
  } as GameState
  result = addLogEntry(result, getPlayer(result, caster).name, 'will take an extra turn!')
  return result
}

/**
 * Day's Undoing: Each player shuffles hand + graveyard into library, draws 7.
 * If it's your turn, end the turn.
 */
function resolveDaysUndoing(state: GameState, caster: string, card: CardInstance): GameState {
  let result = state

  // Collect all hands and graveyard
  const allCards: CardInstance[] = [...result.sharedGraveyard]
  for (const pid of result.playerOrder) {
    const p = getPlayer(result, pid)
    allCards.push(...p.hand)
    result = updatePlayer(result, pid, { hand: [] })
  }

  // Shuffle everything into the library
  const newLibrary = shuffleDeck([...result.sharedLibrary, ...allCards, card])
  result = { ...result, sharedLibrary: newLibrary, sharedGraveyard: [] }

  // Each player draws 7 (active player draws first, one at a time)
  const drawOrder = result.activePlayer === result.playerOrder[0]
    ? result.playerOrder
    : [result.playerOrder[1]!, result.playerOrder[0]!]

  for (let i = 0; i < 7; i++) {
    for (const pid of drawOrder) {
      result = drawCards(result, pid, 1)
      if (result.gameOver) return result
    }
  }

  // If it's the caster's turn, end the turn
  if (result.activePlayer === caster) {
    result = { ...result, phase: 'cleanup' }
  }

  result = addLogEntry(result, getPlayer(result, caster).name,
    "Day's Undoing reshuffled everything, both players drew 7")

  return result
}

/**
 * Mental Note: Mill 2 cards from shared library, then draw 1.
 */
function resolveMentalNote(state: GameState, caster: string, card: CardInstance): GameState {
  const { state: afterMill, milled } = millCards(state, 2)
  let result = afterMill

  const milledNames = milled.map(c => getCardDefinition(c.definitionId).name).join(', ')
  result = addLogEntry(result, getPlayer(result, caster).name,
    `milled ${milledNames}`)

  result = drawCards(result, caster, 1)
  result = toGraveyard(result, card)
  return result
}

/**
 * Metamorphose: Put target permanent on top of its owner's library.
 * That permanent's controller draws 2 cards.
 * Primarily used to bounce opponent's Dandân (they draw 2 but lose tempo).
 */
function resolveMetamorphose(state: GameState, item: StackItem, card: CardInstance): GameState {
  let result = state
  const caster = item.caster
  const opponentId = opponent(result, caster)

  // Target opponent's creature/permanent
  const opponentPlayer = getPlayer(result, opponentId)
  const target = opponentPlayer.battlefield.find(c =>
    getCardDefinition(c.definitionId).type === 'creature'
  ) ?? opponentPlayer.battlefield.find(c =>
    getCardDefinition(c.definitionId).type !== 'land'
  )

  if (target) {
    const removal = removeFromBattlefield(result, opponentId, target.id)
    result = removal.state
    if (removal.card) {
      result = putOnTopOfLibrary(result, removal.card)
      // Controller draws 2
      result = drawCards(result, opponentId, 2)
      result = addLogEntry(result, getPlayer(result, caster).name,
        `put ${getCardDefinition(removal.card.definitionId).name} on top of library, opponent drew 2`)
    }
  }

  result = toGraveyard(result, card)
  return result
}

/**
 * Magical Hack: Change land type text on a permanent. In DanDân, works
 * similarly to Crystal Spray but the change is permanent (not until end of turn).
 * Simplified: destroy target Dandân by changing its Island requirement.
 */
function resolveMagicalHack(state: GameState, caster: string, _item: StackItem, card: CardInstance): GameState {
  let result = state
  const opponentId = opponent(result, caster)

  const opponentPlayer = getPlayer(result, opponentId)
  const targetDandan = opponentPlayer.battlefield.find(c =>
    getCardDefinition(c.definitionId).id === 'dandan'
  )

  if (targetDandan) {
    const removal = removeFromBattlefield(result, opponentId, targetDandan.id)
    result = removal.state
    if (removal.card) {
      result = toGraveyard(result, removal.card)
      result = addLogEntry(result, getPlayer(result, caster).name,
        `destroyed ${getPlayer(result, opponentId).name}'s Dandân with Magical Hack`)
    }
  }

  result = toGraveyard(result, card)
  return result
}

/**
 * Control Magic: Enchant creature — you control enchanted creature.
 * Steal an opponent's Dandân.
 */
function resolveControlMagic(state: GameState, caster: string, _item: StackItem, card: CardInstance): GameState {
  let result = state
  const opponentId = opponent(result, caster)

  const opponentPlayer = getPlayer(result, opponentId)
  const targetCreature = opponentPlayer.battlefield.find(c =>
    getCardDefinition(c.definitionId).type === 'creature'
  )

  if (targetCreature) {
    // Remove from opponent's battlefield
    const removal = removeFromBattlefield(result, opponentId, targetCreature.id)
    result = removal.state

    if (removal.card) {
      // Add to caster's battlefield with Control Magic attached
      const stolenCreature: CardInstance = {
        ...removal.card,
        controller: caster,
        attachedTo: card.id,
        summoningSick: true, // summoning sickness resets on controller change
      }

      const enchantment: CardInstance = {
        ...card,
        owner: caster,
        controller: caster,
      }

      const casterPlayer = getPlayer(result, caster)
      result = updatePlayer(result, caster, {
        battlefield: [...casterPlayer.battlefield, stolenCreature, enchantment],
      })

      result = addLogEntry(result, getPlayer(result, caster).name,
        `stole ${getPlayer(result, opponentId).name}'s Dandân with Control Magic`)
    }
  } else {
    // No valid target — fizzles
    result = toGraveyard(result, card)
    result = addLogEntry(result, getPlayer(result, caster).name,
      'Control Magic fizzled (no target)')
  }

  return result
}
