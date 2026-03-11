# Task-Priority-and-Deadline-Alert-Automation
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
