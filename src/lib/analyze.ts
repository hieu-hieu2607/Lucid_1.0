import { stock, init, rsi, macd } from "vnstock-js";

// Rổ mã mặc định để quét — có thể mở rộng sau (VN30 tiêu biểu, thanh khoản tốt)
export const DEFAULT_UNIVERSE = [
  "VCB", "MBB", "TCB", "CTG", "BID", "ACB", "VPB", "STB",
  "FPT", "HPG", "VIC", "VHM", "VNM", "MSN", "MWG", "PNJ",
  "GAS", "POW", "SSI", "VRE",
];

export interface ShortTermResult {
  ticker: string;
  score: number;
  rsi14: number | null;
  macdHistogram: number | null;
  volumeRatio: number | null; // volume gần nhất / TB 20 phiên
  priceChange5d: number | null; // % thay đổi giá 5 phiên gần nhất
  lastClose: number | null;
  reason: string;
}

export interface LongTermResult {
  ticker: string;
  score: number;
  pe: number | null;
  roe: number | null;
  marketCap: number | null;
  reason: string;
}

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Chấm điểm momentum ngắn hạn cho 1 mã dựa trên RSI, MACD, volume, biến động giá.
 * Đây KHÔNG phải khuyến nghị đầu tư — chỉ là tổng hợp chỉ báo kỹ thuật lịch sử.
 */
async function scoreShortTerm(ticker: string): Promise<ShortTermResult | null> {
  try {
    const start = new Date();
    start.setDate(start.getDate() - 120); // ~4 tháng dữ liệu để tính chỉ báo ổn định

    const history = await stock.quote({
      ticker,
      start: start.toISOString().slice(0, 10),
    });

    if (!history || history.length < 30) return null;

    const rsiSeries = rsi(history);
    const macdSeries = macd(history);

    const lastRsi = rsiSeries?.at(-1)?.rsi ?? null;
    const lastMacd = macdSeries?.at(-1);
    const macdHistogram = lastMacd?.histogram ?? null;

    const recent = history.slice(-20);
    const avgVol20 =
      recent.reduce((sum, r) => sum + r.volume, 0) / recent.length;
    const lastVol = history.at(-1)?.volume ?? 0;
    const volumeRatio = avgVol20 > 0 ? lastVol / avgVol20 : null;

    const closeNow = history.at(-1)?.close ?? 0;
    const close5dAgo = history.at(-6)?.close ?? closeNow;
    const priceChange5d = pctChange(close5dAgo, closeNow);

    // --- Chấm điểm momentum (0-100), trọng số có thể tinh chỉnh sau ---
    let score = 50;
    const reasons: string[] = [];

    if (lastRsi !== null) {
      if (lastRsi >= 50 && lastRsi <= 70) {
        score += 20;
        reasons.push(`RSI ${lastRsi.toFixed(1)} trong vùng xu hướng tăng khỏe`);
      } else if (lastRsi > 70) {
        score += 5;
        reasons.push(`RSI ${lastRsi.toFixed(1)} đã vào vùng quá mua`);
      } else if (lastRsi < 30) {
        score -= 10;
        reasons.push(`RSI ${lastRsi.toFixed(1)} yếu, có thể đang giảm`);
      }
    }

    if (macdHistogram !== null) {
      if (macdHistogram > 0) {
        score += 15;
        reasons.push("MACD histogram dương, động lượng tăng");
      } else {
        score -= 10;
        reasons.push("MACD histogram âm, động lượng yếu");
      }
    }

    if (volumeRatio !== null && volumeRatio > 1.3) {
      score += 15;
      reasons.push(`Khối lượng gấp ${volumeRatio.toFixed(1)}x trung bình 20 phiên`);
    }

    if (priceChange5d > 0) {
      score += Math.min(priceChange5d * 2, 15);
      reasons.push(`Giá tăng ${priceChange5d.toFixed(1)}% trong 5 phiên`);
    } else {
      score -= 5;
    }

    return {
      ticker,
      score: Math.round(Math.max(0, Math.min(100, score))),
      rsi14: lastRsi,
      macdHistogram,
      volumeRatio,
      priceChange5d,
      lastClose: closeNow,
      reason: reasons.join("; ") || "Không đủ dữ liệu để đánh giá",
    };
  } catch (err) {
    console.error(`scoreShortTerm failed for ${ticker}:`, err);
    return null;
  }
}

/**
 * Lấy danh sách ứng viên dài hạn dựa trên sàng lọc cơ bản (P/E hợp lý, ROE cao).
 */
async function screenLongTerm(): Promise<LongTermResult[]> {
  try {
    const screened = await stock.screening({
      exchange: "HOSE",
      filters: [
        { field: "pe", operator: "<", value: 20 },
        { field: "roe", operator: ">", value: 0.12 },
      ],
      sortBy: "roe",
      order: "desc",
      limit: 15,
    });

    return screened.map((row) => {
      const pe = (row as Record<string, any>).pe ?? null;
      const roe = (row as Record<string, any>).roe ?? null;
      let score = 50;
      const reasons: string[] = [];

      if (roe !== null) {
        score += Math.min(roe * 100, 30); // ROE 0.20 => +20 điểm
        reasons.push(`ROE ${(roe * 100).toFixed(1)}%`);
      }
      if (pe !== null && pe > 0) {
        score += Math.max(20 - pe, 0); // P/E càng thấp càng cộng điểm (đến ngưỡng 20)
        reasons.push(`P/E ${pe.toFixed(1)}`);
      }

      const r = row as Record<string, any>;
      return {
        ticker: r.ticker ?? r.symbol,
        score: Math.round(Math.max(0, Math.min(100, score))),
        pe,
        roe,
        marketCap: r.marketCap ?? null,
        reason: reasons.join("; ") || "Đạt tiêu chí sàng lọc cơ bản",
      };
    });
  } catch (err) {
    console.error("screenLongTerm failed:", err);
    return [];
  }
}

export async function runAnalysis(universe: string[] = DEFAULT_UNIVERSE) {
  await init();

  const shortTermSettled = await Promise.all(
    universe.map((t) => scoreShortTerm(t))
  );
  const shortTermRanked = shortTermSettled
    .filter((r): r is ShortTermResult => r !== null)
    .sort((a, b) => b.score - a.score);

  const longTermRanked = (await screenLongTerm()).sort(
    (a, b) => b.score - a.score
  );

  return {
    generatedAt: new Date().toISOString(),
    shortTerm: {
      best: shortTermRanked[0] ?? null,
      ranked: shortTermRanked.slice(0, 10),
    },
    longTerm: {
      best: longTermRanked[0] ?? null,
      ranked: longTermRanked.slice(0, 10),
    },
  };
}
