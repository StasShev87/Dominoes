export type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Tile {
  readonly id: string;
  readonly left: Pip;
  readonly right: Pip;
}

export type Side = "LEFT" | "RIGHT";
export type MatchStatus = "ACTIVE" | "FINISHED";

export interface PlacedTile {
  readonly tile: Tile;
  readonly left: Pip;
  readonly right: Pip;
}

export interface RoundState {
  readonly number: number;
  readonly hands: Tile[][];
  readonly boneyard: Tile[];
  readonly chain: PlacedTile[];
  readonly openEnds: readonly [Pip, Pip] | null;
  readonly currentSeat: number;
  readonly starterSeat: number;
  readonly consecutivePasses: number;
}

export interface MatchState {
  readonly id: string;
  readonly targetScore: number;
  readonly scores: number[];
  readonly status: MatchStatus;
  readonly winnerSeat: number | null;
  readonly version: number;
  readonly seed: number;
  readonly round: RoundState;
}

export type GameCommand =
  | { readonly type: "PLAY_TILE"; readonly seat: number; readonly tileId: string; readonly side: Side }
  | { readonly type: "DRAW_TILE"; readonly seat: number }
  | { readonly type: "PASS"; readonly seat: number };

export type GameEvent =
  | { readonly type: "TILE_PLAYED"; readonly seat: number; readonly tileId: string; readonly side: Side }
  | { readonly type: "TILE_DRAWN"; readonly seat: number }
  | { readonly type: "PLAYER_PASSED"; readonly seat: number }
  | { readonly type: "ROUND_FINISHED"; readonly winnerSeat: number | null; readonly points: number }
  | { readonly type: "MATCH_FINISHED"; readonly winnerSeat: number };

export interface Transition {
  readonly state: MatchState;
  readonly events: GameEvent[];
}

export type GameRuleErrorCode =
  | "NOT_YOUR_TURN"
  | "MATCH_FINISHED"
  | "TILE_NOT_OWNED"
  | "ILLEGAL_MOVE"
  | "DRAW_NOT_ALLOWED"
  | "BONEYARD_NOT_EMPTY"
  | "PLAY_AVAILABLE";

export class GameRuleError extends Error {
  constructor(readonly code: GameRuleErrorCode) {
    super(code);
    this.name = "GameRuleError";
  }
}

export type LegalAction =
  | { readonly type: "PLAY_TILE"; readonly tileId: string; readonly sides: Side[] }
  | { readonly type: "DRAW_TILE" }
  | { readonly type: "PASS" }
  | { readonly type: "CLAIM_FORFEIT" };

export interface PlayerView {
  readonly matchId: string;
  readonly seat: number;
  readonly version: number;
  readonly status: MatchStatus;
  readonly scores: number[];
  readonly targetScore: number;
  readonly winnerSeat: number | null;
  readonly roundNumber: number;
  readonly currentSeat: number;
  readonly hand: Tile[];
  readonly seats: Array<{ readonly seat: number; readonly tileCount: number }>;
  readonly boneyardCount: number;
  readonly chain: PlacedTile[];
  readonly openEnds: readonly [Pip, Pip] | null;
  readonly legalActions: LegalAction[];
}

const PIPS: readonly Pip[] = [0, 1, 2, 3, 4, 5, 6];

export function createDoubleSixSet(): Tile[] {
  return PIPS.flatMap((left) =>
    PIPS.filter((right) => right >= left).map((right) => ({
      id: `${left}-${right}`,
      left,
      right
    }))
  );
}

export function pipCount(tiles: readonly Tile[]): number {
  return tiles.reduce((total, tile) => total + tile.left + tile.right, 0);
}

export function createMatch(options: {
  readonly matchId: string;
  readonly seed: number;
  readonly targetScore?: number;
  readonly playerCount?: number;
}): MatchState {
  const playerCount = options.playerCount ?? 2;
  if (playerCount < 2 || playerCount > 4) {
    throw new RangeError("playerCount must be between 2 and 4");
  }

  const round = dealRound(options.seed, 1, playerCount);
  return {
    id: options.matchId,
    targetScore: options.targetScore ?? 100,
    scores: Array.from({ length: playerCount }, () => 0),
    status: "ACTIVE",
    winnerSeat: null,
    version: 0,
    seed: options.seed,
    round
  };
}

export function getLegalActions(state: MatchState, seat: number): LegalAction[] {
  if (state.status !== "ACTIVE" || state.round.currentSeat !== seat) return [];
  const hand = state.round.hands[seat];
  if (!hand) return [];

  const plays = hand.flatMap<LegalAction>((tile) => {
    const sides = legalSides(state.round, tile);
    return sides.length ? [{ type: "PLAY_TILE", tileId: tile.id, sides }] : [];
  });
  if (plays.length) return plays;
  return state.round.boneyard.length ? [{ type: "DRAW_TILE" }] : [{ type: "PASS" }];
}

