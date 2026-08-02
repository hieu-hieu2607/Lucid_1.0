import { getVnstock } from "./vnstock-client";
import { computeScoreFromHistory, pctChange, trimUnclosedBar, withRetry, ShortTermResult } from "./analyze";

export interface RegressionCoefficient {
  name: string;
  label: string;
  coef: number;
  standardError: number | null;
  pValue: number | null;
  significant: boolean; // p < 0.05
}

export interface PredictedPick {
  ticker: string;
  lastClose: number | null;
  predictedReturnPct: number;
}

export interface RegressionResult {
  tickers: string[];
  forwardDays: number;
  sampleCount: number;
  r2: number;
  coefficients: RegressionCoefficient[];
  predictions: PredictedPick[];
}

export interface TrainTestBucket {
  label: string;
  count: number;
  avgActualReturnPct: number;
  winRatePct: number;
}

export interface TrainTestResult {
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

/** Nghịch đảo ma trận vuông bằng khử Gauss-Jordan (augment với ma trận đơn vị). */
function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-9) return null; // ma trận suy biến (đa cộng tuyến quá nặng)

    const pivot = M[col][col];
    for (let c = 0; c < 2 * n; c++) M[col][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = 0; c < 2 * n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row.slice(n));
}

/** Xấp xỉ hàm erf (Abramowitz-Stegun) để tính phân phối chuẩn tắc. */
function erf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return z >= 0 ? y : -y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** p-value 2 phía từ thống kê t, xấp xỉ bằng phân phối chuẩn (chính xác khi bậc tự do lớn — luôn đúng ở đây vì n >> p). */
function twoTailedPValue(tStat: number): number {
  return 2 * (1 - normalCdf(Math.abs(tStat)));
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
 * Hồi quy tuyến tính bội (OLS) qua phương trình chuẩn (XᵀX)β = XᵀY, kèm sai số
 * chuẩn và p-value cho từng hệ số — để biết hệ số nào thực sự có ý nghĩa
 * thống kê (p<0.05) thay vì chỉ nhìn dấu +/- của ước lượng điểm.
 */
function ols(
  X: number[][],
  y: number[]
): { coefs: number[]; standardErrors: (number | null)[]; pValues: (number | null)[]; r2: number } | null {
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

  const invXtX = invertMatrix(XtX);
  if (!invXtX) return null;

  const coefs = invXtX.map((row) => row.reduce((s, v, j) => s + v * XtY[j], 0));

  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = X[i].reduce((s, xij, j) => s + xij * coefs[j], 0);
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const dof = n - p;
  const sigma2 = dof > 0 ? ssRes / dof : null;
  const standardErrors = coefs.map((_, j) =>
    sigma2 !== null && invXtX[j][j] > 0 ? Math.sqrt(sigma2 * invXtX[j][j]) : null
  );
  const pValues = coefs.map((c, j) => {
    const se = standardErrors[j];
    if (se === null || se === 0) return null;
    return twoTailedPValue(c / se);
  });

  return { coefs, standardErrors, pValues, r2 };
}

interface Sample {
  date: string;
  ticker: string;
  features: number[];
  forwardReturn: number;
}

/**
 * Lấy dữ liệu 500 ngày cho toàn bộ watchlist (theo từng đợt nhỏ để không quá
 * tải nguồn dữ liệu), rồi trích mẫu (features, forward return, ngày) tại
 * nhiều mốc thời gian quá khứ cho từng mã — dùng chung cho cả
 * runWeightRegression (fit trên toàn bộ) và runTrainTestSplit (fit/test
 * tách theo thời gian).
 */
async function gatherSamples(
  tickers: string[],
  forwardDays: number
): Promise<{ samples: Sample[]; histories: { ticker: string; history: any }[] }> {
  const fns = await getVnstock();
  const lookbackCalendarDays = 500;
  const start = new Date();
  start.setDate(start.getDate() - lookbackCalendarDays);
  const startStr = start.toISOString().slice(0, 10);

  let vni = await withRetry(() => fns.stock.quote({ ticker: "VNINDEX", start: startStr }));
  vni = trimUnclosedBar(vni);

  function vniChg5dAt(history: { date: string }[], cutoff: number): number | null {
    if (!vni || vni.length === 0) return null;
    const targetDate = String(history[cutoff].date).slice(0, 10);
    const idx = vni.findIndex((b) => String(b.date).slice(0, 10) === targetDate);
    if (idx < 6) return null;
    return pctChange(vni[idx - 5].close, vni[idx].close);
  }

  // Lấy dữ liệu 500 ngày cho 20 mã CÙNG LÚC dễ khiến nguồn dữ liệu chậm/timeout
  // một phần do payload lớn — chia thành từng đợt nhỏ (5 mã/đợt) để ổn định hơn.
  const BATCH_SIZE = 5;
  const histories: { ticker: string; history: any }[] = [];
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          let h = await withRetry(() => fns.stock.quote({ ticker, start: startStr }));
          h = trimUnclosedBar(h);
          return { ticker, history: h };
        } catch (err) {
          console.error(`gatherSamples: lỗi khi lấy dữ liệu ${ticker}`, err);
          return { ticker, history: null };
        }
      })
    );
    histories.push(...batchResults);
  }

  const validCount = histories.filter((h) => h.history && h.history.length >= 120).length;
  console.log(`[gatherSamples] ${validCount}/${tickers.length} mã lấy dữ liệu thành công`);

  const samples: Sample[] = [];
  const stepDays = 5;
  const minStart = 90;

  for (const { ticker, history } of histories) {
    if (!history || history.length < 120) continue;
    const maxCutoff = history.length - forwardDays - 1;
    for (let cutoff = minStart; cutoff <= maxCutoff; cutoff += stepDays) {
      const slice = history.slice(0, cutoff + 1);
      const result = computeScoreFromHistory(ticker, slice, vniChg5dAt(history, cutoff), null, fns);
      if (!result) continue;
      const forwardReturn = pctChange(history[cutoff].close, history[cutoff + forwardDays].close);
      samples.push({
        date: String(history[cutoff].date).slice(0, 10),
        ticker,
        features: FEATURES.map((f) => f.extract(result)),
        forwardReturn,
      });
    }
  }

  console.log(`[gatherSamples] thu được ${samples.length} mẫu`);
  return { samples, histories };
}

