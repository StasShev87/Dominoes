import { ProfilePanel } from "../../../components/profile-panel.js";

export default async function ProfilePage({ params }: { readonly params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <main className="auth-page"><ProfilePanel locale={locale} /></main>;
}
