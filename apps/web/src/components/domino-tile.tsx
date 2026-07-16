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
}

export function DominoTile({ tile, selectable = false, onSelect, compact = false }: DominoTileProps) {
  const label = `Tile ${tile.id}`;
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
        className={`domino ${compact ? "domino-compact" : ""}`}
        onClick={() => onSelect?.(tile.id)}
      >
        {face}
      </button>
    );
  }

  return (
    <span role="img" aria-label={label} className={`domino ${compact ? "domino-compact" : ""}`}>
      {face}
    </span>
  );
}

function PipGrid({ count }: { readonly count: number }) {
  return (
    <span className={`pip-grid pips-${count}`}>
      {Array.from({ length: count }, (_, index) => <span className="pip" key={index} />)}
    </span>
  );
}

