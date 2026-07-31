import { getVnstock } from "./vnstock-client";
import { computeScoreFromHistory, pctChange, trimUnclosedBar, ShortTermResult } from "./analyze";

export interface RegressionCoefficient {
  name: string;
  label: string;
  coef: number;
}

export interface RegressionResult {
  tickers: string[];
  forwardDays: number;
  sampleCount: number;
  r2: number;
  coefficients: RegressionCoefficient[];
}

/**
 * Mỗi feature ứng với 1 "quy tắc" đang dùng trong computeScoreFromHistory
 * (analyze.ts), viết lại dưới dạng biến số liên tục thay vì các dải rời rạc,
 * để hồi quy có đủ bậc tự do so với số mẫu thu thập được. Dấu (+/-) và độ lớn
 * của hệ số sau khi fit cho biết hướng chấm điểm hiện tại có được dữ liệu thực
 * tế ủng hộ hay không — KHÔNG dùng để tự động ghi đè công thức đang chạy live.
 */
const FEATURES: { name: string; label: string; extract: (r: ShortTermResult) => number }[] = [
  { name: "intercept", label: "Hằng số", extract: () => 1 },
  {
    name: "trend",
    label: "Xu hướng SMA (Thuận=+1 / Chưa thuận=-1)",
    extract: (r) => (r.trendAligned === true ? 1 : r.trendAligned === false ? -1 : 0),
  },
  {
    name: "superTrend",
    label: "SuperTrend (Tăng=+1 / Giảm=-1)",
    extract: (r) => (r.superTrend === "bullish" ? 1 : r.superTrend === "bearish" ? -1 : 0),
  },
  {
    name: "adxDirStrength",
    label: "ADX × chiều (độ mạnh xu hướng có dấu, /100)",
    extract: (r) => {
      const dir = r.adxBullish === true ? 1 : r.adxBullish === false ? -1 : 0;
      return ((r.adx ?? 0) * dir) / 100;
    },
  },
  { name: "rsiCentered", label: "RSI − 50", extract: (r) => (r.rsi14 ?? 50) - 50 },
  {
    name: "macdPct",
    label: "MACD histogram (% giá đóng cửa)",
    extract: (r) =>
      r.lastClose && r.macdHistogram !== null ? (r.macdHistogram / r.lastClose) * 100 : 0,
  },
  {
    name: "macdRising",
    label: "MACD đang tăng tốc (+1) / chững lại (-1)",
    extract: (r) => (r.macdRising === true ? 1 : r.macdRising === false ? -1 : 0),
  },
  {
    name: "divergence",
    label: "Phân kỳ (tăng=+1 / giảm=-1)",
    extract: (r) =>
      (r.rsiBullDiv || r.macdBullDiv ? 1 : 0) - (r.rsiBearDiv || r.macdBearDiv ? 1 : 0),
  },
  { name: "bollinger", label: "Bollinger %B", extract: (r) => r.bollingerPercentB ?? 0.5 },
  { name: "volumeRatio", label: "Khối lượng / TB 20 phiên", extract: (r) => r.volumeRatio ?? 1 },
  {
    name: "relativeStrength5d",
    label: "Sức mạnh tương đối vs VNINDEX 5 phiên (%)",
    extract: (r) => r.relativeStrength5d ?? 0,
  },
  { name: "priceChange5d", label: "Δ giá 5 phiên (%)", extract: (r) => r.priceChange5d ?? 0 },
  { name: "atrPercent", label: "ATR (% giá)", extract: (r) => r.atrPercent ?? 0 },
];

/** Giải hệ phương trình tuyến tính Ax = b bằng khử Gauss-Jordan (pivot từng phần). */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-9) return null; // ma trận suy biến (đa cộng tuyến quá nặng)

    const pivot = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/** Hồi quy tuyến tính bội (OLS) qua phương trình chuẩn (XᵀX)β = XᵀY. */
