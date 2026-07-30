"use client";

import { useEffect, useState } from "react";

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
  volumeRatio: number | null;
  priceChange5d: number | null;
  reason: string;
}

interface AnalysisResponse {
  generatedAt: string;
  shortTerm: { best: ShortTermResult | null; ranked: ShortTermResult[] };
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

const ACCENT = "#16C784";
const DOWN = "#EA3943";

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

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-[#1F252E] px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-xl font-bold tracking-tight">
            LUCID
          </h1>
          <p className="text-sm text-[#7C8797] mt-0.5">
            Mã tốt nhất để lướt sóng — xu hướng, động lượng, biến động, khối lượng.
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

      <section className="p-6 flex flex-col gap-6 max-w-5xl w-full mx-auto">
        <div className="flex items-baseline gap-2">
          <span
            className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)]"
            style={{ color: ACCENT }}
          >
            LƯỚT SÓNG
          </span>
          <span className="text-xs text-[#5A6270]">
            Xu hướng (SMA/SuperTrend) · Động lượng (RSI/MACD) · Biến động (Bollinger/ATR) · Khối lượng
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
                <div className="text-xs text-[#5A6270]">điểm / 100</div>
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
              <Stat label="Giá vs SMA20" value={best.priceVsSma20Pct !== null ? `${fmt(best.priceVsSma20Pct)}%` : "—"} />
              <Stat label="RSI (14)" value={fmt(best.rsi14)} />
              <Stat
                label="MACD hist."
                value={`${fmt(best.macdHistogram, 2)}${best.macdRising ? " ↑" : ""}`}
              />
              <Stat label="Bollinger %B" value={fmt(best.bollingerPercentB, 2)} />
              <Stat label="ATR / giá" value={best.atrPercent !== null ? `${fmt(best.atrPercent)}%` : "—"} />
              <Stat label="KL / TB20" value={best.volumeRatio ? `${fmt(best.volumeRatio, 2)}x` : "—"} />
              <Stat label="Δ giá 5 phiên" value={`${fmt(best.priceChange5d)}%`} />
            </div>
          </div>
        )}

        {ranked.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
            <table className="w-full text-sm font-[var(--font-mono)]">
              <thead>
                <tr className="text-[#5A6270] text-xs">
                  {["Mã", "Giá", "Điểm", "RSI", "MACD", "Xu hướng", "%B", "ATR%", "KL/TB20", "Δ 5 phiên"].map((h) => (
                    <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, i) => (
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
                    <td className="px-3 py-2 text-[#C4CBD4]">{fmt(row.bollingerPercentB, 2)}</td>
                    <td className="px-3 py-2 text-[#C4CBD4]">
                      {row.atrPercent !== null ? `${fmt(row.atrPercent)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">
                      {row.volumeRatio ? `${fmt(row.volumeRatio, 2)}x` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[#C4CBD4]">{fmt(row.priceChange5d)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="border-t border-[#1F252E] px-6 py-3 text-xs text-[#5A6270] flex items-center justify-between">
        <span>
          {data ? `Cập nhật lúc ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}` : ""}
        </span>
        <span>Chỉ mang tính tham khảo kỹ thuật — không phải khuyến nghị đầu tư.</span>
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
