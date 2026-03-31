# 🛠️ Hướng Dẫn Xử Lý Lỗi Xác Thực Google API (OAuth) Trên n8n Docker
Trong quá trình triển khai hệ thống Automation bằng n8n trên môi trường Docker, nhóm đã gặp và giải quyết thành công 2 lỗi bảo mật khắt khe từ phía Google. Dưới đây là tài liệu ghi chú cách khắc phục để các thành viên khác hoặc người triển khai sau có thể nắm bắt.

---

## 1. Lỗi 400: `invalid_request` (Access blocked)
**🔴 Biểu hiện:** Khi bấm *Sign in with Google* trong node Google Sheets, Google báo lỗi 400 và chặn truy cập. Link Callback URL hiện ra một địa chỉ IP nội bộ (Ví dụ: `http://172.26.10.43:5678/...`).

**🔍 Nguyên nhân:** Google OAuth KHÔNG chấp nhận các địa chỉ IP mạng riêng (Private IP) trong mục *Authorized redirect URIs*. Nó chỉ chấp nhận tên miền thực tế hoặc `localhost`. Do n8n chạy trong Docker tự nhận diện sai IP mạng ảo của container.

**✅ Cách khắc phục:**
Ép n8n sử dụng `localhost` làm Webhook URL mặc định bằng cách thêm biến môi trường vào file cấu hình.

1. Mở file `docker-compose.yml`.  
2. Thêm biến `WEBHOOK_URL` vào phần `environment` của service n8n:
```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - WEBHOOK_URL=http://localhost:5678/ #ADD CONTENT
    volumes:
      - n8n_data:/home/node/.n8n
```

## 2. Lỗi 403: `access_denied` (Google verification process)
**🔴 Biểu hiện:** Sau khi vượt qua lỗi 400, tiến hành đăng nhập bằng Gmail thì Google hiện cảnh báo: *"n8n has not completed the Google verification process"* kèm theo mã lỗi `Error 403: access_denied` và không cho phép cấp quyền.

**🔍 Nguyên nhân:** Ứng dụng n8n mà nhóm tạo trên nền tảng Google Cloud Console đang được đặt ở trạng thái **"Testing"** (Thử nghiệm). Ở chế độ bảo mật này, Google sẽ chặn toàn bộ người dùng đăng nhập, ngoại trừ những tài khoản Email được chỉ định đích danh vào danh sách "Người dùng thử nghiệm" (Test users).

**✅ Cách khắc phục:**
Thêm địa chỉ Email đang sử dụng vào danh sách Test users trên Google Cloud để được cấp quyền ưu tiên.

1. Truy cập vào **Google Cloud Console** và chọn dự án n8n vừa tạo.
2. Tại menu bên trái, chọn **APIs & Services** -> **OAuth consent screen**.
3. Cuộn trang xuống phía dưới cùng, tìm đến khu vực **Test users** (Người dùng thử nghiệm).
4. Bấm nút **+ ADD USERS**.
5. Nhập chính xác địa chỉ Email của bạn (Email chứa file Google Sheets cần lấy dữ liệu) và bấm **Save**.
6. Quay lại giao diện n8n và bấm *Sign in with Google* một lần nữa.
7. *Lưu ý:* Màn hình có thể hiện cảnh báo "Google hasn't verified this app". Hãy bấm vào nút **Advanced** (Nâng cao) -> Chọn **Go to n8n (unsafe)** -> Tích chọn các quyền truy cập và bấm **Continue** là hoàn tất kết nối!

# 🛠️  Setup Frontend React + Vite

Bước 1: Cài Node.js bằng nvm
Nếu máy chưa có nvm, cài bằng lệnh:

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

Sau đó cài Node.js:

nvm install 22
nvm use 22
nvm alias default 22

Kiểm tra lại phiên bản:

node -v
npm -v

✅ Bước 2: Tạo project React bằng Vite

npm create vite@latest frontend -- --template react

Sau khi tạo xong, vào thư mục project:

cd frontend

Nếu Vite chưa tự cài dependencies thì chạy thêm:

npm install

✅ Bước 3: Cài các thư viện cần thiết

npm install react-router-dom axios zustand lucide-react recharts

✅ Bước 4: Tạo cấu trúc thư mục giống project chuẩn

mkdir -p src/assets src/components src/contexts src/layouts src/routes src/services
mkdir -p src/pages/manager src/pages/user

Cấu trúc sau khi tạo:

frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── contexts/
│   ├── layouts/
│   ├── pages/
│   │   ├── manager/
│   │   └── user/
│   ├── routes/
│   └── services/
├── index.html
├── package.json
└── vite.config.js

✅ Bước 5: Chạy frontend

npm run dev

Sau khi chạy thành công, frontend sẽ hoạt động tại địa chỉ mặc định:

http://localhost:5173/