function ols(X: number[][], y: number[]): { coefs: number[]; r2: number } | null {
  const n = X.length;
  const p = X[0].length;
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const XtY: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      XtY[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  const coefs = solveLinearSystem(XtX, XtY);
  if (!coefs) return null;

  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = X[i].reduce((s, xij, j) => s + xij * coefs[j], 0);
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { coefs, r2 };
}

/**
 * Chạy backtest gộp qua nhiều mã, trích đặc trưng từ mỗi mốc thời gian, rồi
 * fit hồi quy tuyến tính để xem hướng chấm điểm nào thực sự được dữ liệu ủng hộ.
 * Lấy dữ liệu của tất cả mã SONG SONG (Promise.all) để không vượt giới hạn
 * thời gian của serverless function; phần tính toán chỉ báo là CPU-bound nên
 * nhanh, không cần gọi mạng thêm sau bước fetch ban đầu.
 */
export async function runWeightRegression(
  tickers: string[],
  forwardDays = 5
): Promise<RegressionResult | null> {
  const fns = await getVnstock();
  const lookbackCalendarDays = 500;
  const start = new Date();
  start.setDate(start.getDate() - lookbackCalendarDays);
  const startStr = start.toISOString().slice(0, 10);

  let vni = await fns.stock.quote({ ticker: "VNINDEX", start: startStr });
  vni = trimUnclosedBar(vni);

  function vniChg5dAt(history: { date: string }[], cutoff: number): number | null {
    if (!vni || vni.length === 0) return null;
    const targetDate = String(history[cutoff].date).slice(0, 10);
    const idx = vni.findIndex((b) => String(b.date).slice(0, 10) === targetDate);
    if (idx < 6) return null;
    return pctChange(vni[idx - 5].close, vni[idx].close);
  }

  // Lấy dữ liệu 500 ngày cho 20 mã CÙNG LÚC (như /api/analyze làm với 150 ngày)
  // dễ khiến nguồn dữ liệu TCBS/Vietcap chậm/timeout một phần do payload lớn hơn
  // nhiều — chia thành từng đợt nhỏ (5 mã/đợt) để ổn định hơn, đổi lấy chút thời
  // gian chờ thêm (vẫn nằm trong 60s của serverless function).
  const BATCH_SIZE = 5;
  const histories: { ticker: string; history: any }[] = [];
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          let h = await fns.stock.quote({ ticker, start: startStr });
          h = trimUnclosedBar(h);
          return { ticker, history: h };
        } catch (err) {
          console.error(`runWeightRegression: lỗi khi lấy dữ liệu ${ticker}`, err);
          return { ticker, history: null };
        }
      })
    );
    histories.push(...batchResults);
  }

  const validCount = histories.filter((h) => h.history && h.history.length >= 120).length;
  console.log(
    `[runWeightRegression] ${validCount}/${tickers.length} mã lấy dữ liệu thành công (đủ >=120 phiên)`
  );

  const X: number[][] = [];
  const y: number[] = [];
  const stepDays = 5;
  const minStart = 90;

  for (const { ticker, history } of histories) {
    if (!history || history.length < 120) continue;
    const maxCutoff = history.length - forwardDays - 1;
    for (let cutoff = minStart; cutoff <= maxCutoff; cutoff += stepDays) {
      const slice = history.slice(0, cutoff + 1);
      const result = computeScoreFromHistory(ticker, slice, vniChg5dAt(history, cutoff), null, fns);
      if (!result) continue;
      const forwardReturnPct = pctChange(history[cutoff].close, history[cutoff + forwardDays].close);
      X.push(FEATURES.map((f) => f.extract(result)));
      y.push(forwardReturnPct);
    }
  }

  console.log(`[runWeightRegression] thu được ${X.length} mẫu (cần >= ${FEATURES.length * 10})`);

  if (X.length < FEATURES.length * 10) return null; // không đủ mẫu để hồi quy đáng tin cậy

  const fit = ols(X, y);
  if (!fit) {
    console.error(
      "[runWeightRegression] ols() thất bại — ma trận suy biến (có biến bị hằng số/đa cộng tuyến hoàn toàn)"
    );
    return null;
  }

  return {
    tickers,
    forwardDays,
    sampleCount: X.length,
    r2: fit.r2,
    coefficients: FEATURES.map((f, i) => ({ name: f.name, label: f.label, coef: fit.coefs[i] })),
  };
}
