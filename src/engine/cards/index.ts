import type { CardDefinition, CardInstance } from './types'

/**
 * Complete card registry for the Secret Lair DanDân deck.
 * 80 cards total, based on the official decklist.
 */
export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  // ═══════════════════════════════════════════
  // CREATURES (10 total)
  // ═══════════════════════════════════════════
  dandan: {
    id: 'dandan',
    name: 'Dandân',
    manaCost: '{U}{U}',
    cmc: 2,
    type: 'creature',
    subtype: 'Fish',
    power: 4,
    toughness: 1,
    oracleText: 'Dandân can\'t attack unless defending player controls an Island.\nWhen you control no Islands, sacrifice Dandân.',
    quantity: 10,
  },

  // ═══════════════════════════════════════════
  // INSTANTS (26 total)
  // ═══════════════════════════════════════════
  memory_lapse: {
    id: 'memory_lapse',
    name: 'Memory Lapse',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'instant',
    oracleText: 'Counter target spell. If that spell is countered this way, put it on top of its owner\'s library instead of into that player\'s graveyard.',
    quantity: 8,
  },

  brainstorm: {
    id: 'brainstorm',
    name: 'Brainstorm',
    manaCost: '{U}',
    cmc: 1,
    type: 'instant',
    oracleText: 'Draw three cards, then put two cards from your hand on top of your library in any order.',
    quantity: 2,
  },

  accumulated_knowledge: {
    id: 'accumulated_knowledge',
    name: 'Accumulated Knowledge',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'instant',
    oracleText: 'Draw a card, then draw cards equal to the number of cards named Accumulated Knowledge in all graveyards.',
    quantity: 4,
  },

  telling_time: {
    id: 'telling_time',
    name: 'Telling Time',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'instant',
    oracleText: 'Look at the top three cards of your library. Put one of those cards into your hand, one on top of your library, and one on the bottom of your library.',
    quantity: 2,
  },

  crystal_spray: {
    id: 'crystal_spray',
    name: 'Crystal Spray',
    manaCost: '{2}{U}',
    cmc: 3,
    type: 'instant',
    oracleText: 'Change the text of target spell or permanent by replacing all instances of one basic land type with another until end of turn.\nDraw a card.',
    quantity: 2,
  },

  unsubstantiate: {
    id: 'unsubstantiate',
    name: 'Unsubstantiate',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'instant',
    oracleText: 'Return target spell or creature to its owner\'s hand.',
    quantity: 2,
  },

  predict: {
    id: 'predict',
    name: 'Predict',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'instant',
    oracleText: 'Choose a card name, then target opponent mills two cards. If a card with the chosen name was milled this way, you draw two cards. Otherwise, you draw a card.',
    quantity: 2,
  },

  // ═══════════════════════════════════════════
  // SORCERIES (14 total)
  // ═══════════════════════════════════════════
  chart_a_course: {
    id: 'chart_a_course',
    name: 'Chart a Course',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'sorcery',
    oracleText: 'Draw two cards. Then discard a card unless you attacked with a creature this turn.',
    quantity: 2,
  },

  capture_of_jingzhou: {
    id: 'capture_of_jingzhou',
    name: 'Capture of Jingzhou',
    manaCost: '{3}{U}{U}',
    cmc: 5,
    type: 'sorcery',
    oracleText: 'Take an extra turn after this one.',
    quantity: 2,
  },

  days_undoing: {
    id: 'days_undoing',
    name: "Day's Undoing",
    manaCost: '{2}{U}',
    cmc: 3,
    type: 'sorcery',
    oracleText: 'Each player shuffles their hand and graveyard into their library, then draws seven cards. If it\'s your turn, end the turn.',
    quantity: 2,
  },

  mental_note: {
    id: 'mental_note',
    name: 'Mental Note',
    manaCost: '{U}',
    cmc: 1,
    type: 'instant',
    oracleText: 'Mill two cards, then draw a card.',
    quantity: 2,
  },

  metamorphose: {
    id: 'metamorphose',
    name: 'Metamorphose',
    manaCost: '{1}{U}',
    cmc: 2,
    type: 'instant',
    oracleText: 'Put target permanent on top of its owner\'s library. That permanent\'s controller draws two cards.',
    quantity: 2,
  },

  magical_hack: {
    id: 'magical_hack',
    name: 'Magical Hack',
    manaCost: '{U}',
    cmc: 1,
    type: 'instant',
    oracleText: 'Change the text of target spell or permanent by replacing all instances of one basic land type with another.',
    quantity: 2,
  },

  // ═══════════════════════════════════════════
  // ENCHANTMENTS (2 total)
  // ═══════════════════════════════════════════
  control_magic: {
    id: 'control_magic',
    name: 'Control Magic',
    manaCost: '{2}{U}{U}',
    cmc: 4,
    type: 'enchantment',
    subtype: 'Aura',
    oracleText: 'Enchant creature\nYou control enchanted creature.',
    quantity: 2,
  },

  // ═══════════════════════════════════════════
  // LANDS (32 total)
  // ═══════════════════════════════════════════
  island: {
    id: 'island',
    name: 'Island',
    manaCost: '',
    cmc: 0,
    type: 'land',
    supertype: 'Basic',
    subtype: 'Island',
    oracleText: '({T}: Add {U}.)',
    quantity: 20,
  },

  mystic_sanctuary: {
    id: 'mystic_sanctuary',
    name: 'Mystic Sanctuary',
    manaCost: '',
    cmc: 0,
    type: 'land',
    subtype: 'Island',
    oracleText: 'Mystic Sanctuary enters the battlefield tapped unless you control three or more other Islands.\nWhen Mystic Sanctuary enters the battlefield untapped, you may put target instant or sorcery card from your graveyard on top of your library.',
    entersTapped: false, // conditional
    quantity: 2,
  },

  halimar_depths: {
    id: 'halimar_depths',
    name: 'Halimar Depths',
    manaCost: '',
    cmc: 0,
    type: 'land',
    oracleText: 'Halimar Depths enters the battlefield tapped.\nWhen Halimar Depths enters the battlefield, look at the top three cards of your library, then put them back in any order.',
    entersTapped: true,
    quantity: 2,
  },

  lonely_sandbar: {
    id: 'lonely_sandbar',
    name: 'Lonely Sandbar',
    manaCost: '',
    cmc: 0,
    type: 'land',
    subtype: 'Island',
    oracleText: 'Lonely Sandbar enters the battlefield tapped.\n{T}: Add {U}.\nCycling {U}',
    entersTapped: true,
    cycling: '{U}',
    quantity: 2,
  },

  remote_isle: {
    id: 'remote_isle',
    name: 'Remote Isle',
    manaCost: '',
    cmc: 0,
    type: 'land',
    subtype: 'Island',
    oracleText: 'Remote Isle enters the battlefield tapped.\n{T}: Add {U}.\nCycling {2}',
    entersTapped: true,
    cycling: '{2}',
    quantity: 2,
  },

  haunted_fengraf: {
    id: 'haunted_fengraf',
    name: 'Haunted Fengraf',
    manaCost: '',
    cmc: 0,
    type: 'land',
    oracleText: '{T}: Add {C}.\n{3}, {T}, Sacrifice Haunted Fengraf: Return a creature card at random from your graveyard to your hand.',
    quantity: 2,
  },

  svyelunite_temple: {
    id: 'svyelunite_temple',
    name: 'Svyelunite Temple',
    manaCost: '',
    cmc: 0,
    type: 'land',
    oracleText: 'Svyelunite Temple enters the battlefield tapped.\n{T}: Add {U}.\n{T}, Sacrifice Svyelunite Temple: Add {U}{U}.',
    entersTapped: true,
    quantity: 2,
  },

  the_surgical_bay: {
    id: 'the_surgical_bay',
    name: 'The Surgical Bay',
    manaCost: '',
    cmc: 0,
    type: 'land',
    oracleText: 'The Surgical Bay enters the battlefield tapped.\n{T}: Add {U}.\n{2}{U}, {T}: Surveil 1.',
    entersTapped: true,
    quantity: 2,
  },
}

/** Get a card definition by ID */
export function getCardDefinition(id: string): CardDefinition {
  const def = CARD_DEFINITIONS[id]
  if (!def) throw new Error(`Unknown card definition: ${id}`)
  return def
}

/** Build the full 80-card deck as card instances */
export function buildDeck(): CardInstance[] {
  const deck: CardInstance[] = []
  let instanceCounter = 0

  for (const def of Object.values(CARD_DEFINITIONS)) {
    for (let i = 0; i < def.quantity; i++) {
      deck.push({
        id: `${def.id}_${instanceCounter++}`,
        definitionId: def.id,
      })
    }
  }

  return deck
}

/** Fisher-Yates shuffle */
export function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }
  return shuffled
}

/** Get all card definitions as an array */
export function getAllCardDefinitions(): CardDefinition[] {
  return Object.values(CARD_DEFINITIONS)
}
