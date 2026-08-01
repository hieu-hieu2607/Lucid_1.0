import { NextRequest, NextResponse } from "next/server";
import { runTrainTestSplit } from "@/lib/regression";
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

  try {
    const result = await runTrainTestSplit(tickers, forwardDays);
    if (!result) {
      return NextResponse.json(
        { error: "Không đủ dữ liệu để tách train/test (cần nhiều mẫu hơn cho cả 2 phần)." },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/train-test failed:", err);
    return NextResponse.json({ error: "Lỗi khi chạy kiểm chứng. Thử lại sau." }, { status: 502 });
  }
}