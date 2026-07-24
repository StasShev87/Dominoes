# Domino Turn Geometry Design

## Goal

Make every snake turn use one non-double corner tile, align each horizontal
row with the half of that corner tile it touches, and preserve valid pip
connections across both branches and repeated turns.

## Root Cause

The current incremental layout turns the tile that first overflows the board.
It does not reconsider tiles already placed on that row. If the overflow tile
is a double, its perpendicular orientation can create two adjacent vertical
tiles instead of moving the corner backward to a non-double.

After a turn, the next horizontal tile inherits the corner tile's `centerY`.
That aligns the new row with the divider in the middle of the vertical tile,
not with the center of its outgoing half.

## Layout Design

Each branch remains independent and grows outward from move zero. While laying
out a horizontal row, the algorithm keeps the row's placed indices. When the
next tile would cross the horizontal padding:

1. Scan backward within the current row for the nearest non-double tile.
2. Remove that tile and every later tile in the row from the provisional
   positions.
3. Reposition the selected tile vertically at the boundary as the sole corner.
4. Reflow every removed later tile, followed by the overflow tile, on the next
   horizontal row in the opposite horizontal direction.

The prior row's center passes through the incoming half-center of the vertical
corner. The next row's center passes through its outgoing half-center. Those
half-centers are `corner.centerY - corner.height / 4` and
`corner.centerY + corner.height / 4`, ordered by the branch's vertical travel.
The corner is positioned so the prior row keeps its existing center while the
next row receives the correct half-center.

Left-branch turns continue upward and right-branch turns continue downward.
The same backtracking and half-alignment rule applies at every later turn.
Logical `PlacedTile.left/right` ordering remains the source for visible pips.

## Compatibility

The change is confined to the web layout and its tests. It does not change the
game engine, API, persistence, contracts, or domino rendering component.
Opening-tile orientation and responsive recentering remain unchanged.

## Automated and Visual Verification

Unit tests will cover:

- a normal turn on the penultimate non-double tile;
- backtracking across a double to the nearest previous non-double;
- exact incoming/outgoing half-center row alignment;
- both branches and repeated turns;
- matching visible pip values across every connection.

Playwright will load the real game page with deterministic synthetic
`PlayerView` responses intercepted only inside the test. WebSocket traffic
will be neutralized in the test so production code and APIs need no fixture
route. It will save five separate screenshots:

- `artifacts/domino-turn-penultimate.png`;
- `artifacts/domino-turn-through-double.png`;
- `artifacts/domino-turn-half-alignment.png`;
- `artifacts/domino-turn-both-branches.png`;
- `artifacts/domino-turn-matching-pips.png`.

The screenshots will capture the board region at a fixed narrow viewport so
the relevant turns are clearly visible and reproducible.
