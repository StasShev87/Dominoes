# Adaptive Domino Chain Design

## Goal

Make the game board resemble a real domino table. Tiles use authentic pip layouts and subtle depth, while the played chain grows from its first tile in two responsive serpentine branches.

## Tile appearance

- Each half uses a fixed 3 by 3 pip grid. Values zero through six occupy the conventional domino positions.
- Pips are black and visually inset into an ivory tile face.
- Each tile has a thin edge, a center divider, softly rounded corners, and a small shadow below it.
- Player-hand tiles retain their interactive hover and focus behavior.

## Chain geometry

- The first played tile is horizontal and its center remains aligned with the horizontal center of the board.
- The beginning of the chain grows left from the first tile. The end grows right.
- The left branch turns upward after reaching the left boundary, then snakes between boundaries.
- The right branch turns downward after reaching the right boundary, then snakes between boundaries.
- A non-double tile lies along the current direction of travel. A double lies perpendicular to that direction.
- Adjacent tiles meet edge-to-edge. Turning segments reserve enough space for a perpendicular connector without overlap.
- Placement uses the server-provided chain order; no game rules or command payloads change.

## Responsive layout

- The board measures its usable width with `ResizeObserver` and derives how many tile lengths fit before a turn.
- Layout coordinates are recomputed when the chain or measured width changes, including mobile viewport changes.
- The complete chain is vertically centered in the board while it fits within the board's minimum height.
- If the chain is taller than the minimum board, the board expands to contain it. Normal page scrolling provides vertical access; the chain itself is not clipped.
- A deterministic fallback width is used during initial render and tests before an observer measurement is available.

## Controls and localization

- Russian `LEFT` placement text changes from “Положить слева” to “Положить в начало”.
- Russian `RIGHT` placement text changes from “Положить справа” to “Положить в конец”.
- Equivalent English labels describe beginning and end so both locales use the same chain semantics.

## Component boundaries

- `DominoTile` renders a tile face and accepts its board orientation without knowing chain geometry.
- A pure layout helper converts ordered placed tiles plus available board width into coordinates, orientation, and board bounds.
- `GameBoard` observes the board width, invokes the layout helper, and renders positioned board tiles.
- CSS owns physical appearance, transitions, and responsive board presentation.

## Accessibility

- Existing accessible tile labels and native buttons remain intact.
- Visual orientation and pip placement are decorative and do not replace accessible names.
- Motion is limited to existing interaction feedback; responsive relayout does not require animation.

## Verification

- Unit tests cover conventional pip positions for values zero through six.
- Unit tests cover the centered first tile, left/up and right/down turns, alternating snake rows, double orientation, and narrow widths.
- Component tests cover localized beginning/end controls and rendered layout metadata.
- The existing complete test suite, build checks, and Playwright E2E suite must pass.
- The completed active game is inspected and captured in the user's real Chrome browser at desktop size; a narrower viewport is also checked for responsive reflow.

## Out of scope

- Game-engine rules, chain legality, scoring, networking, and persistence do not change.
- The layout does not allow manual panning, zooming, or tile dragging.