export function applyCommand(state: MatchState, command: GameCommand): Transition {
  if (state.status !== "ACTIVE") throw new GameRuleError("MATCH_FINISHED");
  if (state.round.currentSeat !== command.seat) throw new GameRuleError("NOT_YOUR_TURN");

  switch (command.type) {
    case "PLAY_TILE":
      return playTile(state, command);
    case "DRAW_TILE":
      return drawTile(state, command.seat);
    case "PASS":
      return pass(state, command.seat);
  }
}

export function createPlayerView(state: MatchState, seat: number): PlayerView {
  const hand = state.round.hands[seat];
  if (!hand) throw new RangeError("Unknown seat");
  return {
    matchId: state.id,
    seat,
    version: state.version,
    status: state.status,
    scores: [...state.scores],
    targetScore: state.targetScore,
    winnerSeat: state.winnerSeat,
    roundNumber: state.round.number,
    currentSeat: state.round.currentSeat,
    hand: hand.map(copyTile),
    seats: state.round.hands.map((tiles, index) => ({ seat: index, tileCount: tiles.length })),
    boneyardCount: state.round.boneyard.length,
    chain: state.round.chain.map(copyPlacedTile),
    openEnds: state.round.openEnds ? [...state.round.openEnds] : null,
    legalActions: getLegalActions(state, seat)
  };
}

export function replayCommands(initialState: MatchState, commands: readonly GameCommand[]): MatchState {
  return commands.reduce((state, command) => applyCommand(state, command).state, initialState);
}

export function chooseAiCommand(state: MatchState, seat: number): GameCommand {
  const actions = getLegalActions(state, seat);
  const hand = state.round.hands[seat];
  if (!hand || !actions.length) throw new GameRuleError("NOT_YOUR_TURN");
  const plays = actions
    .filter((action): action is Extract<LegalAction, { type: "PLAY_TILE" }> => action.type === "PLAY_TILE")
    .sort((left, right) => {
      const leftTile = hand.find(({ id }) => id === left.tileId)!;
      const rightTile = hand.find(({ id }) => id === right.tileId)!;
      return pipCount([rightTile]) - pipCount([leftTile]) || left.tileId.localeCompare(right.tileId);
    });
  const play = plays[0];
  if (play) {
    return { type: "PLAY_TILE", seat, tileId: play.tileId, side: play.sides[0]! };
  }
  return actions[0]!.type === "DRAW_TILE" ? { type: "DRAW_TILE", seat } : { type: "PASS", seat };
}

function playTile(
  state: MatchState,
  command: Extract<GameCommand, { type: "PLAY_TILE" }>
): Transition {
  const hand = state.round.hands[command.seat]!;
  const tileIndex = hand.findIndex(({ id }) => id === command.tileId);
  if (tileIndex < 0) throw new GameRuleError("TILE_NOT_OWNED");
  const tile = hand[tileIndex]!;
  if (!legalSides(state.round, tile).includes(command.side)) {
    throw new GameRuleError("ILLEGAL_MOVE");
  }

  const hands = state.round.hands.map((tiles) => [...tiles]);
  hands[command.seat]!.splice(tileIndex, 1);
  const placement = orientTile(state.round, tile, command.side);
  const chain = command.side === "LEFT"
    ? [placement, ...state.round.chain]
    : [...state.round.chain, placement];
  const openEnds: readonly [Pip, Pip] = [chain[0]!.left, chain.at(-1)!.right];
  const nextRound: RoundState = {
    ...state.round,
    hands,
    chain,
    openEnds,
    currentSeat: nextSeat(command.seat, hands.length),
    consecutivePasses: 0
  };
  const played: GameEvent = {
    type: "TILE_PLAYED",
    seat: command.seat,
    tileId: command.tileId,
    side: command.side
  };

  if (hands[command.seat]!.length > 0) {
    return { state: { ...state, version: state.version + 1, round: nextRound }, events: [played] };
  }
  const points = hands.reduce((total, tiles, seat) =>
    seat === command.seat ? total : total + pipCount(tiles), 0);
  return finishRound(state, nextRound, command.seat, points, [played]);
}

function drawTile(state: MatchState, seat: number): Transition {
  const hand = state.round.hands[seat]!;
  if (hand.some((tile) => legalSides(state.round, tile).length)) {
    throw new GameRuleError("PLAY_AVAILABLE");
  }
  const [drawn, ...boneyard] = state.round.boneyard;
  if (!drawn) throw new GameRuleError("DRAW_NOT_ALLOWED");
  const hands = state.round.hands.map((tiles, index) => index === seat ? [...tiles, drawn] : [...tiles]);
  return {
    state: {
      ...state,
      version: state.version + 1,
      round: { ...state.round, hands, boneyard }
    },
    events: [{ type: "TILE_DRAWN", seat }]
  };
}

