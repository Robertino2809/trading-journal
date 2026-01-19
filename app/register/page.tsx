"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigError } from "@/lib/supabase";

const emailRedirectTo = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) {
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/");
      }
    };

    void checkSession();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    if (!emailRedirectTo) {
      setError("Missing NEXT_PUBLIC_SITE_URL.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNotice(
        "Check your email to verify your account, then sign in once confirmed.",
      );
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Trading Journal</h1>
        <p className="mt-2 text-sm text-slate-400">
          Create your account to start tracking trades.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-200"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {notice}
            </div>
          ) : null}

          {supabaseConfigError ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {supabaseConfigError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || Boolean(supabaseConfigError)}
            className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Already have an account?{" "}
          <Link
            className="font-semibold text-indigo-300 hover:text-indigo-200"
            href="/login"
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}