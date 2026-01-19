import { createClient } from "@supabase/supabase-js";
import {
  getAuthCookieName,
  getSupabaseConfig,
  hasValidSupabaseConfig,
} from "@/lib/supabase-helpers";

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
const authCookieName = getAuthCookieName();

const cookieStorage = {
  getItem: (key: string) => {
    if (typeof document === "undefined") {
      return null;
    }

if (!authCookieName || key !== authCookieName) {
      return null;
    }

    const cookies = document.cookie.split("; ").filter(Boolean);
    const match = cookies.find(cookie => cookie.startsWith(`${authCookieName}=`));
    if (!match) {
      return null;
    }

    return decodeURIComponent(match.split("=").slice(1).join("="));
  },
  setItem: (key: string, value: string) => {
    if (typeof document === "undefined") {
      return;
    }

    if (!authCookieName || key !== authCookieName) {
      return;
    }

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${authCookieName}=${encodeURIComponent(
      value,
    )}; Path=/; SameSite=Lax; Max-Age=31536000${secure}`;
  },
  removeItem: (key: string) => {
    if (typeof document === "undefined") {
      return;
    }

    if (!authCookieName || key !== authCookieName) {
      return;
    }

    document.cookie = `${authCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
  },
};

export const supabaseConfigError = hasValidSupabaseConfig
  ? null
  : "Missing or invalid Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export const supabase = hasValidSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: cookieStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
