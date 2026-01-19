import type { TradeDirection, TradeMode } from "@/lib/trade-types";

type PnlInput = {
  mode: TradeMode;
  direction: TradeDirection | null;
  entryPrice: number | null;
  exitPrice: number | null;
  margin: number | null;
  leverage: number | null;
};

type PnlResult = {
  pnl: number;
  pnlPercent: number;
};

export const calculatePnl = ({
  mode,
  direction,
  entryPrice,
  exitPrice,
  margin,
  leverage,
}: PnlInput): PnlResult | null => {
  if (!entryPrice || !exitPrice || !margin) {
    return null;
  }

  const effectiveLeverage = mode === "FUTURES" ? leverage ?? 1 : 1;
  const positionSize = margin * effectiveLeverage;
  const isShort = mode === "FUTURES" && direction === "SHORT";

  const priceChangeRatio = isShort
    ? (entryPrice - exitPrice) / entryPrice
    : (exitPrice - entryPrice) / entryPrice;

  const pnl = positionSize * priceChangeRatio;
  const pnlPercent = (pnl / margin) * 100;

  return {
    pnl,
    pnlPercent,
  };
};