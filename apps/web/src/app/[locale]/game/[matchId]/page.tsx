import { GameSession } from "../../../../components/game-session.js";

export default async function GamePage({ params }: { readonly params: Promise<{ locale: string; matchId: string }> }) {
  const { locale, matchId } = await params;
  return <GameSession matchId={matchId} locale={locale} />;
}
