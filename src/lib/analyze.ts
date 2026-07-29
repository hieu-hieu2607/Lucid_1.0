import os from "os";
import path from "path";
import { getVnstock } from "./vnstock-client";

// Rổ mã mặc định để quét — có thể mở rộng sau (VN30 tiêu biểu, thanh khoản tốt)
export const DEFAULT_UNIVERSE = [
  "VCB", "MBB", "TCB", "CTG", "BID", "ACB", "VPB", "STB",
  "FPT", "HPG", "VIC", "VHM", "VNM", "MSN", "MWG", "PNJ",
  "GAS", "POW", "SSI", "VRE",
];

export interface ShortTermResult {
  ticker: string;
  score: number;
  lastClose: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  macdRising: boolean | null; // histogram đang tăng dần (động lượng tăng tốc)
  sma20: number | null;
  sma50: number | null;
  priceVsSma20Pct: number | null; // giá lệch SMA20 bao nhiêu %
  trendAligned: boolean | null; // giá > SMA20 > SMA50 (xu hướng tăng rõ ràng)
  superTrend: "bullish" | "bearish" | null;
  bollingerPercentB: number | null; // vị trí trong dải Bollinger (0=dải dưới, 1=dải trên)
  atrPercent: number | null; // ATR / giá — đo biến động tương đối (rủi ro)
  volumeRatio: number | null; // volume gần nhất / TB 20 phiên
  priceChange5d: number | null; // % thay đổi giá 5 phiên gần nhất
  reason: string;
}

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}
/** Giờ Việt Nam hiện tại có đang trong phiên giao dịch không (9h-15h, T2-T6)? */
function isVnMarketHoursNow(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  parts.forEach((p) => (map[p.type] = p.value));
  const minutesNow = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
  const isWeekday = map.weekday !== "Sat" && map.weekday !== "Sun";
  return isWeekday && minutesNow >= 9 * 60 && minutesNow < 15 * 60;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
function vnTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}
/**
 * Chấm điểm momentum ngắn hạn cho 1 mã, tổng hợp nhiều chiều:
 * xu hướng (SMA20/50 + SuperTrend), động lượng (RSI/MACD), biến động
 * (Bollinger %B, ATR), và xác nhận dòng tiền (khối lượng).
 *
 * Đây KHÔNG phải khuyến nghị đầu tư — chỉ tổng hợp chỉ báo kỹ thuật lịch sử.
 */
