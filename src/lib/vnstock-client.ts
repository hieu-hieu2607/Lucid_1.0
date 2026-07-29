// vnstock-js gọi os.homedir() + mkdir NGAY khi được import (để chuẩn bị
// watchlist/cache), không đợi gọi init(). Trên Vercel, thư mục home không
// ghi được — chỉ /tmp mới ghi được — và Vercel không cho đặt biến môi
// trường tên "HOME" qua dashboard (tên dành riêng cho hệ thống).
//
// Giải pháp: set process.env.HOME ngay trong code, TRƯỚC khi import
// vnstock-js. Vì static `import` luôn chạy trước mọi dòng code khác trong
// cùng file, ta phải dùng dynamic import() bên trong 1 hàm để đảm bảo thứ
// tự: set env → rồi mới import.

let modulePromise: Promise<typeof import("vnstock-js")> | null = null;

export function getVnstock() {
  if (!modulePromise) {
    if (!process.env.HOME || process.env.HOME === "/") {
      process.env.HOME = "/tmp";
    }
    modulePromise = import("vnstock-js");
  }
  return modulePromise;
}
