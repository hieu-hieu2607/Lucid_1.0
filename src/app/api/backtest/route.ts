import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Backtest lặp qua nhiều mốc thời gian lịch sử cho 1 mã — chỉ 1 mã/lần để
// không vượt giới hạn thời gian của serverless function (khác /api/analyze,
// vốn quét cả watchlist nhưng chỉ tính điểm ở 1 mốc thời gian: hôm nay).
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json(
      { error: "Thiếu tham số ?ticker=, ví dụ /api/backtest?ticker=VNM" },
      { status: 400 }
    );
  }
  const forwardDays = Number(req.nextUrl.searchParams.get("forwardDays") ?? 5);

  try {
    const result = await runBacktest(ticker, { forwardDays });
    if (!result) {
      return NextResponse.json(
        { error: `Không đủ dữ liệu lịch sử để backtest ${ticker}.` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/backtest failed:", err);
    return NextResponse.json(
      { error: "Lỗi khi chạy backtest. Thử lại sau." },
      { status: 502 }
    );
  }
}