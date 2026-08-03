import { NextRequest, NextResponse } from "next/server";
import { runRidgeSweep } from "@/lib/regression";
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
    const result = await runRidgeSweep(tickers, forwardDays);
    if (!result) {
      return NextResponse.json(
        { error: "Không đủ dữ liệu để chạy Ridge sweep." },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/ridge failed:", err);
    return NextResponse.json({ error: "Lỗi khi chạy Ridge sweep. Thử lại sau." }, { status: 502 });
  }
}