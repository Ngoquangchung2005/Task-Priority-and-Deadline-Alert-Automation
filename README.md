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

1. Cài đặt môi trường Node.js (Sử dụng NVM)


Nếu máy tính chưa cài đặt NVM, tiến hành chạy lệnh sau trên Terminal:

Bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
Cài đặt và thiết lập Node.js phiên bản 22 làm mặc định:

Bash
nvm install 22
nvm use 22
nvm alias default 22
Kiểm tra lại để chắc chắn quá trình cài đặt đã thành công:

Bash
node -v
npm -v
2. Khởi tạo dự án React bằng Vite
🎯 Mục đích: Sử dụng công cụ Vite để tạo bộ khung dự án React nhanh chóng, nhẹ và tối ưu tốc độ build thay cho Create React App truyền thống.

✅ Các bước thực hiện:

Chạy lệnh khởi tạo project với tên frontend bằng template React:

Bash
npm create vite@latest frontend -- --template react
Di chuyển vào thư mục dự án vừa được tạo:

Bash
cd frontend
Cài đặt các gói phụ thuộc (dependencies) mặc định của Vite:

Bash
npm install
3. Cài đặt các thư viện hỗ trợ thiết yếu
🎯 Mục đích: Tích hợp ngay từ đầu các công cụ phổ biến cho việc định tuyến, gọi API, quản lý trạng thái (state) và giao diện.

✅ Các bước thực hiện:

Đảm bảo bạn đang ở trong thư mục frontend/, chạy lệnh sau để cài đặt đồng loạt các thư viện:

Bash
npm install react-router-dom axios zustand lucide-react recharts
http://localhost:5173/
