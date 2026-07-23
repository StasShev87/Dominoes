"use client";

interface TileValue {
  readonly id: string;
  readonly left: number;
  readonly right: number;
}

interface DominoTileProps {
  readonly tile: TileValue;
  readonly selectable?: boolean;
  readonly onSelect?: (tileId: string) => void;
  readonly compact?: boolean;
  readonly orientation?: "horizontal" | "vertical";
}

const PIP_POSITIONS = {
  0: [],
  1: ["middle-center"],
  2: ["top-left", "bottom-right"],
  3: ["top-left", "middle-center", "bottom-right"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "middle-center", "bottom-left", "bottom-right"],
  6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"]
} as const;

export function DominoTile({ tile, selectable = false, onSelect, compact = false, orientation = "vertical" }: DominoTileProps) {
  const label = `Tile ${tile.id}`;
  const className = `domino domino-${orientation} ${compact ? "domino-compact" : ""}`;
  const face = (
    <span className="domino-face" aria-hidden="true">
      <PipGrid count={tile.left} />
      <span className="domino-divider" />
      <PipGrid count={tile.right} />
    </span>
  );

  if (selectable) {
    return (
      <button
        type="button"
        aria-label={label}
        className={className}
        data-orientation={orientation}
        onClick={() => onSelect?.(tile.id)}
      >
        {face}
      </button>
    );
  }

  return (
    <span role="img" aria-label={label} className={className} data-orientation={orientation}>
      {face}
    </span>
  );
}

function PipGrid({ count }: { readonly count: number }) {
  const positions = PIP_POSITIONS[count as keyof typeof PIP_POSITIONS] ?? [];
  return (
    <span className={`pip-grid pips-${count}`}>
      {positions.map((position) => <span className="pip" data-position={position} key={position} />)}
    </span>
  );
}