function pass(state: MatchState, seat: number): Transition {
  if (state.round.boneyard.length) throw new GameRuleError("BONEYARD_NOT_EMPTY");
  if (state.round.hands[seat]!.some((tile) => legalSides(state.round, tile).length)) {
    throw new GameRuleError("PLAY_AVAILABLE");
  }

  const consecutivePasses = state.round.consecutivePasses + 1;
  const nextRound: RoundState = {
    ...state.round,
    currentSeat: nextSeat(seat, state.round.hands.length),
    consecutivePasses
  };
  const passed: GameEvent = { type: "PLAYER_PASSED", seat };
  if (consecutivePasses < state.round.hands.length) {
    return { state: { ...state, version: state.version + 1, round: nextRound }, events: [passed] };
  }

  const totals = state.round.hands.map(pipCount);
  const lowest = Math.min(...totals);
  const winners = totals.flatMap((total, index) => total === lowest ? [index] : []);
  if (winners.length !== 1) return finishRound(state, nextRound, null, 0, [passed]);
  const winnerSeat = winners[0]!;
  const points = totals.reduce((total, value, index) =>
    index === winnerSeat ? total : total + Math.max(0, value - lowest), 0);
  return finishRound(state, nextRound, winnerSeat, points, [passed]);
}

function finishRound(
  state: MatchState,
  completedRound: RoundState,
  winnerSeat: number | null,
  points: number,
  prefixEvents: GameEvent[]
): Transition {
  const scores = [...state.scores];
  if (winnerSeat !== null) scores[winnerSeat] = (scores[winnerSeat] ?? 0) + points;
  const events: GameEvent[] = [
    ...prefixEvents,
    { type: "ROUND_FINISHED", winnerSeat, points }
  ];
  if (winnerSeat !== null && scores[winnerSeat]! >= state.targetScore) {
    events.push({ type: "MATCH_FINISHED", winnerSeat });
    return {
      state: {
        ...state,
        scores,
        status: "FINISHED",
        winnerSeat,
        version: state.version + 1,
        round: completedRound
      },
      events
    };
  }

  const roundNumber = completedRound.number + 1;
  const starterSeat = winnerSeat ?? nextSeat(completedRound.starterSeat, completedRound.hands.length);
  return {
    state: {
      ...state,
      scores,
      version: state.version + 1,
      round: dealRound(state.seed, roundNumber, completedRound.hands.length, starterSeat)
    },
    events
  };
}

function dealRound(seed: number, roundNumber: number, playerCount: number, starterSeat?: number): RoundState {
  const deck = shuffle(createDoubleSixSet(), seed + roundNumber * 0x9e3779b1);
  const hands = Array.from({ length: playerCount }, () => [] as Tile[]);
  for (let index = 0; index < playerCount * 7; index += 1) {
    hands[index % playerCount]!.push(deck[index]!);
  }
  const resolvedStarter = starterSeat ?? findOpeningSeat(hands);
  return {
    number: roundNumber,
    hands,
    boneyard: deck.slice(playerCount * 7),
    chain: [],
    openEnds: null,
    currentSeat: resolvedStarter,
    starterSeat: resolvedStarter,
    consecutivePasses: 0
  };
}

function legalSides(round: RoundState, tile: Tile): Side[] {
  if (!round.openEnds) return ["LEFT"];
  const result: Side[] = [];
  if (matches(tile, round.openEnds[0])) result.push("LEFT");
  if (matches(tile, round.openEnds[1])) result.push("RIGHT");
  return result;
}

function orientTile(round: RoundState, tile: Tile, side: Side): PlacedTile {
  if (!round.openEnds) return { tile: copyTile(tile), left: tile.left, right: tile.right };
  const target = side === "LEFT" ? round.openEnds[0] : round.openEnds[1];
  const other = tile.left === target ? tile.right : tile.left;
  return side === "LEFT"
    ? { tile: copyTile(tile), left: other, right: target }
    : { tile: copyTile(tile), left: target, right: other };
}

function matches(tile: Tile, pip: Pip): boolean {
  return tile.left === pip || tile.right === pip;
}

function nextSeat(seat: number, playerCount: number): number {
  return (seat + 1) % playerCount;
}

function findOpeningSeat(hands: readonly Tile[][]): number {
  let bestSeat = 0;
  let bestRank = -1;
  hands.forEach((hand, seat) => {
    hand.forEach((tile) => {
      const isDouble = tile.left === tile.right;
      const rank = isDouble ? 100 + tile.left : tile.left + tile.right + tile.right / 10;
      if (rank > bestRank) {
        bestRank = rank;
        bestSeat = seat;
      }
    });
  });
  return bestSeat;
}

function shuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function copyTile(tile: Tile): Tile {
  return { id: tile.id, left: tile.left, right: tile.right };
}

function copyPlacedTile(placed: PlacedTile): PlacedTile {
  return { tile: copyTile(placed.tile), left: placed.left, right: placed.right };
}
