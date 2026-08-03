import { NextRequest, NextResponse } from "next/server";
import { runWalkForward } from "@/lib/regression";
import { DEFAULT_UNIVERSE } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  const tickers = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_UNIVERSE;
  const forwardDays = Number(req.nextUrl.searchParams.get("forwardDays") ?? 5);
  const numFolds = Number(req.nextUrl.searchParams.get("numFolds") ?? 5);

  try {
    const result = await runWalkForward(tickers, forwardDays, numFolds);
    if (!result) {
      return NextResponse.json(
        { error: "Không đủ dữ liệu để chạy walk-forward (cần đủ mẫu cho mỗi cửa sổ)." },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/walk-forward failed:", err);
    return NextResponse.json({ error: "Lỗi khi chạy walk-forward. Thử lại sau." }, { status: 502 });
  }
}