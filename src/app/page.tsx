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
  pe: number | null;
  roe: number | null;
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

/**
 * fetch + parse JSON an toàn: khi server trả về lỗi không phải JSON (VD:
 * trang HTML lỗi 504 timeout của Vercel), ném lỗi dễ hiểu thay vì để
 * JSON.parse tự crash với thông báo khó hiểu.
 */
async function safeFetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 504
        ? "Yêu cầu quá lâu (vượt giới hạn thời gian của server) — thử lại hoặc giảm phạm vi dữ liệu."
        : `Server trả về dữ liệu không hợp lệ (status ${res.status}): ${text.slice(0, 150)}`
    );
  }
  if (!res.ok) throw new Error(json.error ?? "Có lỗi xảy ra");
  return json;
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
            Lucid Dream
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
        <p className="text-xs text-[#5A6270] -mt-2">
          * P/E, ROE là ảnh chụp hiện tại — chỉ để tham khảo thêm góc độ cơ bản, KHÔNG nằm trong công thức chấm điểm và
          chưa qua backtest (vnstock-js không có lịch sử P/E/ROE theo ngày để kiểm chứng).
        </p>

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
              <Stat label="P/E (chỉ tham khảo)" value={fmt(best.pe)} />
              <Stat label="ROE (chỉ tham khảo)" value={best.roe !== null ? `${fmt(best.roe * 100)}%` : "—"} />
            </div>
          </div>
        )}

        {ranked.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Mã", "Giá", "Điểm", "RSI", "MACD", "Phân kỳ", "Xu hướng", "ADX", "%B", "ATR%", "KL/TB20", "Ngoại%", "RS 5p", "Δ 5 phiên", "R:R", "P/E*", "ROE*"].map((h) => (
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
                      <td className="px-3 py-2 text-[#7C8797]">{fmt(row.pe)}</td>
                      <td className="px-3 py-2 text-[#7C8797]">
                        {row.roe !== null ? `${fmt(row.roe * 100)}%` : "—"}
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
        <TrainTestPanel />
        <RidgeSweepPanel />
        <WalkForwardPanel />
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
      const json = await safeFetchJson(
        `/api/backtest?ticker=${encodeURIComponent(ticker.trim())}&forwardDays=${forwardDays}`
      );
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
  standardError: number | null;
  pValue: number | null;
  significant: boolean;
}

interface PredictedPick {
  ticker: string;
  lastClose: number | null;
  predictedReturnPct: number;
}