/**
 * Fit hồi quy trên TOÀN BỘ dữ liệu backtest gộp, rồi áp hệ số vào dữ liệu MỚI
 * NHẤT của từng mã để đưa ra "return kỳ vọng" — dùng để CHẨN ĐOÁN hướng chấm
 * điểm, không phải kiểm chứng nghiêm ngặt (xem runTrainTestSplit cho việc đó).
 */
export async function runWeightRegression(
  tickers: string[],
  forwardDays = 5
): Promise<RegressionResult | null> {
  const fns = await getVnstock();
  const { samples, histories } = await gatherSamples(tickers, forwardDays);

  if (samples.length < FEATURES.length * 10) return null; // không đủ mẫu để hồi quy đáng tin cậy

  const X = samples.map((s) => s.features);
  const y = samples.map((s) => s.forwardReturn);
  const fit = ols(X, y);
  if (!fit) {
    console.error(
      "[runWeightRegression] ols() thất bại — ma trận suy biến (có biến bị hằng số/đa cộng tuyến hoàn toàn)"
    );
    return null;
  }

  // Áp hệ số vừa fit vào dữ liệu MỚI NHẤT (toàn bộ history, không cắt) của
  // từng mã để ra "return kỳ vọng" hôm nay. vniChg5d truyền null vì việc tính
  // lại chỉ số VNINDEX tương ứng nằm trong gatherSamples (đã đóng lại phạm vi
  // sau khi trả về) — computeScoreFromHistory xử lý null an toàn, chỉ khiến
  // riêng feature "sức mạnh tương đối" của bước dự đoán hôm nay mặc định 0.
  const predictions: PredictedPick[] = [];
  for (const { ticker, history } of histories) {
    if (!history || history.length < 120) continue;
    const result = computeScoreFromHistory(ticker, history, null, null, fns);
    if (!result) continue;
    const features = FEATURES.map((f) => f.extract(result));
    const predictedReturnPct = features.reduce((s, xi, i) => s + xi * fit.coefs[i], 0);
    predictions.push({ ticker, lastClose: result.lastClose, predictedReturnPct });
  }
  predictions.sort((a, b) => b.predictedReturnPct - a.predictedReturnPct);

  return {
    tickers,
    forwardDays,
    sampleCount: X.length,
    r2: fit.r2,
    coefficients: FEATURES.map((f, i) => ({
      name: f.name,
      label: f.label,
      coef: fit.coefs[i],
      standardError: fit.standardErrors[i],
      pValue: fit.pValues[i],
      significant: fit.pValues[i] !== null && (fit.pValues[i] as number) < 0.05,
    })),
    predictions,
  };
}

