import { notFound } from "next/navigation";
import { LobbyActions } from "../../components/lobby-actions.js";
import { getMessages, isLocale } from "../../lib/i18n.js";

export default async function HomePage({ params }: { readonly params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  return (
    <main className="home-page">
      <nav className="top-nav">
        <a className="brand" href={`/${locale}`}><span className="brand-mark">D</span>Dominoes</a>
        <div className="nav-actions"><a href={`/${locale}#rules`}>{t.home.howToPlay}</a><a className="avatar" aria-label={t.home.profile} href={`/${locale}/profile`}>S</a></div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{t.home.eyebrow}</span>
          <h1>{t.home.title}<br/><em>{t.home.titleAccent}</em></h1>
          <p>{t.home.intro}</p>
          <LobbyActions locale={locale} />
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring ring-one"/><div className="art-ring ring-two"/>
          <div className="floating-tile tile-a"><span>••••</span><span>••</span></div>
          <div className="floating-tile tile-b"><span>•</span><span>••••••</span></div>
          <div className="floating-tile tile-c"><span>•••</span><span>•••••</span></div>
        </div>
      </section>
      <section className="principles" id="rules">
        <article><span>01</span><h2>{t.home.draw}</h2><p>{t.home.drawText}</p></article>
        <article><span>02</span><h2>{t.home.connect}</h2><p>{t.home.connectText}</p></article>
        <article><span>03</span><h2>{t.home.win}</h2><p>{t.home.winText}</p></article>
      </section>
    </main>
  );
}
