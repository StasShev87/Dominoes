import { GuestJoin } from "../../../../components/guest-join.js";

export default async function InvitePage({ params }: { readonly params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  return <GuestJoin token={token} locale={locale} />;
}

