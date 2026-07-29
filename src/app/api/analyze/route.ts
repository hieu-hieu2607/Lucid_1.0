import { NextRequest, NextResponse } from "next/server";
import { runAnalysis, DEFAULT_UNIVERSE } from "@/lib/analyze";

// Cần Node runtime (không phải Edge) vì vnstock-js dùng các API Node chuẩn.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  const universe = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_UNIVERSE;

  try {
    const result = await runAnalysis(universe);
    return NextResponse.json(result, {
      headers: { Cache-Control: "s-maxage=900, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("GET /api/analyze failed:", err);
    return NextResponse.json(
      { error: "Không lấy được dữ liệu chứng khoán. Thử lại sau." },
      { status: 502 }
    );
  }
}
