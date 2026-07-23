import type { PlayerView } from "@dominoes/contracts";

type PlacedTile = PlayerView["chain"][number];
export type DominoOrientation = "horizontal" | "vertical";

export interface PositionedTile {
  readonly tile: PlacedTile;
  readonly visualTile: PlacedTile["tile"];
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
  const origin = rawTile(chain[originIndex]!, width / 2, 0, "horizontal", 1);
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
    const minCenterX = PADDING + dimensions.width / 2;
    const maxCenterX = width - PADDING - dimensions.width / 2;
    const horizontalCenterX = Math.min(maxCenterX, Math.max(minCenterX, centerX));
    const crossesBoundary = centerX < minCenterX - GAP || centerX > maxCenterX + GAP;
    if (crossesBoundary) {
      const turnOrientation = tileOrientation(tile, "vertical");
      const turnDimensions = tileDimensions(turnOrientation);
      const turnCenterX = Math.min(width - PADDING - turnDimensions.width / 2, Math.max(PADDING + turnDimensions.width / 2, previous.centerX));
      const centerY = previous.centerY + verticalDirection * (previous.height / 2 + turnDimensions.height / 2 + GAP);
      previous = rawTile(tile, turnCenterX, centerY, turnOrientation, flowDirection(verticalDirection, indexStep));
      horizontalDirection = horizontalDirection === -1 ? 1 : -1;
    } else {
      previous = rawTile(tile, horizontalCenterX, previous.centerY, orientation, flowDirection(horizontalDirection, indexStep));
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
  orientation: DominoOrientation,
  flowDirection: -1 | 1
): RawTile {
  return { tile, visualTile: visuallyOrderTile(tile, flowDirection), centerX, centerY, orientation, ...tileDimensions(orientation) };
}

function visuallyOrderTile(tile: PlacedTile, flowDirection: -1 | 1): PlacedTile["tile"] {
  return flowDirection === 1
    ? { id: tile.tile.id, left: tile.left, right: tile.right }
    : { id: tile.tile.id, left: tile.right, right: tile.left };
}

function flowDirection(direction: -1 | 1, indexStep: -1 | 1): -1 | 1 {
  return direction === indexStep ? 1 : -1;
}
