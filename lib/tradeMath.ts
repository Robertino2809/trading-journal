export function calculatePnL({
  mode,
  direction,
  entry,
  close,
  margin,
  leverage,
}: {
  mode: "SPOT" | "FUTURES";
  direction: "LONG" | "SHORT";
  entry: number;
  close: number;
  margin: number;
  leverage: number;
}) {
  const positionSize =
    mode === "SPOT" ? margin : margin * leverage;

  const pnl =
    direction === "LONG"
      ? ((close - entry) / entry) * positionSize
      : ((entry - close) / entry) * positionSize;

  const pnlPercent = (pnl / margin) * 100;

  return {
    pnl: Number(pnl.toFixed(2)),
    pnlPercent: Number(pnlPercent.toFixed(2)),
  };
}
