pipeline {
    agent any

    environment {
        // ================= CẤU HÌNH VPS =================
        // THAY ĐỔI CÁC BIẾN SAU CHO PHÙ HỢP VỚI THỰC TẾ
        VPS_HOST = 'api.huuhai.me'
        VPS_USER = 'root' // Hoặc ubuntu/deploy... tuỳ hệ thống của bạn
        APP_DIR = '/root/app' // Thư mục bạn đang lưu app trên VPS
        JAR_NAME = 'automation-0.0.1-SNAPSHOT.jar'
        // ================================================
    }

    stages {
        stage('Checkout') {
            steps {
                // Tự động lấy code từ branch đã cấu hình trong Jenkins Job
                checkout scm
            }
        }

        stage('Backend - Build & Test') {
            steps {
                dir('backend') {
                    // Đảm bảo Maven Wrapper có quyền thực thi
                    sh 'chmod +x ./mvnw'
                    // Chạy build và bỏ qua bước test để tránh dính database thật
                    sh './mvnw clean package -DskipTests'
                    // Log ra xác nhận file Jar đã tạo
                    sh 'ls -la target/*.jar'
                }
            }
        }

        stage('Backend - Deploy to VPS') {
            steps {
                // Cần cài đặt plugin "SSH Agent" trong Jenkins
                // 'vps-ssh-key' là ID của Credentials chứa Private Key SSH của bạn trong Jenkins
                sshagent(credentials: ['vps-ssh-key']) {
                    sh '''
                        # 1. Đảm bảo thư mục tồn tại trên VPS trước khi copy
                        ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "mkdir -p ${APP_DIR}"

                        # 2. Đẩy file jar mới lên VPS đè file cũ
                        # Dùng -o StrictHostKeyChecking=no để tránh lỗi xác nhận fingerprint lần đầu
                        scp -o StrictHostKeyChecking=no backend/target/${JAR_NAME} ${VPS_USER}@${VPS_HOST}:${APP_DIR}/

                        # 3. Chạy lệnh trên VPS để kill app cũ và bắt đầu app mới
                        ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "
                            echo '==> Đang vào thư mục app...'
                            cd ${APP_DIR}
                            
                            echo '==> Tìm process đang chạy port 8080...'
                            pid=\\$(sudo lsof -t -i:8080)
                            
                            if [ ! -z \\"\\$pid\\" ]; then
                                echo \\"==> Đang tắt app cũ với PID: \\$pid\\"
                                sudo kill -9 \\$pid
                            else
                                echo '==> Không có app nào đang chạy ở port 8080.'
                            fi

                            echo '==> Đang khởi động app mới...'
                            nohup java -jar ${JAR_NAME} > log.txt 2>&1 &

                            echo '==> Đợi 5 giây để app bắt đầu...'
                            sleep 5
                            
                            echo '==> Cập nhật log ứng dụng 15 dòng...'
                            tail -n 15 log.txt
                        "
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "CI/CD Backend Deployment SUCCESSFUL!"
        }
        failure {
            echo "CI/CD Backend Deployment FAILED! Vui lòng kiểm tra lại log."
        }
    }
}
