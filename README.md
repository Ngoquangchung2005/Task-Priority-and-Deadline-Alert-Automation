# 🛠️ Hướng Dẫn Xử Lý Lỗi Xác Thực Google API (OAuth) Trên n8n Docker

Trong quá trình triển khai hệ thống Automation bằng n8n trên môi trường Docker, nhóm đã gặp và giải quyết thành công 2 lỗi bảo mật khắt khe từ phía Google. Dưới đây là tài liệu ghi chú cách khắc phục để các thành viên khác hoặc người triển khai sau có thể nắm bắt.

## ffff

## 1. Lỗi 400: `invalid_request` (Access blocked)

**🔴 Biểu hiện:** Khi bấm _Sign in with Google_ trong node Google Sheets, Google báo lỗi 400 và chặn truy cập. Link Callback URL hiện ra một địa chỉ IP nội bộ (Ví dụ: `http://172.26.10.43:5678/...`).

**🔍 Nguyên nhân:** Google OAuth KHÔNG chấp nhận các địa chỉ IP mạng riêng (Private IP) trong mục _Authorized redirect URIs_. Nó chỉ chấp nhận tên miền thực tế hoặc `localhost`. Do n8n chạy trong Docker tự nhận diện sai IP mạng ảo của container.

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

**🔴 Biểu hiện:** Sau khi vượt qua lỗi 400, tiến hành đăng nhập bằng Gmail thì Google hiện cảnh báo: _"n8n has not completed the Google verification process"_ kèm theo mã lỗi `Error 403: access_denied` và không cho phép cấp quyền.

**🔍 Nguyên nhân:** Ứng dụng n8n mà nhóm tạo trên nền tảng Google Cloud Console đang được đặt ở trạng thái **"Testing"** (Thử nghiệm). Ở chế độ bảo mật này, Google sẽ chặn toàn bộ người dùng đăng nhập, ngoại trừ những tài khoản Email được chỉ định đích danh vào danh sách "Người dùng thử nghiệm" (Test users).

**✅ Cách khắc phục:**
Thêm địa chỉ Email đang sử dụng vào danh sách Test users trên Google Cloud để được cấp quyền ưu tiên.

1. Truy cập vào **Google Cloud Console** và chọn dự án n8n vừa tạo.
2. Tại menu bên trái, chọn **APIs & Services** -> **OAuth consent screen**.
3. Cuộn trang xuống phía dưới cùng, tìm đến khu vực **Test users** (Người dùng thử nghiệm).
4. Bấm nút **+ ADD USERS**.
5. Nhập chính xác địa chỉ Email của bạn (Email chứa file Google Sheets cần lấy dữ liệu) và bấm **Save**.
6. Quay lại giao diện n8n và bấm _Sign in with Google_ một lần nữa.
7. _Lưu ý:_ Màn hình có thể hiện cảnh báo "Google hasn't verified this app". Hãy bấm vào nút **Advanced** (Nâng cao) -> Chọn **Go to n8n (unsafe)** -> Tích chọn các quyền truy cập và bấm **Continue** là hoàn tất kết nối!
