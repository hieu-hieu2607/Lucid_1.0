"use client";

import { useEffect, useState } from "react";

interface ShortTermResult {
  ticker: string;
  score: number;
  rsi14: number | null;
  macdHistogram: number | null;
  volumeRatio: number | null;
  priceChange5d: number | null;
  lastClose: number | null;
  reason: string;
}

interface LongTermResult {
  ticker: string;
  score: number;
  pe: number | null;
  roe: number | null;
  marketCap: number | null;
  reason: string;
}

interface AnalysisResponse {
  generatedAt: string;
  shortTerm: { best: ShortTermResult | null; ranked: ShortTermResult[] };
  longTerm: { best: LongTermResult | null; ranked: LongTermResult[] };
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

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
      throw new Error(`Server trả về dữ liệu không hợp lệ (status ${res.status}): ${text.slice(0, 200)}`);
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

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1F252E] px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-xl font-bold tracking-tight">
            Song Kiếm
          </h1>
          <p className="text-sm text-[#7C8797] mt-0.5">
            Một mã để lướt sóng. Một mã để nắm giữ dài hạn.
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

      {/* Split screen: lướt sóng (xanh) vs dài hạn (vàng) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1F252E]">
        <Panel
          accent="#16C784"
          label="LƯỚT SÓNG"
          sublabel="Momentum kỹ thuật · ngắn hạn"
          loading={loading}
        >
          {data?.shortTerm.best && (
            <BestCard
              accent="#16C784"
              ticker={data.shortTerm.best.ticker}
              score={data.shortTerm.best.score}
              reason={data.shortTerm.best.reason}
              stats={[
                ["Giá đóng cửa", data.shortTerm.best.lastClose ? `${fmt(data.shortTerm.best.lastClose)}k` : "—"],
                ["RSI (14)", fmt(data.shortTerm.best.rsi14)],
                ["MACD hist.", fmt(data.shortTerm.best.macdHistogram, 2)],
                ["KL / TB20", data.shortTerm.best.volumeRatio ? `${fmt(data.shortTerm.best.volumeRatio, 2)}x` : "—"],
                ["Δ giá 5 phiên", `${fmt(data.shortTerm.best.priceChange5d)}%`],
              ]}
            />
          )}
          {data && (
            <RankedTable
              rows={data.shortTerm.ranked}
              columns={["ticker", "score", "rsi14", "priceChange5d"]}
              headers={["Mã", "Điểm", "RSI", "Δ 5 phiên"]}
            />
          )}
        </Panel>

        <Panel
          accent="#F0B90B"
          label="DÀI HẠN"
          sublabel="Nền tảng cơ bản · P/E &amp; ROE"
          loading={loading}
        >
          {data?.longTerm.best && (
            <BestCard
              accent="#F0B90B"
              ticker={data.longTerm.best.ticker}
              score={data.longTerm.best.score}
              reason={data.longTerm.best.reason}
              stats={[
                ["P/E", fmt(data.longTerm.best.pe)],
                ["ROE", data.longTerm.best.roe ? `${fmt(data.longTerm.best.roe * 100)}%` : "—"],
              ]}
            />
          )}
          {data && (
            <RankedTable
              rows={data.longTerm.ranked}
              columns={["ticker", "score", "pe", "roe"]}
              headers={["Mã", "Điểm", "P/E", "ROE"]}
            />
          )}
        </Panel>
      </div>

      <footer className="border-t border-[#1F252E] px-6 py-3 text-xs text-[#5A6270] flex items-center justify-between">
        <span>
          {data ? `Cập nhật lúc ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}` : ""}
        </span>
        <span>Chỉ mang tính tham khảo kỹ thuật/cơ bản — không phải khuyến nghị đầu tư.</span>
      </footer>
    </main>
  );
}

function Panel({
  accent,
  label,
  sublabel,
  loading,
  children,
}: {
  accent: string;
  label: string;
  sublabel: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="p-6 flex flex-col gap-5">
      <div className="flex items-baseline gap-2">
        <span
          className="text-xs font-semibold tracking-[0.15em] font-[var(--font-mono)]"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className="text-xs text-[#5A6270]">{sublabel}</span>
      </div>
      {loading && !children && (
        <div className="text-sm text-[#5A6270] font-[var(--font-mono)] animate-pulse">
          Đang tải dữ liệu…
        </div>
      )}
      {children}
    </section>
  );
}

function BestCard({
  accent,
  ticker,
  score,
  reason,
  stats,
}: {
  accent: string;
  ticker: string;
  score: number;
  reason: string;
  stats: [string, string][];
}) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{ borderColor: `${accent}40`, background: `${accent}0D` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-3xl font-[var(--font-display)] font-bold">{ticker}</div>
          <p className="text-sm text-[#9AA4B2] mt-1 max-w-md">{reason}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-[var(--font-mono)] font-bold" style={{ color: accent }}>
            {score}
          </div>
          <div className="text-xs text-[#5A6270]">điểm / 100</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-md bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#5A6270]">{k}</div>
            <div className="font-[var(--font-mono)] text-sm mt-0.5">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankedTable<T extends Record<string, any>>({
  rows,
  columns,
  headers,
}: {
  rows: T[];
  columns: (keyof T)[];
  headers: string[];
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-[#1F252E]">
      <table className="w-full text-sm font-[var(--font-mono)]">
        <thead>
          <tr className="text-[#5A6270] text-xs">
            {headers.map((h) => (
              <th key={h} className="text-left font-normal px-3 py-2 border-b border-[#1F252E]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.ticker + i} className="border-b border-[#161B22] last:border-0">
              {columns.map((col) => (
                <td key={String(col)} className="px-3 py-2 text-[#C4CBD4]">
                  {formatCell(col as string, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(col: string, value: any): string {
  if (value === null || value === undefined) return "—";
  if (col === "roe") return `${fmt(value * 100)}%`;
  if (col === "priceChange5d") return `${fmt(value)}%`;
  if (typeof value === "number") return fmt(value, col === "score" ? 0 : 1);
  return String(value);
}
