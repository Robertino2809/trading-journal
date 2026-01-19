import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthCookieName, getSupabaseConfig } from "@/lib/supabase-helpers";

const authCookieName = getAuthCookieName();

const buildRedirectUrl = (requestUrl: string, next?: string | null) => {
  const safeNext = next?.startsWith("/") ? next : "/";
  return new URL(safeNext, requestUrl);
};

export async function GET(request: Request) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey || !authCookieName) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "/login"));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "/login"));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "/login"));
  }

  const response = NextResponse.redirect(buildRedirectUrl(request.url, next));
  response.cookies.set(authCookieName, JSON.stringify(data.session), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: data.session.expires_in ?? undefined,
  });

  return response;
}