interface RegressionResult {
  tickers: string[];
  forwardDays: number;
  sampleCount: number;
  r2: number;
  coefficients: RegressionCoefficient[];
  predictions: PredictedPick[];
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
      const json = await safeFetchJson(`/api/regression?forwardDays=${forwardDays}`);
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
                  {["Biến số", "Hệ số", "p-value", "Đọc hiểu"].map((h) => (
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
                    <td className="px-3 py-2" style={{ color: c.significant ? "#E7EAEE" : "#5A6270" }}>
                      {c.pValue !== null ? c.pValue.toFixed(3) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[#7C8797]">
                      {!c.significant
                        ? "chưa đủ ý nghĩa thống kê (p ≥ 0.05) — có thể chỉ là nhiễu"
                        : c.coef > 0
                        ? "có ý nghĩa thống kê — hướng chấm điểm hiện tại (cộng điểm) có cơ sở"
                        : "có ý nghĩa thống kê nhưng NGƯỢC hướng đang chấm điểm — nên xem lại dấu +/- hiện tại"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#5A6270]">
            Fit trên ~{result.sampleCount} mẫu gộp từ {result.tickers.length} mã — đủ để chẩn đoán xu hướng chung,
            nhưng không đủ để khẳng định chắc chắn cho từng mã riêng lẻ. p-value ước tính theo phân phối chuẩn
            (số mẫu đủ lớn nên xấp xỉ này đáng tin). Không phải khuyến nghị đầu tư.
          </p>

          {result.predictions.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)] text-[#B7C0CC]">
                DỰ ĐOÁN THEO MÔ HÌNH (THỬ NGHIỆM)
              </div>
              <p className="text-xs text-[#5A6270] max-w-2xl">
                Áp hệ số vừa fit vào dữ liệu mới nhất của từng mã để ước tính return kỳ vọng {result.forwardDays} phiên tới.
                Đây là mô hình fit TRONG-MẪU (in-sample) — chưa kiểm chứng trên dữ liệu ngoài mẫu, và R² ở trên cho thấy
                độ tin cậy tổng thể vẫn thấp. Xem như một cách xếp hạng khác để tham khảo, không phải dự báo chắc chắn.
              </p>
              <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
                <table className="w-full text-sm font-[var(--font-mono)]">
                  <thead>
                    <tr className="text-[#5A6270] text-xs">
                      {["Mã", "Giá", "Return kỳ vọng"].map((h) => (
                        <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.predictions.slice(0, 10).map((p) => (
                      <tr key={p.ticker} className="border-b border-[#161B22] last:border-0">
                        <td className="px-3 py-2 text-[#E7EAEE] font-semibold">{p.ticker}</td>
                        <td className="px-3 py-2 text-[#C4CBD4]">
                          {p.lastClose ? `${fmt(p.lastClose)}k` : "—"}
                        </td>
                        <td
                          className="px-3 py-2"
                          style={{ color: p.predictedReturnPct >= 0 ? ACCENT : DOWN }}
                        >
                          {p.predictedReturnPct >= 0 ? "+" : ""}
                          {fmt(p.predictedReturnPct)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TrainTestBucket {
  label: string;
  count: number;
  avgActualReturnPct: number;
  winRatePct: number;
}

interface TrainTestResult {
  tickers: string[];
  forwardDays: number;
  trainCount: number;
  testCount: number;
  trainDateRange: [string, string];
  testDateRange: [string, string];
  trainR2: number;
  oosR2: number;
  oosCorrelation: number | null;
  buckets: TrainTestBucket[];
}

function TrainTestPanel() {
  const [forwardDays, setForwardDays] = useState(5);
  const [result, setResult] = useState<TrainTestResult | null>(null);
  const [ttError, setTtError] = useState<string | null>(null);
  const [ttLoading, setTtLoading] = useState(false);

  async function runTrainTest() {
    setTtLoading(true);
    setTtError(null);
    setResult(null);
    try {
      const json = await safeFetchJson(`/api/train-test?forwardDays=${forwardDays}`);
      setResult(json);
    } catch (e: any) {
      setTtError(e.message ?? "Có lỗi xảy ra");
    } finally {
      setTtLoading(false);
    }
  }

  const q1 = result?.buckets[0];
  const q4 = result?.buckets.at(-1);
  const monotonic =
    result && result.buckets.length >= 2
      ? result.buckets.every(
          (b, i) => i === 0 || b.avgActualReturnPct >= result.buckets[i - 1].avgActualReturnPct - 0.5
        )
      : null;

  return (
    <div className="rounded-xl border border-[#1F252E] p-5 flex flex-col gap-4">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)] text-[#B7C0CC]">
          KIỂM CHỨNG TRAIN/TEST (NGHIÊM NGẶT NHẤT)
        </div>
        <p className="text-xs text-[#5A6270] mt-1 max-w-2xl">
          Fit hệ số chỉ trên 70% dữ liệu CŨ HƠN (theo thời gian), rồi kiểm tra trên 30% dữ liệu MỚI HƠN
          mà mô hình chưa từng thấy. Nếu mô hình thực sự có giá trị, nhóm được dự đoán return cao (Q4)
          phải có return thực tế cao hơn rõ rệt so với nhóm dự đoán thấp (Q1) — kể cả trên dữ liệu chưa thấy.
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
          onClick={runTrainTest}
          disabled={ttLoading}
          className="text-sm px-3 py-1.5 rounded-md border border-[#262C36] hover:border-[#3A4250] text-[#B7C0CC] disabled:opacity-50 transition-colors"
        >
          {ttLoading ? "Đang chạy (có thể mất 20-40s)…" : "Chạy kiểm chứng"}
        </button>
      </div>

      {ttError && (
        <div className="rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-2 text-sm text-[#F2A5A9]">
          {ttError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-[#9AA4B2]">
            Train: {result.trainCount} mẫu ({result.trainDateRange[0]} → {result.trainDateRange[1]}) · Test:{" "}
            {result.testCount} mẫu ({result.testDateRange[0]} → {result.testDateRange[1]})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="R² trên tập train" value={`${(result.trainR2 * 100).toFixed(1)}%`} />
            <Stat
              label="R² ngoài mẫu (test)"
              value={`${(result.oosR2 * 100).toFixed(1)}%`}
              color={result.oosR2 > 0 ? ACCENT : DOWN}
            />
            <Stat
              label="Tương quan ngoài mẫu"
              value={result.oosCorrelation !== null ? result.oosCorrelation.toFixed(2) : "—"}
              color={
                result.oosCorrelation !== null
                  ? result.oosCorrelation > 0.1
                    ? ACCENT
                    : result.oosCorrelation < -0.1
                    ? DOWN
                    : NEUTRAL
                  : undefined
              }
            />
          </div>

          {result.oosR2 < 0 && (
            <div className="rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-2 text-xs text-[#F2A5A9]">
              R² ngoài mẫu ÂM nghĩa là mô hình dự đoán TỆ HƠN cả việc chỉ đoán bằng giá trị trung bình —
              dấu hiệu rõ ràng của overfitting: mô hình học "thuộc lòng" dữ liệu train, không khái quát hoá được.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Nhóm (theo dự đoán)", "Số mẫu", "Return thực tế TB", "Tỷ lệ thắng"].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.buckets.map((b) => (
                  <tr key={b.label} className="border-b border-[#161B22] last:border-0">
                    <td className="px-3 py-2 text-[#E7EAEE]">{b.label}</td>
                    <td className="px-3 py-2 text-[#C4CBD4]">{b.count}</td>
                    <td
                      className="px-3 py-2"
                      style={{ color: b.avgActualReturnPct >= 0 ? ACCENT : DOWN }}
                    >
                      {b.avgActualReturnPct >= 0 ? "+" : ""}
                      {fmt(b.avgActualReturnPct)}%
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">{fmt(b.winRatePct, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {q1 && q4 && (
            <p className="text-xs" style={{ color: monotonic ? ACCENT : "#7C8797" }}>
              {monotonic
                ? `Q4 (dự đoán cao nhất) có return thực tế ${fmt(q4.avgActualReturnPct)}% so với Q1 (dự đoán thấp nhất) ${fmt(q1.avgActualReturnPct)}% — nhóm dự đoán cao hơn thực sự cho kết quả tốt hơn trên dữ liệu chưa thấy.`
                : "Thứ tự các nhóm KHÔNG đơn điệu tăng dần — mô hình chưa cho thấy khả năng phân biệt đáng tin trên dữ liệu ngoài mẫu."}
            </p>
          )}

          <p className="text-xs text-[#5A6270]">
            Đây là bài kiểm tra nghiêm ngặt nhất trong app: mô hình hoàn toàn KHÔNG thấy dữ liệu test khi
            fit. Nếu R² ngoài mẫu gần 0 hoặc âm, kết luận hợp lý là bộ chỉ báo hiện tại không đủ sức dự
            đoán return ngắn hạn cho nhóm cổ phiếu này — đó là một kết luận khoa học hợp lệ, không phải
            thất bại của việc xây dựng hệ thống. Không phải khuyến nghị đầu tư.
          </p>
        </div>
      )}
    </div>
  );
}

interface RidgeSweepPoint {
  lambda: number;
  trainR2: number;
  oosR2: number;
  oosCorrelation: number | null;
  buckets: TrainTestBucket[];
}

interface RidgeSweepResult {
  tickers: string[];
  forwardDays: number;
  trainCount: number;
  testCount: number;
  points: RidgeSweepPoint[];
}

function RidgeSweepPanel() {
  const [forwardDays, setForwardDays] = useState(5);
  const [result, setResult] = useState<RidgeSweepResult | null>(null);
  const [rsError, setRsError] = useState<string | null>(null);
  const [rsLoading, setRsLoading] = useState(false);
  const [selectedLambda, setSelectedLambda] = useState<number | null>(null);

  async function runSweep() {
    setRsLoading(true);
    setRsError(null);
    setResult(null);
    setSelectedLambda(null);
    try {
      const json = await safeFetchJson(`/api/ridge?forwardDays=${forwardDays}`);
      setResult(json);
      const best = [...json.points].sort((a: RidgeSweepPoint, b: RidgeSweepPoint) => b.oosR2 - a.oosR2)[0];
      setSelectedLambda(best?.lambda ?? null);
    } catch (e: any) {
      setRsError(e.message ?? "Có lỗi xảy ra");
    } finally {
      setRsLoading(false);
    }
  }

  const bestPoint = result?.points.find((p) => p.lambda === selectedLambda) ?? null;
  const olsPoint = result?.points.find((p) => p.lambda === 0) ?? null;

  return (
    <div className="rounded-xl border border-[#1F252E] p-5 flex flex-col gap-4">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)] text-[#B7C0CC]">
          RIDGE REGRESSION — QUÉT ĐIỀU CHUẨN (λ)
        </div>
        <p className="text-xs text-[#5A6270] mt-1 max-w-2xl">
          Fit lại mô hình với nhiều mức điều chuẩn λ khác nhau trên CÙNG tập train/test như mục Train/Test
          ở trên (λ=0 = OLS thường, không điều chuẩn). λ càng lớn, hệ số càng bị ép về 0 — giảm nguy cơ học
          thuộc lòng nhiễu của tập train. Xem R² ngoài mẫu (test) đổi thế nào theo từng mức λ.
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
          onClick={runSweep}
          disabled={rsLoading}
          className="text-sm px-3 py-1.5 rounded-md border border-[#262C36] hover:border-[#3A4250] text-[#B7C0CC] disabled:opacity-50 transition-colors"
        >
          {rsLoading ? "Đang chạy (có thể mất 20-40s)…" : "Chạy Ridge sweep"}
        </button>
      </div>

      {rsError && (
        <div className="rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-2 text-sm text-[#F2A5A9]">
          {rsError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-[#9AA4B2]">
            Train: {result.trainCount} mẫu · Test: {result.testCount} mẫu · dự báo {result.forwardDays} phiên tới
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["λ", "R² train", "R² ngoài mẫu", "Tương quan ngoài mẫu", ""].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.points.map((p) => (
                  <tr
                    key={p.lambda}
                    className="border-b border-[#161B22] last:border-0 cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setSelectedLambda(p.lambda)}
                  >
                    <td className="px-3 py-2 text-[#E7EAEE]">{p.lambda === 0 ? "0 (OLS)" : p.lambda}</td>
                    <td className="px-3 py-2 text-[#C4CBD4]">{(p.trainR2 * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2" style={{ color: p.oosR2 > 0 ? ACCENT : DOWN }}>
                      {(p.oosR2 * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">
                      {p.oosCorrelation !== null ? p.oosCorrelation.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: p.lambda === selectedLambda ? NEUTRAL : "#5A6270" }}>
                      {p.lambda === selectedLambda ? "★ tốt nhất (test)" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {olsPoint && bestPoint && bestPoint.lambda !== 0 && (
            <p className="text-xs text-[#9AA4B2]">
              So với OLS (λ=0, R² ngoài mẫu {(olsPoint.oosR2 * 100).toFixed(1)}%), λ={bestPoint.lambda} cho R² ngoài
              mẫu {(bestPoint.oosR2 * 100).toFixed(1)}%
              {bestPoint.oosR2 > olsPoint.oosR2
                ? " — điều chuẩn thực sự giúp cải thiện khả năng khái quát hoá."
                : " — điều chuẩn không giúp cải thiện nhiều; nhiều khả năng vấn đề không nằm ở việc mô hình quá phức tạp, mà ở việc bản thân các chỉ báo không mang tín hiệu dự đoán thực sự."}
            </p>
          )}

          {bestPoint && (
            <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
              <table className="w-full text-sm font-[var(--font-mono)]">
                <thead>
                  <tr className="text-[#5A6270] text-xs">
                    {["Nhóm (λ tốt nhất)", "Số mẫu", "Return thực tế TB", "Tỷ lệ thắng"].map((h) => (
                      <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bestPoint.buckets.map((b) => (
                    <tr key={b.label} className="border-b border-[#161B22] last:border-0">
                      <td className="px-3 py-2 text-[#E7EAEE]">{b.label}</td>
                      <td className="px-3 py-2 text-[#C4CBD4]">{b.count}</td>
                      <td className="px-3 py-2" style={{ color: b.avgActualReturnPct >= 0 ? ACCENT : DOWN }}>
                        {b.avgActualReturnPct >= 0 ? "+" : ""}
                        {fmt(b.avgActualReturnPct)}%
                      </td>
                      <td className="px-3 py-2 text-[#C4CBD4]">{fmt(b.winRatePct, 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-[#5A6270]">
            Bấm vào 1 dòng bất kỳ để xem chi tiết bảng nhóm Q1-Q4 ứng với mức λ đó. Không phải khuyến nghị đầu tư.
          </p>
        </div>
      )}
    </div>
  );
}

interface WalkForwardFold {
  foldIndex: number;
  trainCount: number;
  testCount: number;
  testDateRange: [string, string];
  oosR2: number;
  oosCorrelation: number | null;
  q1ReturnPct: number;
  q4ReturnPct: number;
  q4BeatsQ1: boolean;
}

interface WalkForwardResult {
  tickers: string[];
  forwardDays: number;
  numFolds: number;
  folds: WalkForwardFold[];
  consistentDirectionPct: number;
  avgOosR2: number;
}

function WalkForwardPanel() {
  const [forwardDays, setForwardDays] = useState(5);
  const [result, setResult] = useState<WalkForwardResult | null>(null);
  const [wfError, setWfError] = useState<string | null>(null);
  const [wfLoading, setWfLoading] = useState(false);

  async function runWalkForward() {
    setWfLoading(true);
    setWfError(null);
    setResult(null);
    try {
      const json = await safeFetchJson(`/api/walk-forward?forwardDays=${forwardDays}&numFolds=5`);
      setResult(json);
    } catch (e: any) {
      setWfError(e.message ?? "Có lỗi xảy ra");
    } finally {
      setWfLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#1F252E] p-5 flex flex-col gap-4">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)] text-[#B7C0CC]">
          WALK-FORWARD VALIDATION (NHIỀU CỬA SỔ THEO THỜI GIAN)
        </div>
        <p className="text-xs text-[#5A6270] mt-1 max-w-2xl">
          Thay vì 1 lần chia train/test, chia dữ liệu ~2.5 năm thành 5 cửa sổ liên tiếp. Ở mỗi cửa sổ,
          train trên TOÀN BỘ dữ liệu trước đó, test trên đoạn tiếp theo. Nếu việc Q4 (dự đoán cao) thua
          Q1 (dự đoán thấp) LẶP LẠI đều đặn qua nhiều cửa sổ, đó là bằng chứng thị trường đang đổi pha
          liên tục — không phải may rủi của 1 lần chia.
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
          onClick={runWalkForward}
          disabled={wfLoading}
          className="text-sm px-3 py-1.5 rounded-md border border-[#262C36] hover:border-[#3A4250] text-[#B7C0CC] disabled:opacity-50 transition-colors"
        >
          {wfLoading ? "Đang chạy (có thể mất 30-50s)…" : "Chạy walk-forward"}
        </button>
      </div>

      {wfError && (
        <div className="rounded-md border border-[#EA394340] bg-[#EA39430D] px-4 py-2 text-sm text-[#F2A5A9]">
          {wfError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="% cửa sổ mà Q4 thắng Q1"
              value={`${fmt(result.consistentDirectionPct, 0)}%`}
              color={result.consistentDirectionPct >= 60 ? ACCENT : result.consistentDirectionPct <= 40 ? DOWN : NEUTRAL}
            />
            <Stat
              label="R² ngoài mẫu trung bình"
              value={`${(result.avgOosR2 * 100).toFixed(1)}%`}
              color={result.avgOosR2 > 0 ? ACCENT : DOWN}
            />
          </div>

          <div
            className="rounded-md border px-4 py-2 text-xs"
            style={{
              borderColor: `${result.consistentDirectionPct <= 40 ? DOWN : result.consistentDirectionPct >= 60 ? ACCENT : NEUTRAL}40`,
              background: `${result.consistentDirectionPct <= 40 ? DOWN : result.consistentDirectionPct >= 60 ? ACCENT : NEUTRAL}0D`,
              color: result.consistentDirectionPct <= 40 ? DOWN : result.consistentDirectionPct >= 60 ? ACCENT : NEUTRAL,
            }}
          >
            {result.consistentDirectionPct >= 60
              ? "Q4 thắng Q1 ở đa số cửa sổ — có dấu hiệu tín hiệu ổn định qua thời gian, đáng để tìm hiểu sâu hơn."
              : result.consistentDirectionPct <= 40
              ? "Q4 THUA Q1 ở đa số cửa sổ — mô hình đảo chiều lặp lại nhất quán, không phải ngẫu nhiên của 1 lần chia. Bằng chứng mạnh cho thấy các chỉ báo này không mang tín hiệu ổn định (hoặc mang tín hiệu NGƯỢC) ở khung thời gian này."
              : "Kết quả không nhất quán qua các cửa sổ (gần 50/50) — giống với việc thị trường đổi pha liên tục, mô hình tuyến tính cố định khó bắt được."}
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Cửa sổ", "Giai đoạn test", "R² ngoài mẫu", "Q1 thực tế", "Q4 thực tế", "Q4 > Q1?"].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.folds.map((f) => (
                  <tr key={f.foldIndex} className="border-b border-[#161B22] last:border-0">
                    <td className="px-3 py-2 text-[#E7EAEE]">#{f.foldIndex}</td>
                    <td className="px-3 py-2 text-[#C4CBD4]">
                      {f.testDateRange[0]} → {f.testDateRange[1]}
                    </td>
                    <td className="px-3 py-2" style={{ color: f.oosR2 > 0 ? ACCENT : DOWN }}>
                      {(f.oosR2 * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">
                      {f.q1ReturnPct >= 0 ? "+" : ""}
                      {fmt(f.q1ReturnPct)}%
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">
                      {f.q4ReturnPct >= 0 ? "+" : ""}
                      {fmt(f.q4ReturnPct)}%
                    </td>
                    <td className="px-3 py-2" style={{ color: f.q4BeatsQ1 ? ACCENT : DOWN }}>
                      {f.q4BeatsQ1 ? "Có" : "Không"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[#5A6270]">
            Mỗi cửa sổ train trên toàn bộ dữ liệu trước nó (expanding window), test trên đoạn kế tiếp mà mô
            hình chưa từng thấy. Không phải khuyến nghị đầu tư.
          </p>
        </div>
      )}
    </div>
  );
}
