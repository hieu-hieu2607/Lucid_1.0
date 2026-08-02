import { getVnstock } from "./vnstock-client";
import { computeScoreFromHistory, pctChange, trimUnclosedBar, withRetry } from "./analyze";

export interface BacktestPoint {
  date: string;
  score: number;
  forwardReturnPct: number; // % thay đổi giá sau `forwardDays` phiên kể từ mốc này
}

export interface BacktestBucket {
  range: string;
  count: number;
  avgForwardReturnPct: number;
  winRatePct: number; // % số điểm có forward return dương
}

export interface BacktestResult {
  ticker: string;
  forwardDays: number;
  sampleCount: number;
  buckets: BacktestBucket[];
  correlation: number | null; // Pearson giữa score và forward return — điểm cao có thực sự đi kèm return cao hơn không
  points: BacktestPoint[];
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : null;
}

/**
 * Backtest chấm điểm lịch sử cho MỘT mã: tại mỗi mốc thời gian trong quá khứ,
 * chỉ dùng dữ liệu tính ĐẾN mốc đó (không "nhìn trước tương lai") để chấm điểm
 * bằng đúng logic đang chạy live (computeScoreFromHistory), rồi so với giá
 * thực tế `forwardDays` phiên sau đó. Nếu điểm cao thực sự đi kèm return
 * trung bình cao hơn và tỷ lệ thắng cao hơn, trọng số hiện tại có cơ sở; nếu
 * không, cần xem lại trọng số.
 *
 * Chỉ chạy cho 1 mã/lần và lấy dữ liệu 1 lần duy nhất (không gọi mạng lặp lại
 * cho từng mốc) để tránh vượt giới hạn thời gian của serverless function.
 */
export async function runBacktest(
  ticker: string,
  options: { forwardDays?: number; stepDays?: number; lookbackDays?: number } = {}
): Promise<BacktestResult | null> {
  const forwardDays = options.forwardDays ?? 5;
  const stepDays = options.stepDays ?? 5;
  const lookbackCalendarDays = options.lookbackDays ?? 500;

  const fns = await getVnstock();
  const start = new Date();
  start.setDate(start.getDate() - lookbackCalendarDays);
  const startStr = start.toISOString().slice(0, 10);

  let history = await withRetry(() => fns.stock.quote({ ticker, start: startStr }));
  history = trimUnclosedBar(history);
  if (!history || history.length < 120) return null;

  let vni = await withRetry(() => fns.stock.quote({ ticker: "VNINDEX", start: startStr }));
  vni = trimUnclosedBar(vni);

  // Map ngày -> giá đóng cửa VNINDEX, để tính sức mạnh tương đối tại từng mốc
  const vniByDate = new Map<string, number>();
  for (const bar of vni ?? []) {
    vniByDate.set(String(bar.date).slice(0, 10), bar.close);
  }
  function vniChg5dAt(cutoff: number): number | null {
    if (!vni || vni.length === 0) return null;
    const targetDate = String(history[cutoff].date).slice(0, 10);
    const vniIdx = vni.findIndex((b) => String(b.date).slice(0, 10) === targetDate);
    if (vniIdx < 6) return null;
    return pctChange(vni[vniIdx - 5].close, vni[vniIdx].close);
  }

  const points: BacktestPoint[] = [];
  const minStart = 90; // đủ dữ liệu để SMA50/ADX/divergence ổn định
  const maxCutoff = history.length - forwardDays - 1;

  for (let cutoff = minStart; cutoff <= maxCutoff; cutoff += stepDays) {
    const slice = history.slice(0, cutoff + 1);
    const result = computeScoreFromHistory(ticker, slice, vniChg5dAt(cutoff), null, fns);
    if (!result) continue;

    const priceAtCutoff = history[cutoff].close;
    const priceForward = history[cutoff + forwardDays].close;
    const forwardReturnPct = pctChange(priceAtCutoff, priceForward);

    points.push({
      date: String(history[cutoff].date).slice(0, 10),
      score: result.score,
      forwardReturnPct,
    });
  }

  if (points.length < 5) return null;

  const bucketRanges: [number, number, string][] = [
    [0, 40, "0-40 (yếu)"],
    [40, 60, "40-60 (trung tính)"],
    [60, 80, "60-80 (khá)"],
    [80, 101, "80-100 (mạnh)"],
  ];
  const buckets: BacktestBucket[] = bucketRanges.map(([lo, hi, range]) => {
    const inBucket = points.filter((p) => p.score >= lo && p.score < hi);
    const count = inBucket.length;
    const avg =
      count > 0 ? inBucket.reduce((s, p) => s + p.forwardReturnPct, 0) / count : 0;
    const winRate =
      count > 0 ? (inBucket.filter((p) => p.forwardReturnPct > 0).length / count) * 100 : 0;
    return { range, count, avgForwardReturnPct: avg, winRatePct: winRate };
  });

  const correlation = pearsonCorrelation(
    points.map((p) => p.score),
    points.map((p) => p.forwardReturnPct)
  );

  return {
    ticker,
    forwardDays,
    sampleCount: points.length,
    buckets,
    correlation,
    points,
  };
}
