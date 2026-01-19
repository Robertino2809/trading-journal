export type TradeMode = "SPOT" | "FUTURES";
export type TradeDirection = "LONG" | "SHORT";
export type TradeStatus = "OPEN" | "CLOSED_EARLY" | "STOP_LOSS" | "TAKE_PROFIT";

export type Trade = {
  id: string;
  user_id: string;
  mode: TradeMode;
  pair: string;
  direction: TradeDirection | null;
  leverage: number | null;
  margin: number;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  close_price: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  status: TradeStatus;
  created_at: string;
  closed_at: string | null;
};