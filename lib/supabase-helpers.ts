const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const projectRef = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] ?? "";

export const hasValidSupabaseConfig =
  supabaseUrl.startsWith("http") && supabaseAnonKey.length > 0;

export const getSupabaseConfig = () => ({
  supabaseUrl,
  supabaseAnonKey,
});

export const getAuthCookieName = () => {
  if (!projectRef) {
    return null;
  }

  return `sb-${projectRef}-auth-token`;
};