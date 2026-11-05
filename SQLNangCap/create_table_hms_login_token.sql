-- Tạo bảng hms_login_token để lưu mã token QR code cố định
CREATE TABLE IF NOT EXISTS hms_login_token (
    hlt_id SERIAL PRIMARY KEY,
    hlt_token VARCHAR(255) UNIQUE NOT NULL,
    hlt_qr_code_data TEXT, -- Lưu QR code image dưới dạng base64
    hlt_base_url VARCHAR(500), -- Lưu base URL để tạo QR code
    hlt_trangthai VARCHAR(10) DEFAULT '1', -- '1' = active, '0' = inactive
    hlt_ngaytao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hlt_ngaycapnhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_hlt_token ON hms_login_token(hlt_token);
CREATE INDEX IF NOT EXISTS idx_hlt_trangthai ON hms_login_token(hlt_trangthai);

-- Tạo trigger để tự động cập nhật hlt_ngaycapnhat
CREATE OR REPLACE FUNCTION update_hlt_ngaycapnhat()
RETURNS TRIGGER AS $$
BEGIN
    NEW.hlt_ngaycapnhat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hlt_ngaycapnhat
    BEFORE UPDATE ON hms_login_token
    FOR EACH ROW
    EXECUTE FUNCTION update_hlt_ngaycapnhat();

