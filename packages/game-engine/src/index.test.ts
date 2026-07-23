import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  applyCommand,
  chooseAiCommand,
  createDoubleSixSet,
  createMatch,
  createPlayerView,
  GameRuleError,
  getLegalActions,
  pipCount,
  replayCommands,
  type MatchState,
  type Tile
} from "./index.js";

describe("double-six set", () => {
  test("contains every unordered pair exactly once", () => {
    const tiles = createDoubleSixSet();
    const ids = new Set(tiles.map((tile) => tile.id));

    expect(tiles).toHaveLength(28);
    expect(ids.size).toBe(28);
    expect(tiles.every((tile) => tile.left <= tile.right)).toBe(true);
  });

  test("counts pips on a hand", () => {
    const hand: Tile[] = [
      { id: "6-6", left: 6, right: 6 },
      { id: "1-4", left: 1, right: 4 }
    ];

    expect(pipCount(hand)).toBe(17);
  });
});

describe("match lifecycle", () => {
  test("deals seven tiles per seat without losing tiles", () => {
    const state = createMatch({ matchId: "match-1", seed: 42 });
    const allTiles = [
      ...state.round.hands.flat(),
      ...state.round.boneyard,
      ...state.round.chain.map((placed) => placed.tile)
    ];

    expect(state.round.hands.map((hand) => hand.length)).toEqual([7, 7]);
    expect(state.round.boneyard).toHaveLength(14);
    expect(new Set(allTiles.map((tile) => tile.id)).size).toBe(28);
    expect(state.targetScore).toBe(100);
  });

  test("plays a matching tile and advances the turn", () => {
    const state = fixture({
      hands: [
        [tile(1, 2), tile(4, 6)],
        [tile(0, 0), tile(3, 5)]
      ],
      chain: [placed(2, 4)],
      currentSeat: 0
    });

    const result = applyCommand(state, {
      type: "PLAY_TILE",
      seat: 0,
      tileId: "1-2",
      side: "LEFT"
    });

    expect(result.state.round.chain.map(({ tile }) => tile.id)).toEqual(["1-2", "2-4"]);
    expect(result.state.round.chain.map(({ moveNumber }) => moveNumber)).toEqual([1, 0]);
    expect(result.state.round.openEnds).toEqual([1, 4]);
    expect(result.state.round.currentSeat).toBe(1);
    expect(result.state.version).toBe(1);
    expect(result.events[0]?.type).toBe("TILE_PLAYED");
  });

  test("numbers the opening tile as move zero", () => {
    const state = fixture({ hands: [[tile(1, 2), tile(4, 6)], [tile(0, 0)]], chain: [] });

    const result = applyCommand(state, { type: "PLAY_TILE", seat: 0, tileId: "1-2", side: "LEFT" });

    expect(result.state.round.chain[0]?.moveNumber).toBe(0);
    expect(createPlayerView(result.state, 0).chain[0]?.moveNumber).toBe(0);
  });

  test("rejects a move from a seat that does not own the turn", () => {
    const state = fixture({
      hands: [[tile(1, 2)], [tile(2, 3)]],
      chain: [placed(2, 4)],
      currentSeat: 0
    });

    expect(() =>
      applyCommand(state, { type: "PLAY_TILE", seat: 1, tileId: "2-3", side: "LEFT" })
    ).toThrowError(new GameRuleError("NOT_YOUR_TURN"));
  });

  test("draws without advancing and passes only when no move or boneyard remains", () => {
    const state = fixture({
      hands: [[tile(0, 0)], [tile(1, 1)]],
      boneyard: [tile(5, 6), tile(3, 3)],
      chain: [placed(2, 4)],
      currentSeat: 0
    });

    const drawn = applyCommand(state, { type: "DRAW_TILE", seat: 0 });
    expect(drawn.state.round.hands[0]?.map(({ id }) => id)).toEqual(["0-0", "5-6"]);
    expect(drawn.state.round.currentSeat).toBe(0);
    expect(() => applyCommand(drawn.state, { type: "PASS", seat: 0 })).toThrowError(
      new GameRuleError("BONEYARD_NOT_EMPTY")
    );

    const noBoneyard = fixture({
      hands: [[tile(0, 0)], [tile(1, 1)]],
      chain: [placed(2, 4)],
      currentSeat: 0
    });
    expect(applyCommand(noBoneyard, { type: "PASS", seat: 0 }).state.round.currentSeat).toBe(1);
  });

  test("scores the opponent hand when a player empties their hand", () => {
    const state = fixture({
      hands: [[tile(1, 2)], [tile(6, 6), tile(2, 3)]],
      chain: [placed(2, 4)],
      currentSeat: 0
    });

    const result = applyCommand(state, {
      type: "PLAY_TILE",
      seat: 0,
      tileId: "1-2",
      side: "LEFT"
    });

    expect(result.state.scores).toEqual([17, 0]);
    expect(result.events.some((event) => event.type === "ROUND_FINISHED")).toBe(true);
    expect(result.state.round.number).toBe(2);
  });

  test("creates a player view without exposing hidden tiles", () => {
    const state = fixture({
      hands: [[tile(0, 0), tile(1, 2)], [tile(4, 4)]],
      boneyard: [tile(5, 6)],
      chain: [placed(2, 4)]
    });

    const view = createPlayerView(state, 0);
    expect(view.seat).toBe(0);
    expect(view.hand.map(({ id }) => id)).toEqual(["0-0", "1-2"]);
    expect(view.seats).toEqual([{ seat: 0, tileCount: 2 }, { seat: 1, tileCount: 1 }]);
    expect(view.boneyardCount).toBe(1);
    expect(JSON.stringify(view)).not.toContain("5-6");
    expect(JSON.stringify(view)).not.toContain("4-4");
  });

  test("only advertises actions legal for the current seat", () => {
    const state = fixture({
      hands: [[tile(1, 2), tile(4, 6)], [tile(0, 0)]],
      boneyard: [tile(3, 3)],
      chain: [placed(2, 4)],
      currentSeat: 0
    });

    expect(getLegalActions(state, 0)).toEqual([
      { type: "PLAY_TILE", tileId: "1-2", sides: ["LEFT"] },
      { type: "PLAY_TILE", tileId: "4-6", sides: ["RIGHT"] }
    ]);
    expect(getLegalActions(state, 1)).toEqual([]);
  });

  test("finishes a blocked round and awards the difference in hand totals", () => {
    const state = fixture({
      hands: [[tile(0, 1)], [tile(5, 5)]],
      chain: [placed(2, 4)],
      currentSeat: 0,
      consecutivePasses: 1
    });

    const result = applyCommand(state, { type: "PASS", seat: 0 });

    expect(result.state.scores).toEqual([9, 0]);
    expect(result.state.round.number).toBe(2);
    expect(result.events.at(-1)).toEqual({ type: "ROUND_FINISHED", winnerSeat: 0, points: 9 });
  });

  test("replays the same commands to the same state", () => {
    const state = fixture({
      hands: [[tile(1, 2), tile(4, 6)], [tile(0, 0), tile(3, 5)]],
      chain: [placed(2, 4)],
      currentSeat: 0
    });
    const commands = [
      { type: "PLAY_TILE", seat: 0, tileId: "1-2", side: "LEFT" } as const,
      { type: "DRAW_TILE", seat: 1 } as const
    ];
    const stateWithBoneyard: MatchState = {
      ...state,
      round: { ...state.round, boneyard: [tile(1, 1)] }
    };

    expect(replayCommands(stateWithBoneyard, commands)).toEqual(
      commands.reduce((current, command) => applyCommand(current, command).state, stateWithBoneyard)
    );
  });

  test("every generated double-six set preserves canonical tile invariants", () => {
    fc.assert(fc.property(fc.integer(), () => {
      const tiles = createDoubleSixSet();
      return tiles.length === 28 && tiles.every(({ left, right }) => left <= right);
    }));
  });

  test("AI deterministically chooses the highest-pip legal tile", () => {
    const state = fixture({
      hands: [[tile(0, 0)], [tile(1, 2), tile(4, 6), tile(2, 5)]],
      chain: [placed(2, 4)],
      currentSeat: 1
    });

    expect(chooseAiCommand(state, 1)).toEqual({
      type: "PLAY_TILE",
      seat: 1,
      tileId: "4-6",
      side: "RIGHT"
    });
  });
});

function tile(left: Tile["left"], right: Tile["right"]): Tile {
  const [low, high] = left <= right ? [left, right] : [right, left];
  return { id: `${low}-${high}`, left: low, right: high };
}

function placed(left: Tile["left"], right: Tile["right"], moveNumber = 0) {
  return { tile: tile(left, right), left, right, moveNumber };
}

function fixture(input: {
  hands: Tile[][];
  chain: ReturnType<typeof placed>[];
  boneyard?: Tile[];
  currentSeat?: number;
  consecutivePasses?: number;
}): MatchState {
  const openEnds: [Tile["left"], Tile["right"]] | null = input.chain.length
    ? [input.chain[0]!.left, input.chain.at(-1)!.right]
    : null;
  return {
    id: "fixture",
    targetScore: 100,
    scores: input.hands.map(() => 0),
    status: "ACTIVE",
    winnerSeat: null,
    version: 0,
    seed: 7,
    round: {
      number: 1,
      hands: input.hands,
      boneyard: input.boneyard ?? [],
      chain: input.chain,
      openEnds,
      currentSeat: input.currentSeat ?? 0,
      starterSeat: input.currentSeat ?? 0,
      consecutivePasses: input.consecutivePasses ?? 0
    }
  };
}
