/** Card types in the DanDân format */
export type CardType = 'creature' | 'instant' | 'sorcery' | 'enchantment' | 'land'

/** Unique instance of a card in a game zone */
export interface CardInstance {
  /** Unique ID for this specific card instance */
  id: string
  /** Reference to the card definition */
  definitionId: string
  /** Which player "owns" this card (whoever cast it) */
  owner?: string
  /** Is this card tapped? (for permanents) */
  tapped?: boolean
  /** Is this card face-down? */
  faceDown?: boolean
  /** Attached enchantments (for Control Magic) */
  attachedTo?: string
  /** Controller (may differ from owner due to Control Magic) */
  controller?: string
  /** Summoning sickness — can't attack the turn it enters */
  summoningSick?: boolean
}

/** Target requirement for a spell */
export interface TargetRequirement {
  type: 'creature' | 'permanent' | 'spell' | 'player' | 'card_in_graveyard'
  /** Description shown to the player */
  description: string
  /** Filter function for valid targets */
  filter?: string
  /** Is targeting optional? */
  optional?: boolean
}

/** A selected target */
export interface Target {
  type: 'card' | 'player'
  id: string
}

/** Card definition — the template for a card */
export interface CardDefinition {
  id: string
  name: string
  manaCost: string
  cmc: number
  type: CardType
  subtype?: string
  supertype?: string
  power?: number
  toughness?: number
  oracleText: string
  /** Scryfall ID for the Secret Lair version */
  scryfallId?: string
  /** Scryfall set code (prefer 'sld' for Secret Lair) */
  scryfallSet?: string
  /** How many copies in the 80-card deck */
  quantity: number
  /** Whether this card enters the battlefield tapped */
  entersTapped?: boolean
  /** Whether this land can be cycled */
  cycling?: string
}

/** Stack item — a spell or ability waiting to resolve */
export interface StackItem {
  id: string
  cardInstanceId: string
  definitionId: string
  caster: string
  targets?: Target[]
  /** For naming cards (Predict) */
  namedCard?: string
}

/** Game log entry */
export interface LogEntry {
  turn: number
  phase: string
  player: string
  action: string
  timestamp: number
}
