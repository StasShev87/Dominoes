import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PasswordCredentials =
  | { readonly email: string; readonly password: string }
  | { readonly phone: string; readonly password: string };

let browserClient: SupabaseClient | undefined;

export function passwordCredentials(identifier: string, password: string): PasswordCredentials {
  const value = identifier.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { email: value.toLowerCase(), password };
  }
  const phone = value.replace(/[\s()-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(phone)) {
    return { phone, password };
  }
  throw new Error("INVALID_IDENTIFIER");
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  browserClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return browserClient;
}

export async function getAccessToken(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

