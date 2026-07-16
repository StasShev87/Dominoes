import { AuthForm } from "../../../components/auth-form.js";

export default async function AuthPage({ params }: { readonly params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <main className="auth-page"><AuthForm locale={locale} /></main>;
}
