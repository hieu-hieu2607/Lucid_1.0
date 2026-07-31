"use client";

import { useEffect, useState } from "react";

interface MarketBreadth {
  trend: "bull" | "bear" | "neutral";
  chg1d: number;
  chg5d: number;
  adjustment: number;
}

interface ShortTermResult {
  ticker: string;
  score: number;
  lastClose: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  macdRising: boolean | null;
  sma20: number | null;
  sma50: number | null;
  priceVsSma20Pct: number | null;
  trendAligned: boolean | null;
  superTrend: "bullish" | "bearish" | null;
  bollingerPercentB: number | null;
  atrPercent: number | null;
  adx: number | null;
  adxBullish: boolean | null;
  volumeRatio: number | null;
  priceChange5d: number | null;
  foreignNetRatio: number | null;
  relativeStrength5d: number | null;
  rsiBullDiv: boolean;
  rsiBearDiv: boolean;
  macdBullDiv: boolean;
  macdBearDiv: boolean;
  stopLoss: number | null;
  target1: number | null;
  riskReward: number | null;
  reason: string;
}

interface AnalysisResponse {
  generatedAt: string;
  marketBreadth: MarketBreadth | null;
  shortTerm: { best: ShortTermResult | null; ranked: ShortTermResult[] };
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function divergenceLabel(row: ShortTermResult): { text: string; color?: string } {
  const bull = row.rsiBullDiv || row.macdBullDiv;
  const bear = row.rsiBearDiv || row.macdBearDiv;
  if (bull && bear) return { text: "Hỗn hợp" };
  if (bull) return { text: "Tăng ↑", color: ACCENT };
  if (bear) return { text: "Giảm ↓", color: DOWN };
  return { text: "—" };
}

const ACCENT = "#16C784";
const DOWN = "#EA3943";
const NEUTRAL = "#F0B90B";

export default function Home() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze");
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Server trả về dữ liệu không hợp lệ (status ${res.status}): ${text.slice(0, 200)}`
        );
      }
      if (!res.ok) throw new Error(json.error ?? "Lỗi tải dữ liệu");
      setData(json);
    } catch (e: any) {
      setError(e.message ?? "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const best = data?.shortTerm.best ?? null;
  const ranked = data?.shortTerm.ranked ?? [];
  const breadth = data?.marketBreadth ?? null;
  const bestDiv = best ? divergenceLabel(best) : null;

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-[#1F252E] px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-xl font-bold tracking-tight">
            Song Kiếm
          </h1>
          <p className="text-sm text-[#7C8797] mt-0.5">
            Bảng chỉ báo kỹ thuật tổng hợp cho lướt sóng — xu hướng, động lượng, biến động, khối lượng, khối ngoại.
          </p>
          <p className="text-xs text-[#5A6270] mt-1 max-w-2xl">
            Đây là công cụ tổng hợp chỉ báo để bạn tự đánh giá, KHÔNG phải xếp hạng đã kiểm chứng có khả năng dự đoán —
            xem mục Backtest/Hồi quy bên dưới để biết mức độ tin cậy thực tế của điểm số.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-md border border-[#262C36] hover:border-[#3A4250] text-[#B7C0CC] disabled:opacity-50 transition-colors"
        >
          {loading ? "Đang quét…" : "Quét lại"}
        </button>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-3 text-sm text-[#F2A5A9]">
          {error}
        </div>
      )}

      {breadth && (
        <div
          className="mx-6 mt-4 rounded-md border px-4 py-2 text-xs flex items-center gap-2"
          style={{
            borderColor: `${breadth.trend === "bull" ? ACCENT : breadth.trend === "bear" ? DOWN : "#262C36"}40`,
            background: `${breadth.trend === "bull" ? ACCENT : breadth.trend === "bear" ? DOWN : "#262C36"}0D`,
            color: breadth.trend === "bull" ? ACCENT : breadth.trend === "bear" ? DOWN : "#9AA4B2",
          }}
        >
          <span className="font-[var(--font-mono)] font-semibold">
            VNINDEX {breadth.chg1d >= 0 ? "+" : ""}
            {fmt(breadth.chg1d)}%
          </span>
          <span className="text-[#7C8797]">
            {breadth.trend === "bull"
              ? `Thị trường tích cực — đã cộng ${breadth.adjustment} điểm cho toàn bộ watchlist`
              : breadth.trend === "bear"
              ? `Thị trường tiêu cực — đã trừ ${Math.abs(breadth.adjustment)} điểm cho toàn bộ watchlist`
              : "Thị trường trung tính — không điều chỉnh điểm"}
          </span>
        </div>
      )}

      <section className="p-6 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)]"
            style={{ color: ACCENT }}
          >
            LƯỚT SÓNG
          </span>
          <span className="text-xs text-[#5A6270]">
            Xu hướng (SMA/SuperTrend/ADX) · Động lượng (RSI/MACD + phân kỳ) · Biến động (Bollinger/ATR) · Khối lượng · Khối ngoại · VNINDEX
          </span>
        </div>

        {loading && !best && (
          <div className="text-sm text-[#5A6270] font-[var(--font-mono)] animate-pulse">
            Đang tải dữ liệu…
          </div>
        )}

        {best && (
          <div
            className="rounded-xl border p-5 flex flex-col gap-4"
            style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}0D` }}
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="text-3xl font-[var(--font-display)] font-bold">
                  {best.ticker}
                </div>
                <p className="text-sm text-[#9AA4B2] mt-1 max-w-2xl">{best.reason}</p>
              </div>
              <div className="text-right shrink-0">
                <div
                  className="text-4xl font-[var(--font-mono)] font-bold"
                  style={{ color: ACCENT }}
                >
                  {best.score}
                </div>
                <div className="text-xs text-[#5A6270]">điểm tổng hợp / 100 (tham khảo)</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Giá đóng cửa" value={best.lastClose ? `${fmt(best.lastClose)}k` : "—"} />
              <Stat
                label="Xu hướng SMA20/50"
                value={best.trendAligned === null ? "—" : best.trendAligned ? "Thuận" : "Chưa thuận"}
                color={best.trendAligned === true ? ACCENT : best.trendAligned === false ? DOWN : undefined}
              />
              <Stat
                label="SuperTrend"
                value={best.superTrend === "bullish" ? "Tăng" : best.superTrend === "bearish" ? "Giảm" : "—"}
                color={best.superTrend === "bullish" ? ACCENT : best.superTrend === "bearish" ? DOWN : undefined}
              />
              <Stat
                label="ADX (độ mạnh xu hướng)"
                value={best.adx !== null ? `${fmt(best.adx, 0)}${best.adxBullish ? " ↑" : best.adxBullish === false ? " ↓" : ""}` : "—"}
                color={best.adx !== null && best.adx > 25 ? (best.adxBullish ? ACCENT : DOWN) : undefined}
              />
              <Stat label="RSI (14)" value={fmt(best.rsi14)} />
              <Stat
                label="MACD hist."
                value={`${fmt(best.macdHistogram, 2)}${best.macdRising ? " ↑" : ""}`}
              />
              <Stat
                label="Phân kỳ"
                value={bestDiv!.text}
                color={bestDiv!.color}
              />
              <Stat label="Bollinger %B" value={fmt(best.bollingerPercentB, 2)} />
              <Stat label="ATR / giá" value={best.atrPercent !== null ? `${fmt(best.atrPercent)}%` : "—"} />
              <Stat label="KL / TB20" value={best.volumeRatio ? `${fmt(best.volumeRatio, 2)}x` : "—"} />
              <Stat
                label="Khối ngoại (ròng/tổng KL)"
                value={best.foreignNetRatio !== null ? `${best.foreignNetRatio >= 0 ? "+" : ""}${fmt(best.foreignNetRatio)}%` : "—"}
                color={best.foreignNetRatio !== null ? (best.foreignNetRatio > 3 ? ACCENT : best.foreignNetRatio < -3 ? DOWN : undefined) : undefined}
              />
              <Stat
                label="Sức mạnh vs VNINDEX"
                value={best.relativeStrength5d !== null ? `${best.relativeStrength5d >= 0 ? "+" : ""}${fmt(best.relativeStrength5d)}%` : "—"}
                color={best.relativeStrength5d !== null ? (best.relativeStrength5d > 1 ? ACCENT : best.relativeStrength5d < -1 ? DOWN : undefined) : undefined}
              />
              <Stat label="Δ giá 5 phiên" value={`${fmt(best.priceChange5d)}%`} />
              <Stat
                label="Stop-loss (tham khảo)"
                value={best.stopLoss ? `${fmt(best.stopLoss)}k` : "—"}
                color={DOWN}
              />
              <Stat
                label="Mục tiêu giá (tham khảo)"
                value={best.target1 ? `${fmt(best.target1)}k` : "—"}
                color={ACCENT}
              />
              <Stat
                label="Tỷ lệ Risk:Reward"
                value={best.riskReward !== null ? `1:${fmt(best.riskReward, 1)}` : "—"}
                color={best.riskReward !== null && best.riskReward >= 2 ? ACCENT : NEUTRAL}
              />
            </div>
          </div>
        )}

        {ranked.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Mã", "Giá", "Điểm", "RSI", "MACD", "Phân kỳ", "Xu hướng", "ADX", "%B", "ATR%", "KL/TB20", "Ngoại%", "RS 5p", "Δ 5 phiên", "R:R"].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, i) => {
                  const div = divergenceLabel(row);
                  return (
                    <tr key={row.ticker + i} className="border-b border-[#161B22] last:border-0">
                      <td className="px-3 py-2 text-[#E7EAEE] font-semibold">{row.ticker}</td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.lastClose ? `${fmt(row.lastClose)}k` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">{row.score}</td>
                      <td className="px-3 py-2 text-[#C4CBD4]">{fmt(row.rsi14)}</td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {fmt(row.macdHistogram, 2)}
                        {row.macdRising ? " ↑" : ""}
                      </td>
                      <td className="px-3 py-2" style={div.color ? { color: div.color } : undefined}>
                        {div.text}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{
                          color:
                            row.trendAligned === true
                              ? ACCENT
                              : row.trendAligned === false
                              ? DOWN
                              : "#C4CBD4",
                        }}
                      >
                        {row.trendAligned === null ? "—" : row.trendAligned ? "Thuận" : "Chưa thuận"}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.adx !== null ? fmt(row.adx, 0) : "—"}
                        {row.adxBullish ? " ↑" : row.adxBullish === false ? " ↓" : ""}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">{fmt(row.bollingerPercentB, 2)}</td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.atrPercent !== null ? `${fmt(row.atrPercent)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.volumeRatio ? `${fmt(row.volumeRatio, 2)}x` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.foreignNetRatio !== null ? `${row.foreignNetRatio >= 0 ? "+" : ""}${fmt(row.foreignNetRatio)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.relativeStrength5d !== null ? `${row.relativeStrength5d >= 0 ? "+" : ""}${fmt(row.relativeStrength5d)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">{fmt(row.priceChange5d)}%</td>
                      <td className="px-3 py-2 text-[#C4CBD4]">
                        {row.riskReward !== null ? `1:${fmt(row.riskReward, 1)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <BacktestPanel />
        <RegressionPanel />
      </section>

      <footer className="border-t border-[#1F252E] px-6 py-3 text-xs text-[#5A6270] flex items-center justify-between">
        <span>
          {data ? `Cập nhật lúc ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}` : ""}
        </span>
        <span>
          Tính trên các phiên đã đóng cửa — công cụ tham khảo, chưa qua kiểm chứng thống kê chắc chắn (xem Backtest/Hồi quy). Không phải khuyến nghị đầu tư.
        </span>
      </footer>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#5A6270]">{label}</div>
      <div className="font-[var(--font-mono)] text-sm mt-0.5" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

interface BacktestBucket {
  range: string;
  count: number;
  avgForwardReturnPct: number;
  winRatePct: number;
}

interface BacktestResult {
  ticker: string;
  forwardDays: number;
  sampleCount: number;
  buckets: BacktestBucket[];
  correlation: number | null;
}

function BacktestPanel() {
  const [ticker, setTicker] = useState("VNM");
  const [forwardDays, setForwardDays] = useState(5);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [btLoading, setBtLoading] = useState(false);

  async function runBacktest() {
    if (!ticker.trim()) return;
    setBtLoading(true);
    setBtError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/backtest?ticker=${encodeURIComponent(ticker.trim())}&forwardDays=${forwardDays}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lỗi backtest");
      setResult(json);
    } catch (e: any) {
      setBtError(e.message ?? "Có lỗi xảy ra");
    } finally {
      setBtLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#1F252E] p-5 flex flex-col gap-4">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)] text-[#B7C0CC]">
          BACKTEST (1 MÃ)
        </div>
        <p className="text-xs text-[#5A6270] mt-1 max-w-2xl">
          Kiểm chứng: điểm số ở quá khứ có thực sự đi kèm giá tăng tốt hơn N phiên sau đó không?
          Dùng đúng công thức chấm điểm đang chạy live, không nhìn thấy dữ liệu tương lai.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="VD: VNM"
          className="bg-black/30 border border-[#262C36] rounded-md px-3 py-1.5 text-sm font-[var(--font-mono)] w-28 focus:outline-none focus:border-[#3A4250]"
        />
        <div className="flex items-center gap-1 text-xs text-[#7C8797]">
          <span>Dự báo</span>
          {[5, 10, 20].map((d) => (
            <button
              key={d}
              onClick={() => setForwardDays(d)}
              className="px-2 py-1 rounded border font-[var(--font-mono)] transition-colors"
              style={{
                borderColor: forwardDays === d ? ACCENT : "#262C36",
                color: forwardDays === d ? ACCENT : "#7C8797",
              }}
            >
              {d}p
            </button>
          ))}
        </div>
        <button
          onClick={runBacktest}
          disabled={btLoading}
          className="text-sm px-3 py-1.5 rounded-md border border-[#262C36] hover:border-[#3A4250] text-[#B7C0CC] disabled:opacity-50 transition-colors"
        >
          {btLoading ? "Đang chạy…" : "Chạy backtest"}
        </button>
      </div>

      {btError && (
        <div className="rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-2 text-sm text-[#F2A5A9]">
          {btError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-[#9AA4B2]">
            {result.ticker} · {result.sampleCount} mốc thời gian · dự báo {result.forwardDays} phiên tới ·
            {" "}tương quan (Pearson) giữa điểm và return:{" "}
            <span className="font-[var(--font-mono)] font-semibold text-[#E7EAEE]">
              {result.correlation !== null ? result.correlation.toFixed(2) : "—"}
            </span>
            {result.correlation !== null && (
              <span className="text-[#5A6270]">
                {" "}
                ({result.correlation > 0.15
                  ? "có tương quan dương — điểm cao thường đi kèm return tốt hơn"
                  : result.correlation < -0.15
                  ? "tương quan ÂM — điểm cao lại đi kèm return kém hơn, nên xem lại trọng số"
                  : "gần như không có tương quan rõ ràng"}
                )
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Dải điểm", "Số mốc", "Return TB (%)", "Tỷ lệ thắng (%)"].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.buckets.map((b) => (
                  <tr key={b.range} className="border-b border-[#161B22] last:border-0">
                    <td className="px-3 py-2 text-[#E7EAEE]">{b.range}</td>
                    <td className="px-3 py-2 text-[#C4CBD4]">{b.count}</td>
                    <td
                      className="px-3 py-2"
                      style={{ color: b.avgForwardReturnPct >= 0 ? ACCENT : DOWN }}
                    >
                      {b.avgForwardReturnPct >= 0 ? "+" : ""}
                      {fmt(b.avgForwardReturnPct)}%
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">{fmt(b.winRatePct, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#5A6270]">
            Backtest dựa trên dữ liệu lịch sử của riêng mã này — không đảm bảo lặp lại trong tương lai, và không phải khuyến nghị đầu tư.
          </p>
        </div>
      )}
    </div>
  );
}

interface RegressionCoefficient {
  name: string;
  label: string;
  coef: number;
}

interface RegressionResult {
  tickers: string[];
  forwardDays: number;
  sampleCount: number;
  r2: number;
  coefficients: RegressionCoefficient[];
}

function RegressionPanel() {
  const [forwardDays, setForwardDays] = useState(5);
  const [result, setResult] = useState<RegressionResult | null>(null);
  const [rgError, setRgError] = useState<string | null>(null);
  const [rgLoading, setRgLoading] = useState(false);

  async function runRegression() {
    setRgLoading(true);
    setRgError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/regression?forwardDays=${forwardDays}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lỗi hồi quy");
      setResult(json);
    } catch (e: any) {
      setRgError(e.message ?? "Có lỗi xảy ra");
    } finally {
      setRgLoading(false);
    }
  }

  const nonIntercept = result?.coefficients.filter((c) => c.name !== "intercept") ?? [];
  const sorted = [...nonIntercept].sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));

  return (
    <div className="rounded-xl border border-[#1F252E] p-5 flex flex-col gap-4">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)] text-[#B7C0CC]">
          HỒI QUY TRỌNG SỐ (CẢ WATCHLIST)
        </div>
        <p className="text-xs text-[#5A6270] mt-1 max-w-2xl">
          Gộp dữ liệu backtest của toàn bộ watchlist, fit hồi quy tuyến tính để xem hướng chấm điểm
          nào (RSI, MACD, khối ngoại...) thực sự được dữ liệu ủng hộ. Hệ số dương = càng cao thì return
          càng tốt; hệ số âm = ngược lại. Đây là công cụ CHẨN ĐOÁN — không tự động áp vào công thức đang chạy live.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-[#7C8797]">
          <span>Dự báo</span>
          {[5, 10, 20].map((d) => (
            <button
              key={d}
              onClick={() => setForwardDays(d)}
              className="px-2 py-1 rounded border font-[var(--font-mono)] transition-colors"
              style={{
                borderColor: forwardDays === d ? NEUTRAL : "#262C36",
                color: forwardDays === d ? NEUTRAL : "#7C8797",
              }}
            >
              {d}p
            </button>
          ))}
        </div>
        <button
          onClick={runRegression}
          disabled={rgLoading}
          className="text-sm px-3 py-1.5 rounded-md border border-[#262C36] hover:border-[#3A4250] text-[#B7C0CC] disabled:opacity-50 transition-colors"
        >
          {rgLoading ? "Đang chạy (có thể mất 20-40s)…" : "Chạy hồi quy"}
        </button>
      </div>

      {rgError && (
        <div className="rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-2 text-sm text-[#F2A5A9]">
          {rgError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-[#9AA4B2]">
            {result.tickers.length} mã · {result.sampleCount} mẫu gộp · dự báo {result.forwardDays} phiên tới ·{" "}
            R²:{" "}
            <span className="font-[var(--font-mono)] font-semibold text-[#E7EAEE]">
              {(result.r2 * 100).toFixed(1)}%
            </span>
            <span className="text-[#5A6270]">
              {" "}
              (% biến động return giải thích được bởi toàn bộ các biến — càng thấp càng cho thấy phần lớn biến động giá là nhiễu/ngẫu nhiên, không nằm trong các chỉ báo này)
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Biến số", "Hệ số", "Đọc hiểu"].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.name} className="border-b border-[#161B22] last:border-0">
                    <td className="px-3 py-2 text-[#E7EAEE]">{c.label}</td>
                    <td className="px-3 py-2" style={{ color: c.coef >= 0 ? ACCENT : DOWN }}>
                      {c.coef >= 0 ? "+" : ""}
                      {c.coef.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-[#7C8797]">
                      {Math.abs(c.coef) < 0.01
                        ? "gần như không có ảnh hưởng"
                        : c.coef > 0
                        ? "hướng chấm điểm hiện tại (cộng điểm) có cơ sở"
                        : "NGƯỢC hướng đang chấm điểm — nên xem lại dấu +/- hiện tại"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#5A6270]">
            Fit trên ~{result.sampleCount} mẫu gộp từ {result.tickers.length} mã — đủ để chẩn đoán xu hướng chung,
            nhưng không đủ để khẳng định chắc chắn cho từng mã riêng lẻ. Không phải khuyến nghị đầu tư.
          </p>
        </div>
      )}
    </div>
  );
}
