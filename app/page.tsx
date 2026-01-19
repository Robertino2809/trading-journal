"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { calculatePnl } from "@/lib/pnl";
import type { Trade, TradeDirection, TradeMode, TradeStatus } from "@/lib/trade-types";

const parseNumber = (value: string): number | null => {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function HomePage() {
  const router = useRouter();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);

  const [pair, setPair] = useState("");
  const [mode, setMode] = useState<TradeMode>("SPOT");
  const [direction, setDirection] = useState<TradeDirection>("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [closePriceOverrides, setClosePriceOverrides] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const initSession = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      setSessionEmail(session.user.email ?? null);
      setUserId(session.user.id);
      setLoading(false);
    };

    void initSession();

    if (!supabase) {
      return () => undefined;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!newSession) {
          router.replace("/login");
          return;
        }
        setSessionEmail(newSession.user.email ?? null);
        setUserId(newSession.user.id);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const loadTrades = useCallback(async () => {
    if (!userId) {
      return;
    }

    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return;
    }

    setTrades(data ?? []);
  }, [userId]);

  useEffect(() => {
    void loadTrades();
  }, [loadTrades]);

  const stopLossMetrics = useMemo(() => {
    return calculatePnl({
      mode,
      direction: mode === "FUTURES" ? direction : null,
      entryPrice: parseNumber(entryPrice),
      exitPrice: parseNumber(stopLoss),
      margin: parseNumber(margin),
      leverage: parseNumber(leverage),
    });
  }, [direction, entryPrice, leverage, margin, mode, stopLoss]);

  const takeProfitMetrics = useMemo(() => {
    return calculatePnl({
      mode,
      direction: mode === "FUTURES" ? direction : null,
      entryPrice: parseNumber(entryPrice),
      exitPrice: parseNumber(takeProfit),
      margin: parseNumber(margin),
      leverage: parseNumber(leverage),
    });
  }, [direction, entryPrice, leverage, margin, mode, takeProfit]);

  const handleLogout = async () => {
    if (!supabase) {
      router.replace("/login");
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const resetForm = () => {
    setPair("");
    setMode("SPOT");
    setDirection("LONG");
    setEntryPrice("");
    setStopLoss("");
    setTakeProfit("");
    setMargin("");
    setLeverage("");
  };

  const handleOpenTrade = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!userId) {
      setFormError("You must be logged in to create a trade.");
      return;
    }

    if (!supabase) {
      setFormError("Supabase is not configured.");
      return;
    }

    const entry = parseNumber(entryPrice);
    const stop = parseNumber(stopLoss);
    const take = parseNumber(takeProfit);
    const marginValue = parseNumber(margin);
    const leverageValue = parseNumber(leverage);

    if (!pair || !entry || !marginValue) {
      setFormError("Please fill out pair, entry price, and margin.");
      return;
    }

    setFormLoading(true);

    const { error } = await supabase.from("trades").insert({
      user_id: userId,
      mode,
      pair: pair.toUpperCase(),
      direction: mode === "FUTURES" ? direction : null,
      leverage: mode === "FUTURES" ? leverageValue ?? 1 : null,
      margin: marginValue,
      entry_price: entry,
      stop_loss: stop,
      take_profit: take,
      status: "OPEN" satisfies TradeStatus,
    });

    if (error) {
      setFormError(error.message);
      setFormLoading(false);
      return;
    }

    resetForm();
    setFormLoading(false);
    void loadTrades();
  };

  const handleCloseTrade = async (
    trade: Trade,
    status: TradeStatus,
    closeOverride?: number | null
  ) => {
    const resolvedClosePrice =
      status === "CLOSED_EARLY"
        ? closeOverride
        : status === "STOP_LOSS"
          ? trade.stop_loss
          : trade.take_profit;

    if (!resolvedClosePrice) {
      return;
    }

    if (!supabase) {
      return;
    }

    const calculated = calculatePnl({
      mode: trade.mode,
      direction: trade.direction,
      entryPrice: trade.entry_price,
      exitPrice: resolvedClosePrice,
      margin: trade.margin,
      leverage: trade.leverage,
    });

    if (!calculated) {
      return;
    }

    await supabase
      .from("trades")
      .update({
        status,
        close_price: resolvedClosePrice,
        pnl: calculated.pnl,
        pnl_percent: calculated.pnlPercent,
        closed_at: new Date().toISOString(),
      })
      .eq("id", trade.id);

    void loadTrades();
  };

  const openTrades = trades.filter(trade => trade.status === "OPEN");
  const closedTrades = trades.filter(trade => trade.status !== "OPEN");

  const stats = useMemo(() => {
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnl: 0,
        averageWin: 0,
        averageLoss: 0,
      };
    }

    const totalTrades = closedTrades.length;
    const totalPnl = closedTrades.reduce(
      (sum, trade) => sum + (trade.pnl ?? 0),
      0
    );
    const wins = closedTrades.filter(trade => (trade.pnl ?? 0) > 0);
    const losses = closedTrades.filter(trade => (trade.pnl ?? 0) < 0);
    const winRate = (wins.length / totalTrades) * 100;
    const averageWin =
      wins.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0) /
      (wins.length || 1);
    const averageLoss =
      losses.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0) /
      (losses.length || 1);

    return {
      totalTrades,
      winRate,
      totalPnl,
      averageWin,
      averageLoss,
    };
  }, [closedTrades]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading trading journal...</p>
      </div>
    );
  }

  if (supabaseConfigError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <h1 className="text-2xl font-semibold">Connect Supabase</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add your Supabase credentials to continue using the trading journal.
          </p>
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {supabaseConfigError}
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>• NEXT_PUBLIC_SUPABASE_URL</li>
            <li>• NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="mt-6 text-xs text-slate-500">
            Once configured, reload the page to sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Trading Journal</h1>
            <p className="text-sm text-slate-400">
              Track your open trades and review performance.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">
                {sessionEmail}
              </p>
              <p className="text-xs text-slate-500">Signed in</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Open a trade</h2>
            <p className="text-sm text-slate-400">
              Add a new trade and watch the PnL calculations update live.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleOpenTrade}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="pair">
                    Trading pair
                  </label>
                  <input
                    id="pair"
                    value={pair}
                    onChange={event => setPair(event.target.value)}
                    placeholder="BTCUSDT"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="mode">
                    Trade mode
                  </label>
                  <select
                    id="mode"
                    value={mode}
                    onChange={event =>
                      setMode(event.target.value as TradeMode)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="SPOT">SPOT</option>
                    <option value="FUTURES">FUTURES</option>
                  </select>
                </div>

                {mode === "FUTURES" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="direction">
                      Direction
                    </label>
                    <select
                      id="direction"
                      value={direction}
                      onChange={event =>
                        setDirection(event.target.value as TradeDirection)
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    >
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="entry">
                    Entry price
                  </label>
                  <input
                    id="entry"
                    value={entryPrice}
                    onChange={event => setEntryPrice(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="stop-loss">
                    Stop loss
                  </label>
                  <input
                    id="stop-loss"
                    value={stopLoss}
                    onChange={event => setStopLoss(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="take-profit">
                    Take profit
                  </label>
                  <input
                    id="take-profit"
                    value={takeProfit}
                    onChange={event => setTakeProfit(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="margin">
                    Margin / invested amount
                  </label>
                  <input
                    id="margin"
                    value={margin}
                    onChange={event => setMargin(event.target.value)}
                    placeholder="1000"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    required
                  />
                </div>

                {mode === "FUTURES" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="leverage">
                      Leverage
                    </label>
                    <input
                      id="leverage"
                      value={leverage}
                      onChange={event => setLeverage(event.target.value)}
                      placeholder="10"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Stop loss PnL
                  </p>
                  <p className="mt-2 text-lg font-semibold text-rose-300">
                    {stopLossMetrics
                      ? `${stopLossMetrics.pnl.toFixed(2)} USD`
                      : "--"}
                  </p>
                  <p className="text-sm text-slate-400">
                    {stopLossMetrics
                      ? `${stopLossMetrics.pnlPercent.toFixed(2)}%`
                      : "Awaiting stop loss"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Take profit PnL
                  </p>
                  <p className="mt-2 text-lg font-semibold text-emerald-300">
                    {takeProfitMetrics
                      ? `${takeProfitMetrics.pnl.toFixed(2)} USD`
                      : "--"}
                  </p>
                  <p className="text-sm text-slate-400">
                    {takeProfitMetrics
                      ? `${takeProfitMetrics.pnlPercent.toFixed(2)}%`
                      : "Awaiting take profit"}
                  </p>
                </div>
              </div>

              {formError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {formError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={formLoading}
                className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formLoading ? "Saving trade..." : "Open trade"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Statistics</h2>
            <p className="text-sm text-slate-400">
              Performance overview for closed trades.
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total trades
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.totalTrades}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Win rate
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total PnL
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.totalPnl.toFixed(2)} USD
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Average win
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  {stats.averageWin.toFixed(2)} USD
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Average loss
                </p>
                <p className="mt-2 text-2xl font-semibold text-rose-300">
                  {stats.averageLoss.toFixed(2)} USD
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Open trades</h2>
            <p className="text-sm text-slate-400">
              Close trades early, or mark stop loss and take profit hits.
            </p>
            <div className="mt-6 space-y-4">
              {openTrades.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No open trades yet.
                </p>
              ) : (
                openTrades.map(trade => {
                  const closeOverride = closePriceOverrides[trade.id] ?? "";
                  return (
                    <div
                      key={trade.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">
                            {trade.pair} · {trade.mode}
                            {trade.direction ? ` · ${trade.direction}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            Entry: {trade.entry_price} · Margin: {trade.margin}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          OPEN
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          value={closeOverride}
                          onChange={event =>
                            setClosePriceOverrides(prev => ({
                              ...prev,
                              [trade.id]: event.target.value,
                            }))
                          }
                          placeholder="Close price"
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                        />
                        <button
                          onClick={() =>
                            handleCloseTrade(
                              trade,
                              "CLOSED_EARLY",
                              parseNumber(closeOverride)
                            )
                          }
                          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
                        >
                          Close early
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <button
                          onClick={() => handleCloseTrade(trade, "STOP_LOSS")}
                          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-semibold text-rose-200"
                        >
                          Hit stop loss
                        </button>
                        <button
                          onClick={() => handleCloseTrade(trade, "TAKE_PROFIT")}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-200"
                        >
                          Hit take profit
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Closed trades</h2>
            <p className="text-sm text-slate-400">
              Review your performance and final PnL numbers.
            </p>
            <div className="mt-6 space-y-4">
              {closedTrades.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No closed trades yet.
                </p>
              ) : (
                closedTrades.map(trade => (
                  <div
                    key={trade.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          {trade.pair} · {trade.mode}
                          {trade.direction ? ` · ${trade.direction}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          Entry: {trade.entry_price} · Close: {trade.close_price}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                        {trade.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span
                        className={`font-semibold ${
                          (trade.pnl ?? 0) >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }`}
                      >
                        {(trade.pnl ?? 0).toFixed(2)} USD
                      </span>
                      <span className="text-xs text-slate-400">
                        {(trade.pnl_percent ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}