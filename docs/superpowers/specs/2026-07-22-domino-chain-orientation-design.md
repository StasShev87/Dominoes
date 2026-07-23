# Domino Chain Orientation Design

## Goal

Render every played domino so the touching halves of neighboring tiles show the
same pip value. This must remain true on both branches from the opening tile,
on reversed rows of the responsive snake, and on vertical turns.

## Source of Truth

The game engine already stores each `PlacedTile` in logical chain order:
`left` is the value facing the beginning of the chain and `right` is the value
facing its end. The nested `tile` remains the canonical physical tile and must
not be mutated.

The web layout will use `PlacedTile.left` and `PlacedTile.right`, rather than
the canonical values in `PlacedTile.tile`, to derive the visible halves.

## Layout and Rendering

`layoutDominoChain` will remain responsible for responsive placement and will
also return the values in their visual order. It will determine, for each
non-double tile, whether logical chain order runs left-to-right,
right-to-left, top-to-bottom, or bottom-to-top at that position.

The opening tile remains centered. The left branch initially grows left and
turns upward; the right branch initially grows right and turns downward.
Whenever a branch reverses horizontal direction, the visual halves reverse as
well. A vertical turn displays the incoming value on the side touching the
previous tile and the outgoing value on the side leading to the next tile.
Doubles retain equal values and stay perpendicular to the local direction of
travel.

`DominoTile` will continue to render a simple horizontal or vertical tile. The
board will pass it the layout's visually ordered values while retaining the
original tile identifier for accessibility and React keys.

## Data and Compatibility

No API, persistence, game-engine, or contract schema changes are required.
Existing `moveNumber` values continue to identify the opening tile and the
order in which both branches were formed.

## Testing

Unit tests for the layout will assert:

- adjoining values match on a straight row;
- the left and right branches orient correctly around move zero;
- values reverse on alternate rows of the snake;
- vertical turns follow their direction of travel;
- doubles remain perpendicular without breaking the adjacent values.

Component tests will verify that the board renders the visual values produced
by the layout. The full typecheck/unit suite and Playwright E2E suite will run
after implementation, followed by a Chrome gameplay screenshot.
