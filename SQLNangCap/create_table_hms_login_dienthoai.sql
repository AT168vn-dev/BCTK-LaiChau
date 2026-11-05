-- Tạo bảng hms_login_dienthoai để quản lý đăng nhập bằng điện thoại
CREATE TABLE IF NOT EXISTS hms_login_dienthoai (
    hld_id SERIAL PRIMARY KEY,
    hld_tendangnhap VARCHAR(100),
    hld_matkhau VARCHAR(255),
    hld_tenhienthi VARCHAR(255),
    hld_sodienthoai VARCHAR(20),
    hld_email VARCHAR(255),
    hld_token VARCHAR(255),
    hld_trangthai VARCHAR(10) DEFAULT '1', -- '1' = active, '0' = inactive
    hld_ngaytao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hld_ngaycapnhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_hld_tendangnhap ON hms_login_dienthoai(hld_tendangnhap);
CREATE INDEX IF NOT EXISTS idx_hld_sodienthoai ON hms_login_dienthoai(hld_sodienthoai);
CREATE INDEX IF NOT EXISTS idx_hld_token ON hms_login_dienthoai(hld_token);
CREATE INDEX IF NOT EXISTS idx_hld_tendangnhap_matkhau ON hms_login_dienthoai(hld_tendangnhap, hld_matkhau);
CREATE INDEX IF NOT EXISTS idx_hld_sodienthoai_token ON hms_login_dienthoai(hld_sodienthoai, hld_token);


