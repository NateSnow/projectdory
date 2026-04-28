import type { CardInstance, StackItem, LogEntry } from './cards/types'

/** Game phases following MTG turn structure */
export type GamePhase =
  | 'mulligan'
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'combat_begin'
  | 'declare_attackers'
  | 'declare_blockers'
  | 'combat_damage'
  | 'combat_end'
  | 'main2'
  | 'end_step'
  | 'cleanup'

/** Play mode */
export type GameMode = 'cpu' | 'local' | 'online'

/** Player state */
export interface PlayerState {
  id: string
  name: string
  hand: CardInstance[]
  battlefield: CardInstance[]
  life: number
  manaPool: number
  landPlayedThisTurn: boolean
  dandanHits: number
  /** Has this player attacked this turn? (for Chart a Course) */
  attackedThisTurn: boolean
  /** Mulligan state */
  mulligansTaken: number
  hasKeptHand: boolean
}

/** Complete game state */
export interface GameState {
  /** Shared zones */
  sharedLibrary: CardInstance[]
  sharedGraveyard: CardInstance[]

  /** Player states keyed by player ID */
  players: Record<string, PlayerState>
  playerOrder: [string, string]

  /** The stack */
  stack: StackItem[]

  /** Game flow */
  activePlayer: string
  priorityPlayer: string
  phase: GamePhase
  turnNumber: number
  gameLog: LogEntry[]

  /** Game metadata */
  mode: GameMode
  roomCode?: string
  winner?: string
  winReason?: string
  gameOver: boolean

  /** UI state hints */
  waitingForTarget?: boolean
  waitingForMulligan?: boolean
  pendingAction?: string
}

/** Create initial player state */
export function createPlayerState(id: string, name: string): PlayerState {
  return {
    id,
    name,
    hand: [],
    battlefield: [],
    life: 20,
    manaPool: 0,
    landPlayedThisTurn: false,
    dandanHits: 0,
    attackedThisTurn: false,
    mulligansTaken: 0,
    hasKeptHand: false,
  }
}

/** Create initial game state */
export function createInitialGameState(mode: GameMode): GameState {
  const player1 = createPlayerState('player1', 'You')
  const player2 = createPlayerState('player2', mode === 'cpu' ? 'Dory (CPU)' : 'Player 2')

  return {
    sharedLibrary: [],
    sharedGraveyard: [],
    players: {
      player1,
      player2,
    },
    playerOrder: ['player1', 'player2'],
    stack: [],
    activePlayer: 'player1',
    priorityPlayer: 'player1',
    phase: 'mulligan',
    turnNumber: 1,
    gameLog: [],
    mode,
    gameOver: false,
    waitingForMulligan: true,
  }
}