/** Chia mẫu thành các nhóm (quartile) theo giá trị dự đoán, rồi tính return thật + tỷ lệ thắng trong từng nhóm. */
function quantileBuckets(predicted: number[], actual: number[], numBuckets = 4): TrainTestBucket[] {
  const order = predicted.map((_, i) => i).sort((a, b) => predicted[a] - predicted[b]);
  const n = order.length;
  const size = Math.floor(n / numBuckets);
  const buckets: TrainTestBucket[] = [];
  for (let b = 0; b < numBuckets; b++) {
    const startI = b * size;
    const endI = b === numBuckets - 1 ? n : (b + 1) * size;
    const idx = order.slice(startI, endI);
    if (idx.length === 0) continue;
    const avgPred = idx.reduce((s, i) => s + predicted[i], 0) / idx.length;
    const avgActual = idx.reduce((s, i) => s + actual[i], 0) / idx.length;
    const winRate = (idx.filter((i) => actual[i] > 0).length / idx.length) * 100;
    buckets.push({
      label: `Q${b + 1} — dự đoán TB ${avgPred >= 0 ? "+" : ""}${avgPred.toFixed(2)}%`,
      count: idx.length,
      avgActualReturnPct: avgActual,
      winRatePct: winRate,
    });
  }
  return buckets;
}

/**
 * Kiểm chứng NGHIÊM NGẶT: tách dữ liệu theo THỜI GIAN — fit hệ số chỉ trên
 * `trainFraction` mẫu CŨ HƠN, rồi áp mô hình đó vào phần mẫu MỚI HƠN mà mô
 * hình chưa từng thấy (out-of-sample). Nếu mô hình thực sự có giá trị, nhóm
 * được dự đoán return cao (Q4) phải có return thực tế trung bình VÀ tỷ lệ
 * thắng cao hơn rõ rệt so với nhóm dự đoán thấp (Q1). Tách theo thời gian
 * (không phải ngẫu nhiên) vì đây là time-series — tách ngẫu nhiên sẽ rò rỉ
 * thông tin giữa các mốc gần nhau.
 */
export async function runTrainTestSplit(
  tickers: string[],
  forwardDays = 5,
  trainFraction = 0.7
): Promise<TrainTestResult | null> {
  const { samples } = await gatherSamples(tickers, forwardDays);

  if (samples.length < FEATURES.length * 20) return null; // cần đủ cho cả train lẫn test

  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date));
  const splitIdx = Math.floor(sorted.length * trainFraction);
  const train = sorted.slice(0, splitIdx);
  const test = sorted.slice(splitIdx);

  console.log(
    `[runTrainTestSplit] train=${train.length} (${train[0]?.date}→${train.at(-1)?.date}), test=${test.length} (${test[0]?.date}→${test.at(-1)?.date})`
  );

  if (train.length < FEATURES.length * 10 || test.length < 20) return null;

  const fit = ols(
    train.map((s) => s.features),
    train.map((s) => s.forwardReturn)
  );
  if (!fit) {
    console.error("[runTrainTestSplit] ols() trên tập train thất bại — ma trận suy biến");
    return null;
  }

  const testX = test.map((s) => s.features);
  const testY = test.map((s) => s.forwardReturn);
  const predY = testX.map((x) => x.reduce((s, xi, i) => s + xi * fit.coefs[i], 0));

  const testMean = testY.reduce((a, b) => a + b, 0) / testY.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < testY.length; i++) {
    ssRes += (testY[i] - predY[i]) ** 2;
    ssTot += (testY[i] - testMean) ** 2;
  }
  const oosR2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const oosCorrelation = pearsonCorrelation(predY, testY);
  const buckets = quantileBuckets(predY, testY, 4);

  return {
    tickers,
    forwardDays,
    trainCount: train.length,
    testCount: test.length,
    trainDateRange: [train[0].date, train.at(-1)!.date],
    testDateRange: [test[0].date, test.at(-1)!.date],
    trainR2: fit.r2,
    oosR2,
    oosCorrelation,
    buckets,
  };
}
