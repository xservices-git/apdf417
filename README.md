# APDF417 - PDF417 Barcode Manager & Multi-Token Proxy

Website quản lý nhiều API Key và tạo mã vạch PDF417 sử dụng API từ [PDF417.PRO](https://pdf417.pro). Tối ưu hóa để deploy trên **Cloudflare Workers / Cloudflare Pages**.

![Dark Theme UI](https://raw.githubusercontent.com/xservices-git/apdf417/master/web/index.html)

---

## 🌟 Tính Năng Nổi Bật

- **Quản lý đa API Token (Multi-Token Management):**
  - Thêm, dãn nhãn, kiểm tra số dư (`available_barcodes`, `barcodes_limit`, `barcodes_created`).
  - Tự động chuyển đổi sang token tiếp theo khi token hiện tại **hết lượt tạo mã (BARCODE_LIMIT)**.
  - Chọn token active mặc định hoặc kiểm tra hàng loạt.
- **Tạo Mã Vạch PDF417 Trực Quan:**
  - Hỗ trợ chọn Bang (State: CA, CO, NY, TX...).
  - Tự động tải danh sách trường theo chuẩn **Brief** hoặc **Full** thông tin.
  - Tải về định dạng SVG / PNG hoặc sao chép mã barcode.
- **Bảo Mật & Lưu Trữ:**
  - Lưu thông tin Admin & Danh sách API Token dạng JSON trong **Cloudflare KV Storage**.
  - Đăng nhập Admin bảo vệ bằng Session Token SHA-256.
  - Hỗ trợ đổi Username / Password Admin trực tiếp trên giao diện.
- **Giao Diện Hiện Đại (Dark Mode):**
  - React + Tailwind CSS v4 + Lucide Icons.
  - Thiết kế Dark Mode tối giản, trực quan, dễ thao tác.
  - Tích hợp Proxy Hình ảnh bypass lỗi CORS khi xem/tải ảnh mã vạch.

---

## 🛠️ Cấu Trúc Dự Án

```text
apdf417/
├── worker/
│   └── index.js           # Cloudflare Worker Backend (Auth, Proxy, KV JSON Store)
├── web/                   # React Frontend (Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── pages/         # Dashboard, Generator, TokensManager, Settings, Login
│   │   ├── components/    # Sidebar, Topbar, Modal
│   │   └── lib/api.js     # REST client
│   └── dist/              # Build output
├── wrangler.toml          # Cloudflare Worker deployment configuration
└── README.md
```

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local Dev)

### 1. Cài đặt dependencies
```bash
# Root project
npm install

# Web frontend
cd web && npm install
```

### 2. Chạy Dev Server
```bash
# Chạy đồng thời Worker & Web frontend
npm run dev
```

Truy cập: `http://localhost:5173`
Tài khoản Admin mặc định:
- **Username:** `admin`
- **Password:** `changeme`

---

## ☁️ Deploy Lên Cloudflare Workers / Pages

### Bước 1: Tạo Cloudflare KV Namespace
```bash
npx wrangler kv:namespace create APDF417_KV
```
Copy `id` vừa tạo và thay vào file `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "APDF417_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

### Bước 2: Build & Deploy
```bash
# Build React app
npm run build

# Deploy Worker lên Cloudflare
npm run deploy
```

---

## 🔒 API Reference (Proxied Endpoints)

| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Đăng nhập Admin (`username`, `password`) |
| `/api/auth/change-password` | `POST` | Đổi mật khẩu Admin |
| `/api/tokens` | `GET` / `POST` | Lấy / Thêm API Token PDF417.PRO |
| `/api/tokens/:id` | `DELETE` | Xóa API Token |
| `/api/tokens/:id/check` | `POST` | Kiểm tra số dư của API Token |
| `/api/tokens/check-all` | `POST` | Kiểm tra tất cả token |
| `/api/pdf417/states` | `GET` | Lấy danh sách bang khả dụng |
| `/api/pdf417/fields` | `GET` | Lấy các trường dữ liệu theo `state` & `type` |
| `/api/pdf417/generate` | `POST` | Tạo mã vạch PDF417 (tự failover token) |
| `/api/proxy-image` | `GET` | Proxy ảnh PNG/SVG để tránh lỗi CORS |

---

## 📄 License
MIT
