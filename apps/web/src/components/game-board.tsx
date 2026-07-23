"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerView, PublicGameCommand } from "@dominoes/contracts";
import { DominoTile } from "./domino-tile.js";
import { getMessages } from "../lib/i18n.js";
import { layoutDominoChain } from "./domino-chain-layout.js";

interface GameBoardProps {
  readonly view: PlayerView;
  readonly onCommand: (command: PublicGameCommand) => void;
  readonly busy?: boolean;
  readonly locale?: string;
}

export function GameBoard({ view, onCommand, busy = false, locale = "en" }: GameBoardProps) {
  const t = getMessages(locale).game;
  const [pendingTile, setPendingTile] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(900);
  const boardRef = useRef<HTMLDivElement>(null);
  const opponent = view.seats.find(({ seat }) => seat !== view.seat);
  const selectedAction = view.legalActions.find((action) => action.type === "PLAY_TILE" && action.tileId === pendingTile);
  const chainLayout = useMemo(() => layoutDominoChain(view.chain, boardWidth), [view.chain, boardWidth]);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const updateWidth = (width: number) => {
      if (width > 0) setBoardWidth(Math.round(width));
    };
    updateWidth(board.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => updateWidth(entry?.contentRect.width ?? 0));
    observer.observe(board);
    return () => observer.disconnect();
  }, []);
  const selectTile = (tileId: string) => {
    const action = view.legalActions.find((candidate) => candidate.type === "PLAY_TILE" && candidate.tileId === tileId);
    if (!action || action.type !== "PLAY_TILE") return;
    if (action.sides.length === 1) return onCommand({ type: "PLAY_TILE", tileId, side: action.sides[0]! });
    setPendingTile(tileId);
  };

  return (
    <main className="game-shell">
      {view.status === "FINISHED" && <div className="result-banner" role="status"><strong>{view.winnerSeat === view.seat ? t.won : t.lost}</strong><a href={`/${locale}`}>{t.playAgain}</a></div>}
      <header className="score-bar" aria-label={t.score}>
        <div><span>{t.you}</span><strong>{view.scores[view.seat] ?? 0}</strong></div>
        <p>{t.round} {view.roundNumber} · {t.firstTo} {view.targetScore}</p>
        <div><span>{t.opponent}</span><strong>{view.scores[opponent?.seat ?? 0] ?? 0}</strong></div>
      </header>
      <section className="opponent-zone" aria-label={t.opponentHand}>
        <div className="opponent-tiles" aria-hidden="true">{Array.from({ length: Math.min(opponent?.tileCount ?? 0, 10) }, (_, index) => <span className="tile-back" key={index} />)}</div>
        <p>{t.opponent} · {opponent?.tileCount ?? 0} {t.tiles}</p>
      </section>
      <section className="board-zone" aria-label={t.chain}>
        <div className="chain-scroll" ref={boardRef}>{view.chain.length ? <div className="chain-layout" style={{ height: chainLayout.height }}>
          {chainLayout.tiles.map((placed) => <div
            className="chain-tile"
            data-move-number={placed.tile.moveNumber}
            data-origin={placed.tile.moveNumber === 0 ? "true" : undefined}
            key={placed.tile.moveNumber}
            style={{ width: placed.width, height: placed.height, transform: `translate(${placed.x}px, ${placed.y}px)` }}
          ><DominoTile tile={placed.visualTile} compact orientation={placed.orientation} /></div>)}
        </div> : <p className="empty-board">{t.opening}</p>}</div>
        <div className="table-meta"><span>{t.boneyard} · {view.boneyardCount}</span><span>{view.currentSeat === view.seat ? t.yourTurn : t.thinking}</span></div>
      </section>
      <section className="hand-zone" aria-label={t.hand}>
        {selectedAction?.type === "PLAY_TILE" && <div className="side-picker" role="group" aria-label={t.chooseSide}>
          {selectedAction.sides.map((side) => <button type="button" key={side} onClick={() => onCommand({ type: "PLAY_TILE", tileId: selectedAction.tileId, side })}>{side === "LEFT" ? t.playLeft : t.playRight}</button>)}
          <button type="button" className="quiet" onClick={() => setPendingTile(null)}>{t.cancel}</button>
        </div>}
        <div className="hand-scroll">{view.hand.map((tile) => <DominoTile key={tile.id} tile={tile} selectable={view.legalActions.some((action) => action.type === "PLAY_TILE" && action.tileId === tile.id) && !busy} onSelect={selectTile} />)}</div>
        <div className="turn-actions">
          {view.legalActions.some(({ type }) => type === "DRAW_TILE") && <button type="button" disabled={busy} onClick={() => onCommand({ type: "DRAW_TILE" })}>{t.draw}</button>}
          {view.legalActions.some(({ type }) => type === "PASS") && <button type="button" disabled={busy} onClick={() => onCommand({ type: "PASS" })}>{t.pass}</button>}
          {view.legalActions.some(({ type }) => type === "CLAIM_FORFEIT") && <button type="button" disabled={busy} onClick={() => onCommand({ type: "CLAIM_FORFEIT" })}>{t.claimForfeit}</button>}
        </div>
      </section>
    </main>
  );
}