async function scoreShortTerm(ticker: string): Promise<ShortTermResult | null> {
  try {
    const { stock, rsi, macd, sma, bollinger, atr, superTrend } = await getVnstock();
    const start = new Date();
    start.setDate(start.getDate() - 150); // ~5 tháng để SMA50/ATR đủ dữ liệu ổn định

    let history = await stock.quote({
      ticker,
      start: start.toISOString().slice(0, 10),
    });

    if (!history || history.length < 55) return null;

    // Trong giờ giao dịch, nến "hôm nay" vẫn đang hình thành (giá đóng cửa tạm
    // thời cập nhật liên tục) — dùng nó để tính RSI/MACD/SMA/Bollinger sẽ khiến
    // điểm số nhảy loạn suốt phiên. Bỏ nến này đi, chỉ tính trên các phiên đã
    // đóng cửa thực sự; điểm số sẽ chỉ đổi 1 lần/ngày, sau khi thị trường đóng cửa.
    if (isVnMarketHoursNow()) {
      const today = vnTodayDateString();
      const last = history.at(-1);
      if (last && String(last.date).slice(0, 10) === today) {
        history = history.slice(0, -1);
      }
    }

    if (!history || history.length < 55) return null;

    const rsiSeries = rsi(history);
    const macdSeries = macd(history);
    const sma20Series = sma(history, { period: 20 });
    const sma50Series = sma(history, { period: 50 });
    const bbSeries = bollinger(history, { period: 20, stddev: 2 });
    const atrSeries = atr(history, 14);
    const stSeries = superTrend(history);

    const lastRsi = rsiSeries?.at(-1)?.rsi ?? null;

    const lastMacd = macdSeries?.at(-1)?.histogram ?? null;
    const prevMacd = macdSeries?.at(-4)?.histogram ?? null; // so với 3 phiên trước
    const macdHistogram = lastMacd;
    const macdRising =
      lastMacd !== null && prevMacd !== null ? lastMacd > prevMacd : null;

    const closeNow = history.at(-1)?.close ?? 0;
    const sma20 = sma20Series?.at(-1)?.sma ?? null;
    const sma50 = sma50Series?.at(-1)?.sma ?? null;
    const priceVsSma20Pct = sma20 ? pctChange(sma20, closeNow) : null;
    const trendAligned =
      sma20 !== null && sma50 !== null
        ? closeNow > sma20 && sma20 > sma50
        : null;

    const superTrendDirection = stSeries?.at(-1)?.direction ?? null;

    const bollingerPercentB = bbSeries?.at(-1)?.percentB ?? null;

    const lastAtr = atrSeries?.at(-1)?.atr ?? null;
    const atrPercent = lastAtr && closeNow ? (lastAtr / closeNow) * 100 : null;

    const recent20 = history.slice(-20);
    const avgVol20 =
      recent20.reduce((sum, r) => sum + r.volume, 0) / recent20.length;
    const lastVol = history.at(-1)?.volume ?? 0;
    const volumeRatio = avgVol20 > 0 ? lastVol / avgVol20 : null;

    const close5dAgo = history.at(-6)?.close ?? closeNow;
    const priceChange5d = pctChange(close5dAgo, closeNow);

    // --- Chấm điểm 0-100, cộng dồn theo từng dải giá trị cụ thể ---
    let score = 50;
    const reasons: string[] = [];

    // 1) Cấu trúc xu hướng: SMA20/50 + SuperTrend (trọng số lớn nhất — xu
    //    hướng đúng chiều là điều kiện tiên quyết cho lướt sóng an toàn)
    if (trendAligned === true) {
      score += 15;
      reasons.push("Giá > SMA20 > SMA50 (xu hướng tăng rõ ràng)");
    } else if (trendAligned === false) {
      score -= 15;
      reasons.push("Cấu trúc SMA cho thấy xu hướng chưa thuận lợi");
    }
    if (superTrendDirection === "bullish") {
      score += 10;
      reasons.push("SuperTrend xác nhận xu hướng tăng");
    } else if (superTrendDirection === "bearish") {
      score -= 10;
      reasons.push("SuperTrend đang ở chiều giảm");
    }

    // 2) RSI — vùng động lượng khỏe mà chưa quá mua
    if (lastRsi !== null) {
      if (lastRsi >= 50 && lastRsi <= 65) {
        score += 15;
        reasons.push(`RSI ${lastRsi.toFixed(1)} trong vùng động lượng khỏe`);
      } else if (lastRsi > 65 && lastRsi <= 72) {
        score += 6;
        reasons.push(`RSI ${lastRsi.toFixed(1)} mạnh nhưng gần vùng quá mua`);
      } else if (lastRsi > 72) {
        score -= 8;
        reasons.push(`RSI ${lastRsi.toFixed(1)} quá mua, rủi ro điều chỉnh`);
      } else if (lastRsi >= 40) {
        score += 3;
      } else {
        score -= 10;
        reasons.push(`RSI ${lastRsi.toFixed(1)} yếu`);
      }
    }

    // 3) MACD — động lượng có đang tăng tốc không, không chỉ dương/âm
    if (macdHistogram !== null) {
      if (macdHistogram > 0 && macdRising) {
        score += 15;
        reasons.push("MACD dương và đang tăng tốc");
      } else if (macdHistogram > 0) {
        score += 7;
        reasons.push("MACD dương nhưng động lượng chững lại");
      } else {
        score -= 10;
        reasons.push("MACD âm, động lượng yếu");
      }
    }

    // 4) Bollinger %B — vị trí trong dải, tránh mua đuổi khi đã quá dải trên
    if (bollingerPercentB !== null) {
      if (bollingerPercentB > 1.0) {
        score -= 8;
        reasons.push("Giá vượt dải trên Bollinger, có thể đã quá đà");
      } else if (bollingerPercentB >= 0.5) {
        score += 10;
        reasons.push("Giá ở nửa trên dải Bollinger, còn dư địa tăng");
      } else if (bollingerPercentB >= 0.2) {
        score += 2;
      } else {
        score -= 8;
        reasons.push("Giá gần dải dưới Bollinger, xu hướng yếu");
      }
    }

    // 5) Khối lượng xác nhận
    if (volumeRatio !== null) {
      if (volumeRatio > 1.5) {
        score += 15;
        reasons.push(`Khối lượng gấp ${volumeRatio.toFixed(1)}x TB 20 phiên`);
      } else if (volumeRatio > 1.2) {
        score += 8;
        reasons.push(`Khối lượng cao hơn ${((volumeRatio - 1) * 100).toFixed(0)}% TB 20 phiên`);
      } else if (volumeRatio < 0.8) {
        score -= 5;
      }
    }

    // 6) Biến động giá 5 phiên — tăng khỏe nhưng chưa quá "đuổi giá"
    if (priceChange5d > 2 && priceChange5d <= 8) {
      score += 10;
      reasons.push(`Giá tăng ${priceChange5d.toFixed(1)}% trong 5 phiên, nhịp tăng khỏe`);
    } else if (priceChange5d > 8 && priceChange5d <= 15) {
      score += 4;
      reasons.push(`Giá tăng ${priceChange5d.toFixed(1)}%, bắt đầu hơi nóng`);
    } else if (priceChange5d > 15) {
      score -= 5;
      reasons.push(`Giá tăng nóng ${priceChange5d.toFixed(1)}% trong 5 phiên, rủi ro đuổi giá`);
    } else if (priceChange5d >= 0) {
      score += 3;
    } else {
      score -= 5;
    }

    // 7) Rủi ro biến động — ATR quá cao so với giá làm việc canh điểm vào/ra khó hơn
    if (atrPercent !== null && atrPercent > 5) {
      score -= 3;
      reasons.push(`ATR ${atrPercent.toFixed(1)}% giá — biến động cao, cần quản trị rủi ro chặt`);
    }

    return {
      ticker,
      score: Math.round(Math.max(0, Math.min(100, score))),
      lastClose: closeNow,
      rsi14: lastRsi,
      macdHistogram,
      macdRising,
      sma20,
      sma50,
      priceVsSma20Pct,
      trendAligned,
      superTrend: superTrendDirection,
      bollingerPercentB,
      atrPercent,
      volumeRatio,
      priceChange5d,
      reason: reasons.join("; ") || "Không đủ dữ liệu để đánh giá",
    };
  } catch (err) {
    console.error(`scoreShortTerm failed for ${ticker}:`, err);
    return null;
  }
}

export async function runAnalysis(universe: string[] = DEFAULT_UNIVERSE) {
  const { init } = await getVnstock();
  // os.homedir() không ghi được trên Vercel serverless — chỉ /tmp là ghi được.
  await init({ cacheDir: path.join(os.tmpdir(), "vnstock-js-cache") });

  const shortTermSettled = await Promise.all(
    universe.map((t) => scoreShortTerm(t))
  );
  const shortTermRanked = shortTermSettled
    .filter((r): r is ShortTermResult => r !== null)
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    shortTerm: {
      best: shortTermRanked[0] ?? null,
      ranked: shortTermRanked.slice(0, 15),
    },
  };
}
