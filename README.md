# 🛠️ Hướng Dẫn Xử Lý Lỗi Xác Thực Google API (OAuth) Trên n8n Docker

Trong quá trình triển khai hệ thống Automation bằng n8n trên môi trường Docker, nhóm đã gặp và giải quyết thành công 2 lỗi bảo mật khắt khe từ phía Google. Dưới đây là tài liệu ghi chú cách khắc phục để các thành viên khác hoặc người triển khai sau có thể nắm bắt.

---

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
6. Quay lại giao diện n8n và bấm *Sign in with Google* một lần nữa.
7. *Lưu ý:* Màn hình có thể hiện cảnh báo "Google hasn't verified this app". Hãy bấm vào nút **Advanced** (Nâng cao) -> Chọn **Go to n8n (unsafe)** -> Tích chọn các quyền truy cập và bấm **Continue** là hoàn tất kết nối!


# 🛠️  Setup Frontend React + Vite

## 1. Cài đặt môi trường Node.js (Sử dụng NVM)

Nếu máy tính chưa cài đặt NVM, tiến hành chạy lệnh sau trên Terminal:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
```

Cài đặt và thiết lập Node.js phiên bản 22 làm mặc định:
```bash
nvm install 22
nvm use 22
nvm alias default 22
```

Kiểm tra lại để chắc chắn quá trình cài đặt đã thành công:
```bash
node -v
npm -v
```

## 2. Khởi tạo dự án React bằng Vite


Chạy lệnh khởi tạo project với tên `frontend` bằng template React:
```bash
npm create vite@latest frontend -- --template react
```

Di chuyển vào thư mục dự án vừa được tạo:
```bash
cd frontend
```

Cài đặt các gói phụ thuộc (dependencies) mặc định của Vite:
```bash
npm install
```

## 3. Cài đặt các thư viện hỗ trợ thiết yếu


Đảm bảo bạn đang ở trong thư mục `frontend/`, chạy lệnh sau để cài đặt đồng loạt các thư viện:
```bash
npm install react-router-dom axios zustand lucide-react recharts
```

*(Lưu ý: Sau khi cài đặt hoàn tất, bạn có thể khởi chạy server bằng lệnh `npm run dev` và truy cập địa chỉ `http://localhost:5173/` trên trình duyệt để kiểm tra kết quả).*
Dưới đây là phần **Setup Backend (Spring Boot)** được định dạng lại đồng nhất với phong cách của các phần trước, kèm theo các khối code chuẩn để bạn dễ dàng sao chép và dán thẳng vào Terminal:

# 🛠️ Setup Backend (Spring Boot)

## 1. Cài đặt Java 17

Cập nhật danh sách gói phần mềm và tiến hành cài đặt OpenJDK 17:
```bash
sudo apt update
sudo apt install openjdk-17-jdk -y
```

*(Lưu ý: Sau khi cài xong, bạn có thể kiểm tra lại bằng lệnh `java -version`)*

## 2. Cài đặt Maven


Chạy lệnh sau để cài đặt Maven:
```bash
sudo apt install maven -y
```

*(Lưu ý: Kiểm tra lại quá trình cài đặt bằng lệnh `mvn -version`)*

## 3. Khởi chạy ứng dụng


Đảm bảo bạn đang đứng ở thư mục gốc của dự án backend (nơi chứa file `pom.xml`), sau đó chạy lệnh:
```bash
mvn spring-boot:run
```
