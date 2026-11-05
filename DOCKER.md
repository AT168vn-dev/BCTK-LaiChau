# Build & chạy Docker

## Cài đặt Docker Desktop

https://www.docker.com/products/docker-desktop/

## Chuẩn bị

1. Sao chép file môi trường:

```powershell
Copy-Item .env.example .env
```

2. Sửa `.env` với thông tin PostgreSQL và `SESSION_SECRET`.

3. Nếu PostgreSQL chạy trên **máy Windows host** (không trong Docker), đặt:

```
PGHOST=host.docker.internal
```

Nếu DB nằm trong mạng LAN (vd. `192.168.0.252`), giữ nguyên IP — container phải truy cập được mạng đó.

## Build image

```powershell
cd D:\DEV\BCTK-DHY
docker build -t bctk-dhy:latest .
```

## Chạy bằng Docker Compose (khuyến nghị)

```powershell
docker compose up --build -d
```

Mở trình duyệt: http://localhost:3000

Đổi cổng host:

```powershell
$env:HOST_PORT=8080; docker compose up -d
```

Hoặc thêm `HOST_PORT=8080` vào file `.env`.

Dừng container:

```powershell
docker compose down
```

## Chạy bằng docker run

```powershell
docker run -d `
  --name bctk-dhy `
  -p 3000:3000 `
  --env-file .env `
  -v "${PWD}/uploads:/app/uploads" `
  -v "${PWD}/public/translations:/app/public/translations" `
  bctk-dhy:latest
```

## Xuất image để mang sang máy khác

```powershell
docker save -o bctk-dhy.tar bctk-dhy:latest
```

Trên máy đích:

```powershell
docker load -i bctk-dhy.tar
docker compose up -d
```
Lệnh dùng:

docker compose down
Chỉ tạm dừng (không xóa container), dùng:

docker compose stop

## Lưu ý

- **Volume:** `uploads/` và `public/translations/` được mount ra host để không mất dữ liệu khi rebuild container.
- **PostgreSQL:** Ứng dụng kết nối DB qua biến `PG*` trong `.env`. Đảm bảo firewall cho phép container truy cập DB.
- **Production:** Đổi `SESSION_SECRET` và không commit file `.env`.
- Trên Windows PowerShell dùng dấu `` ` `` để xuống dòng trong lệnh dài.
