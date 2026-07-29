# Song Kiếm — Phân tích cổ phiếu VN

Next.js app tìm 1 mã tốt nhất để **lướt sóng** (momentum kỹ thuật) và 1 mã tốt nhất để **đầu tư dài hạn** (P/E, ROE), dùng [`vnstock-js`](https://www.npmjs.com/package/vnstock-js) làm nguồn dữ liệu.

## Chạy thử local

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Trang sẽ tự gọi `/api/analyze`.

## Cấu trúc chính

- `src/lib/analyze.ts` — logic chấm điểm: `scoreShortTerm()` dùng RSI/MACD/volume/biến động giá; `screenLongTerm()` dùng `stock.screening()` lọc theo P/E & ROE.
- `src/app/api/analyze/route.ts` — API route (Node runtime, `force-dynamic` vì dữ liệu thay đổi liên tục). Nhận query `?symbols=VCB,MBB,FPT` để đổi rổ mã quét (mặc định `DEFAULT_UNIVERSE` trong `analyze.ts`).
- `src/app/page.tsx` — UI split-screen: bên trái (xanh) là lướt sóng, bên phải (vàng) là dài hạn.

## Deploy lên Vercel

```bash
npm i -g vercel   # nếu chưa có
vercel --prod
```

Không cần biến môi trường nào — `vnstock-js` gọi thẳng API công khai của TCBS/SSI.

## Lưu ý quan trọng

- **Rate limit**: `/api/analyze` quét ~20 mã mỗi lần gọi (mỗi mã 1 request lấy lịch sử giá). Nếu bị chặn/rate-limit khi rổ mã lớn hơn, cân nhắc thêm cache (Vercel KV / `revalidate`) hoặc giảm `DEFAULT_UNIVERSE`.
- **Không phải khuyến nghị đầu tư**: điểm số chỉ phản ánh công thức chấm điểm kỹ thuật/cơ bản đơn giản trong `analyze.ts` — nên tinh chỉnh trọng số theo khẩu vị rủi ro trước khi dùng nghiêm túc.
- Sandbox dùng để tạo project này chặn truy cập `fonts.googleapis.com` và các API chứng khoán, nên `next/font` và dữ liệu thật **chưa được test end-to-end tại đây** — cả hai sẽ hoạt động bình thường trên máy bạn hoặc trên Vercel. Type-check và `next build` (bỏ qua bước tải font) đã chạy sạch.
