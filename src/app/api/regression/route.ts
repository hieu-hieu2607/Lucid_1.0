import { NextRequest, NextResponse } from "next/server";
import { runWeightRegression } from "@/lib/regression";
import { DEFAULT_UNIVERSE } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lấy dữ liệu ~20 mã song song (không tuần tự) nên vẫn nằm trong giới hạn 60s.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  const tickers = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_UNIVERSE;
  const forwardDays = Number(req.nextUrl.searchParams.get("forwardDays") ?? 5);

  try {
    const result = await runWeightRegression(tickers, forwardDays);
    if (!result) {
      return NextResponse.json(
        { error: "Không đủ dữ liệu để chạy hồi quy (cần nhiều mẫu hơn số biến)." },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/regression failed:", err);
    return NextResponse.json({ error: "Lỗi khi chạy hồi quy. Thử lại sau." }, { status: 502 });
  }
}
