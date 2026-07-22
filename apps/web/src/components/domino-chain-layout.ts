import type { PlayerView } from "@dominoes/contracts";

type PlacedTile = PlayerView["chain"][number];
export type DominoOrientation = "horizontal" | "vertical";

export interface PositionedTile {
  readonly tile: PlacedTile;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly orientation: DominoOrientation;
}

export interface DominoChainLayout {
  readonly tiles: PositionedTile[];
  readonly height: number;
}

const LONG_SIDE = 90;
const SHORT_SIDE = 49;
const GAP = 4;
const PADDING = 12;
const MIN_HEIGHT = 280;

interface RawTile extends Omit<PositionedTile, "x" | "y"> {
  readonly centerX: number;
  readonly centerY: number;
}

export function layoutDominoChain(chain: readonly PlacedTile[], containerWidth: number): DominoChainLayout {
  if (!chain.length) return { tiles: [], height: MIN_HEIGHT };
  const width = Math.max(containerWidth, LONG_SIDE + PADDING * 2);
  const originIndex = Math.max(0, chain.findIndex(({ moveNumber }) => moveNumber === 0));
  const origin = rawTile(chain[originIndex]!, width / 2, 0, "horizontal");
  const rawTiles = new Map<number, RawTile>([[originIndex, origin]]);

  placeBranch(chain, originIndex - 1, -1, origin, "left", width, rawTiles);
  placeBranch(chain, originIndex + 1, 1, origin, "right", width, rawTiles);

  const ordered = chain.map((_, index) => rawTiles.get(index)!).filter(Boolean);
  const minY = Math.min(...ordered.map(({ centerY, height }) => centerY - height / 2));
  const maxY = Math.max(...ordered.map(({ centerY, height }) => centerY + height / 2));
  const contentHeight = maxY - minY;
  const height = Math.max(MIN_HEIGHT, Math.ceil(contentHeight + PADDING * 2));
  const offsetY = (height - contentHeight) / 2 - minY;

  return {
    height,
    tiles: ordered.map(({ centerX, centerY, ...placed }) => ({
      ...placed,
      x: Math.round((centerX - placed.width / 2) * 100) / 100,
      y: Math.round((centerY + offsetY - placed.height / 2) * 100) / 100
    }))
  };
}

function placeBranch(
  chain: readonly PlacedTile[],
  firstIndex: number,
  indexStep: -1 | 1,
  origin: RawTile,
  branch: "left" | "right",
  width: number,
  output: Map<number, RawTile>
): void {
  let previous = origin;
  let horizontalDirection: -1 | 1 = branch === "left" ? -1 : 1;
  const verticalDirection: -1 | 1 = branch === "left" ? -1 : 1;

  for (let index = firstIndex; index >= 0 && index < chain.length; index += indexStep) {
    const tile = chain[index]!;
    const orientation = tileOrientation(tile, "horizontal");
    const dimensions = tileDimensions(orientation);
    const centerX = previous.centerX + horizontalDirection * (previous.width / 2 + dimensions.width / 2 + GAP);
    const crossesBoundary = centerX - dimensions.width / 2 < PADDING || centerX + dimensions.width / 2 > width - PADDING;
    if (crossesBoundary) {
      const turnOrientation = tileOrientation(tile, "vertical");
      const turnDimensions = tileDimensions(turnOrientation);
      const turnCenterX = Math.min(width - PADDING - turnDimensions.width / 2, Math.max(PADDING + turnDimensions.width / 2, previous.centerX));
      const centerY = previous.centerY + verticalDirection * (previous.height / 2 + turnDimensions.height / 2 + GAP);
      previous = rawTile(tile, turnCenterX, centerY, turnOrientation);
      horizontalDirection = horizontalDirection === -1 ? 1 : -1;
    } else {
      previous = rawTile(tile, centerX, previous.centerY, orientation);
    }
    output.set(index, previous);
  }
}

function tileOrientation(tile: PlacedTile, travel: DominoOrientation): DominoOrientation {
  if (tile.tile.left !== tile.tile.right) return travel;
  return travel === "horizontal" ? "vertical" : "horizontal";
}

function tileDimensions(orientation: DominoOrientation): { width: number; height: number } {
  return orientation === "horizontal"
    ? { width: LONG_SIDE, height: SHORT_SIDE }
    : { width: SHORT_SIDE, height: LONG_SIDE };
}

function rawTile(
  tile: PlacedTile,
  centerX: number,
  centerY: number,
  orientation: DominoOrientation
): RawTile {
  return { tile, centerX, centerY, orientation, ...tileDimensions(orientation) };
}
