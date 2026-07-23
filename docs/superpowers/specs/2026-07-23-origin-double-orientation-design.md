# Opening Double Orientation Design

## Goal

Render the opening domino perpendicular to the future horizontal chain when
the opening tile is a double. A non-double opening tile remains horizontal.

## Design

`layoutDominoChain` remains the single source of board orientation. When it
creates the move-zero tile, it will use the existing `tileOrientation`
function with horizontal travel instead of forcing a horizontal orientation.
This reuses the same double rule already applied to every later tile:

- non-double plus horizontal travel produces a horizontal tile;
- double plus horizontal travel produces a vertical tile.

The opening tile remains centered and retains its normalized visual pip order.
No game-engine, API, persistence, contract, or CSS changes are required.

## Testing

Add a layout regression test asserting that a move-zero double is vertical and
centered. Keep the existing test proving that a non-double move-zero tile is
horizontal. Run the focused layout tests, the full repository checks, and the
desktop/mobile Playwright suite.
