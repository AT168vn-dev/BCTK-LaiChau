const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');  // Thêm express-session để quản lý phiên làm việc
const { Pool } = require('pg');
const os = require('os');
const QRCode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');
const pdfParseModule = require('pdf-parse');
// pdf-parse version 2.x export object, cần sử dụng trực tiếp hoặc PDFParse class
const pdfParse = pdfParseModule.default || pdfParseModule;
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { translate } = require('@vitalets/google-translate-api');

require('dotenv').config(); // Sử dụng dotenv để tải các biến môi trường

const app = express();
const PORT = 3000;
const host = '0.0.0.0';
//const host = 'localhost';

//const companyName = 'BÁO CÁO THỐNG KÊ - TTYT Huyện Chư Sê';
//const companyName = 'BÁO CÁO THỐNG KÊ - BỆNH VIỆN TRƯỜNG ĐHYK VINH';
//const companyName = 'BÁO CÁO THỐNG KÊ - BỆNH VIỆN PHONG DA LIỄU TRUNG ƯƠNG QUỲNH LẬP';
//const companyName = 'BÁO CÁO THỐNG KÊ - BỆNH VIỆN ĐA KHOA TÂM ANH';
const companyName = 'BÁO CÁO THỐNG KÊ - BỆNH VIỆN ĐA KHOA TỈNH LAI CHÂU';
const logoImageBV = '/images/LogoBV.jpg';
const LICENSE_WARNING_DAYS = 10;

function getVietnamNow() {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
}

function isLicenseExpired(sc_startdatetime) {
    if (!sc_startdatetime) return false;
    return new Date(sc_startdatetime) < getVietnamNow();
}

function getLicenseDaysRemaining(sc_startdatetime) {
    if (!sc_startdatetime) return null;

    const vietnamTime = getVietnamNow();
    const expiry = new Date(sc_startdatetime);

    const todayStart = new Date(vietnamTime);
    todayStart.setHours(0, 0, 0, 0);

    const expiryStart = new Date(expiry);
    expiryStart.setHours(0, 0, 0, 0);

    return Math.round((expiryStart - todayStart) / (1000 * 60 * 60 * 24));
}

function formatLicenseExpiryDisplay(sc_startdatetime) {
    if (!sc_startdatetime) return '';

    return new Date(sc_startdatetime).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/* PG LAI CHAU */

const pool = new Pool({
    user: 'vimes',
    host: '27.72.167.155',
    database: 'vimes_jsc',
    password: 'vimesjsc2009',
    port: '5432',
});


// Sử dụng session để quản lý phiên làm việc
app.use(session({
    secret: process.env.SESSION_SECRET || 'AnhTuan168vn',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 giờ (thời gian sống của session)
        secure: false // Đặt thành true nếu bạn sử dụng HTTPS
    }
}));

// Cấu hình thư mục chứa các tệp tĩnh
app.use(express.static('public'));

// Cấu hình multer để upload file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'translation-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file PDF!'), false);
        }
    }
});

// Multer cho PDF và ảnh (dùng cho chuyển đổi PDF/ảnh sang Word)
const uploadPdfImage = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'pdftoword-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: function (req, file, cb) {
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/tiff'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file PDF hoặc ảnh (JPG, PNG, GIF, BMP, TIFF)!'), false);
        }
    }
});

// Cấu hình EJS làm view engine
app.set('view engine', 'ejs');

// Sử dụng body-parser để xử lý dữ liệu từ form
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Store để lưu trữ QR code tokens (trong production nên dùng Redis)
const qrTokenStore = new Map(); // { token: { status: 'pending'|'confirmed'|'expired', userId: string, createdAt: Date } }

// Token QR code cố định cho toàn bộ web (lưu trong database)
let FIXED_QR_TOKEN = null;
let fixedQRCodeDataUrl = null;

// Hàm khởi tạo token từ database
async function initializeFixedQRToken() {
    try {
        // Kiểm tra xem đã có token trong database chưa
        const result = await pool.query(`
            SELECT hlt_token, hlt_qr_code_data, hlt_base_url 
            FROM hms_login_token 
            WHERE hlt_trangthai = '1' 
            ORDER BY hlt_ngaytao DESC 
            LIMIT 1
        `);
        
        if (result.rows.length > 0) {
            // Đã có token, sử dụng token cũ
            FIXED_QR_TOKEN = result.rows[0].hlt_token;
            fixedQRCodeDataUrl = result.rows[0].hlt_qr_code_data;
            console.log('Đã tải token QR code từ database:', FIXED_QR_TOKEN);
        } else {
            // Chưa có token, tạo token mới
            FIXED_QR_TOKEN = crypto.randomUUID();
            console.log('Đã tạo token QR code mới:', FIXED_QR_TOKEN);
            
            // Lưu token mới vào database (QR code sẽ được tạo khi có request đầu tiên)
            await pool.query(`
                INSERT INTO hms_login_token (hlt_token, hlt_trangthai)
                VALUES ($1, '1')
            `, [FIXED_QR_TOKEN]);
            
            console.log('Đã lưu token mới vào database');
        }
        
        // Lưu token vào store với status pending (không bao giờ hết hạn)
        qrTokenStore.set(FIXED_QR_TOKEN, {
            status: 'pending',
            createdAt: new Date(),
            isFixed: true // Đánh dấu là token cố định
        });
        
    } catch (err) {
        console.error('Lỗi khởi tạo token QR code:', err);
        // Nếu có lỗi, tạo token tạm thời
        FIXED_QR_TOKEN = crypto.randomUUID();
        qrTokenStore.set(FIXED_QR_TOKEN, {
            status: 'pending',
            createdAt: new Date(),
            isFixed: true
        });
        console.log('Đã tạo token tạm thời:', FIXED_QR_TOKEN);
    }
}

// Khởi tạo token khi server start
initializeFixedQRToken();

// Xóa token hết hạn (sau 5 phút) - nhưng không xóa token cố định
setInterval(() => {
    const now = new Date();
    for (const [token, data] of qrTokenStore.entries()) {
        // Bỏ qua token cố định
        if (data.isFixed) continue;
        
        const age = now - data.createdAt;
        if (age > 5 * 60 * 1000) { // 5 phút
            qrTokenStore.delete(token);
        }
    }
}, 60000); // Kiểm tra mỗi phút

// Route để hiển thị form đăng nhập
app.get('/login', async (req, res) => {
    try {
        // Lấy giá trị hms_online_qr từ bảng hms_config
        const configQuery = 'SELECT hms_online_qr FROM hms_config LIMIT 1';
        const configResult = await pool.query(configQuery);
        const hmsOnlineQr = configResult.rows[0]?.hms_online_qr || 'N';
        
        res.render('login', {
            showQRLogin: hmsOnlineQr === 'Y'
        });
    } catch (error) {
        console.error('Lỗi khi lấy cấu hình:', error);
        // Nếu có lỗi, mặc định không hiển thị QR
        res.render('login', {
            showQRLogin: false
        });
    }
});

// Đăng nhập
app.get('/', async (req, res) => {
    try {
        // Lấy thông tin công ty
        const companyQuery = 'SELECT sc_name, sc_startdatetime FROM sys_company';
        const companyResult = await pool.query(companyQuery);

        const sc_startdatetime = companyResult.rows[0]?.sc_startdatetime;

        if (isLicenseExpired(sc_startdatetime)) {
            return res.render('thongbao');
        }

        // Kiểm tra đăng nhập
        if (!req.session.loggedin) {
            return res.render('login');
        }

        // Nếu đã đăng nhập, lấy thông tin người dùng
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userQuery = 'SELECT su_image_user FROM sys_user WHERE su_userid = $1';

        const userResult = await pool.query(userQuery, [req.session.userid]);
        const userImage = userResult.rows.length > 0 ? userResult.rows[0].su_image_user : '/path/to/default-image.png';

        const licenseDaysRemaining = getLicenseDaysRemaining(sc_startdatetime);
        const licenseExpiryDisplay = formatLicenseExpiryDisplay(sc_startdatetime);

        res.render('index', {
            fullname: req.session.fullname,
            ip: ipAddress,
            userImage: userImage,
            companyName: companyName,
            logoImageBV: logoImageBV,
            isAdmin: req.session.isAdmin,
            licenseDaysRemaining,
            licenseExpiryDisplay,
            showLicenseWarning: licenseDaysRemaining !== null
                && licenseDaysRemaining <= LICENSE_WARNING_DAYS
                && licenseDaysRemaining >= 0
        });
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).send('Lỗi server');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Kiểm tra thời gian hiệu lực trước
        const companyQuery = 'SELECT sc_name, sc_startdatetime FROM sys_company';
        const companyResult = await pool.query(companyQuery);
        const sc_startdatetime = companyResult.rows[0]?.sc_startdatetime;

        // Chuyển đổi thời gian hiện tại sang múi giờ Việt Nam
        const now = new Date();
        const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

        // Chuyển đổi sc_startdatetime thành đối tượng Date
        const startDateTime = new Date(sc_startdatetime);

        // Kiểm tra thời gian hiệu lực
        if (sc_startdatetime && startDateTime < vietnamTime) {
            return res.render('thongbao');
        }

        // Nếu thời gian hợp lệ, tiếp tục xử lý đăng nhập
        const result = await pool.query(`
            SELECT su_userid, su_name, su_tel, su_password, su_deptid, su_setup_bckt, su_setup_qt 
            FROM sys_user 
            WHERE su_userid = $1`, [username]);

        if (result.rows.length > 0) {
            const user = result.rows[0];

            // Kiểm tra mật khẩu
            if (password === user.su_password) {
                // Kiểm tra quyền truy cập
                if (user.su_setup_bckt === '01') {
                    // Lưu thông tin đăng nhập vào sys_logins
                    const ipAddress = req.ip || req.connection.remoteAddress;
                    const computerName = os.hostname();

                    await pool.query(
                        `INSERT INTO sys_logins (ssl_userid, ssl_username, ssl_login_time, ssl_computer_name, ssl_ip_address)
                        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
                        [user.su_userid, user.su_name, computerName, ipAddress]
                    );

                    // Thiết lập session
                    req.session.loggedin = true;
                    req.session.fullname = user.su_name;
                    req.session.userid = user.su_userid;
                    req.session.deptid = user.su_deptid;
                    req.session.isAdmin = user.su_setup_qt === '01';

                    // Chuyển hướng đến trang chính với flag để mở trang hoạt động bệnh viện
                    return res.redirect('/?loadHoatDongBenhVien=true');
                } else {
                    return res.render('login', { error: 'Bạn không có quyền truy cập Hệ thống.<br>Vui lòng liên hệ Admin!' });
                }
            } else {
                return res.render('login', { error: 'Mật khẩu không đúng!' });
            }
        } else {
            return res.render('login', { error: 'Tên đăng nhập không tồn tại!' });
        }
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        return res.render('login', { error: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return console.log(err);
        }
        res.redirect('/login'); // Chuyển hướng về trang đăng nhập sau khi đăng xuất
    });
});

// ========== QR CODE AUTHENTICATION ROUTES ==========

// Trang dashboard cho người dùng đăng nhập bằng QR code
app.get('/qr-dashboard', async (req, res) => {
    // Kiểm tra đăng nhập
    if (!req.session.loggedin || !req.session.isQRLogin) {
        return res.redirect('/login');
    }
    
    try {
        res.render('qr-dashboard', {
            fullname: req.session.fullname || 'Người dùng',
            userid: req.session.userid
        });
    } catch (err) {
        console.error('Lỗi render qr-dashboard:', err);
        res.status(500).send('Lỗi server');
    }
});

// Trả về QR code cố định (không tạo mới mỗi lần)
app.get('/api/qr/generate', async (req, res) => {
    try {
        // Đảm bảo token đã được khởi tạo
        if (!FIXED_QR_TOKEN) {
            await initializeFixedQRToken();
        }
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const qrUrl = `${baseUrl}/qr/confirm/${FIXED_QR_TOKEN}`;
        
        // Nếu chưa có QR code hoặc baseUrl thay đổi, tạo lại và lưu vào database
        if (!fixedQRCodeDataUrl) {
            fixedQRCodeDataUrl = await QRCode.toDataURL(qrUrl);
            console.log('QR Code cố định đã được tạo với URL:', qrUrl);
            
            // Lưu QR code vào database
            try {
                await pool.query(`
                    UPDATE hms_login_token 
                    SET hlt_qr_code_data = $1, hlt_base_url = $2
                    WHERE hlt_token = $3
                `, [fixedQRCodeDataUrl, baseUrl, FIXED_QR_TOKEN]);
            } catch (dbErr) {
                console.error('Lỗi lưu QR code vào database:', dbErr);
            }
        } else {
            // Kiểm tra xem baseUrl có thay đổi không
            try {
                const tokenResult = await pool.query(`
                    SELECT hlt_base_url FROM hms_login_token 
                    WHERE hlt_token = $1
                `, [FIXED_QR_TOKEN]);
                
                if (tokenResult.rows.length > 0 && tokenResult.rows[0].hlt_base_url !== baseUrl) {
                    // BaseUrl đã thay đổi, tạo lại QR code
                    fixedQRCodeDataUrl = await QRCode.toDataURL(qrUrl);
                    await pool.query(`
                        UPDATE hms_login_token 
                        SET hlt_qr_code_data = $1, hlt_base_url = $2
                        WHERE hlt_token = $3
                    `, [fixedQRCodeDataUrl, baseUrl, FIXED_QR_TOKEN]);
                    console.log('QR Code đã được cập nhật với baseUrl mới:', baseUrl);
                }
            } catch (dbErr) {
                console.error('Lỗi kiểm tra baseUrl:', dbErr);
            }
        }
        
        res.json({
            token: FIXED_QR_TOKEN,
            qrCode: fixedQRCodeDataUrl,
            url: qrUrl
        });
    } catch (err) {
        console.error('Lỗi tạo QR code:', err);
        res.status(500).json({ error: 'Không thể tạo QR code' });
    }
});

// Trang xác nhận trên điện thoại
app.get('/qr/confirm/:token', async (req, res) => {
    const { token } = req.params;
    const tokenData = qrTokenStore.get(token);
    
    if (!tokenData) {
        return res.render('qr-confirm', { 
            error: 'Mã QR không hợp lệ hoặc đã hết hạn',
            token: token,
            status: 'expired'
        });
    }
    
    if (tokenData.status === 'confirmed') {
        return res.render('qr-confirm', { 
            message: 'Đã xác nhận thành công!',
            token: token,
            status: 'confirmed'
        });
    }
    
    // Lưu token vào qrTokenStore để sử dụng sau
    tokenData.qrToken = token;
    
    res.render('qr-confirm', { 
        token: token,
        status: 'pending',
        qrToken: token // Token để hiển thị cho người dùng
    });
});

// API để xác nhận từ điện thoại
app.post('/api/qr/confirm/:token', async (req, res) => {
    const { token } = req.params;
    const { confirm } = req.body;
    const tokenData = qrTokenStore.get(token);
    
    if (!tokenData) {
        return res.status(404).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
    
    if (confirm === 'ok') {
        tokenData.status = 'confirmed';
        tokenData.confirmedAt = new Date();
        res.json({ success: true, message: 'Xác nhận thành công' });
        
        // Nếu là token cố định, reset lại status sau 30 giây để có thể xác nhận lần sau
        if (tokenData.isFixed) {
            setTimeout(() => {
                const fixedTokenData = qrTokenStore.get(FIXED_QR_TOKEN);
                if (fixedTokenData) {
                    fixedTokenData.status = 'pending';
                    delete fixedTokenData.confirmedAt;
                }
            }, 30000); // Reset sau 30 giây
        }
    } else {
        tokenData.status = 'rejected';
        res.json({ success: false, message: 'Đã từ chối' });
        
        // Nếu là token cố định, reset lại status sau 5 giây
        if (tokenData.isFixed) {
            setTimeout(() => {
                const fixedTokenData = qrTokenStore.get(FIXED_QR_TOKEN);
                if (fixedTokenData) {
                    fixedTokenData.status = 'pending';
                    delete fixedTokenData.rejectedAt;
                }
            }, 5000); // Reset sau 5 giây
        }
    }
});

// API để kiểm tra trạng thái token
app.get('/api/qr/status/:token', (req, res) => {
    const { token } = req.params;
    const tokenData = qrTokenStore.get(token);
    
    if (!tokenData) {
        return res.json({ status: 'expired', message: 'Token không tồn tại hoặc đã hết hạn' });
    }
    
    res.json({ 
        status: tokenData.status,
        message: tokenData.status === 'confirmed' ? 'Đã xác nhận' : 
                 tokenData.status === 'rejected' ? 'Đã từ chối' : 'Đang chờ xác nhận'
    });
});

// API để đăng nhập sau khi xác nhận QR code (sử dụng bảng hms_login_dienthoai)
app.post('/api/qr/login/:token', async (req, res) => {
    const { token } = req.params;
    const tokenData = qrTokenStore.get(token);
    
    if (!tokenData || tokenData.status !== 'confirmed') {
        return res.status(400).json({ error: 'Token chưa được xác nhận hoặc đã hết hạn' });
    }
    
    try {
        // Kiểm tra thời gian hiệu lực
        const companyQuery = 'SELECT sc_name, sc_startdatetime FROM sys_company';
        const companyResult = await pool.query(companyQuery);
        const sc_startdatetime = companyResult.rows[0]?.sc_startdatetime;
        
        const now = new Date();
        const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const startDateTime = new Date(sc_startdatetime);
        
        if (sc_startdatetime && startDateTime < vietnamTime) {
            qrTokenStore.delete(token);
            return res.status(403).json({ error: 'Hệ thống đã hết hạn' });
        }
        
        if (!tokenData.hldId) {
            return res.status(400).json({ error: 'Chưa có thông tin người dùng' });
        }
        
        // Lấy thông tin người dùng từ bảng hms_login_dienthoai
        const result = await pool.query(`
            SELECT hld_id, hld_tendangnhap, hld_sodienthoai, hld_trangthai
            FROM hms_login_dienthoai 
            WHERE hld_id = $1 AND hld_trangthai = '1'
        `, [tokenData.hldId]);
        
        if (result.rows.length === 0) {
            // Chỉ xóa token nếu không phải token cố định
            if (!tokenData.isFixed) {
                qrTokenStore.delete(token);
            }
            return res.status(404).json({ error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' });
        }
        
        const user = result.rows[0];
        
        // Lưu thông tin đăng nhập vào sys_logins
        const ipAddress = req.ip || req.connection.remoteAddress;
        const computerName = os.hostname();
        
        await pool.query(
            `INSERT INTO sys_logins (ssl_userid, ssl_username, ssl_login_time, ssl_computer_name, ssl_ip_address)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
            [user.hld_tendangnhap || user.hld_sodienthoai, user.hld_tendangnhap || user.hld_sodienthoai, computerName, ipAddress]
        );
        
        // Thiết lập session
        req.session.loggedin = true;
        req.session.fullname = user.hld_tendangnhap || user.hld_sodienthoai;
        req.session.userid = user.hld_tendangnhap || user.hld_sodienthoai;
        req.session.isQRLogin = true; // Đánh dấu đăng nhập bằng QR
        req.session.hldId = user.hld_id;
        
        // Chỉ xóa token nếu không phải token cố định
        if (!tokenData.isFixed) {
            qrTokenStore.delete(token);
        } else {
            // Reset status của token cố định sau khi đăng nhập thành công
            tokenData.status = 'pending';
            delete tokenData.hldId;
            delete tokenData.userId;
            delete tokenData.userName;
            delete tokenData.phoneNumber;
        }
        
        res.json({ 
            success: true, 
            redirect: '/qr-dashboard' 
        });
    } catch (err) {
        console.error('Lỗi đăng nhập QR:', err);
        qrTokenStore.delete(token);
        res.status(500).json({ error: 'Có lỗi xảy ra khi đăng nhập' });
    }
});

// API để xác thực người dùng từ bảng hms_login_dienthoai
app.post('/api/qr/authenticate/:token', async (req, res) => {
    const { token } = req.params;
    const { username, password, phoneNumber, qrToken } = req.body;
    const tokenData = qrTokenStore.get(token);
    
    if (!tokenData) {
        return res.status(404).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
    
    try {
        let user = null;
        
        // Kiểm tra đăng nhập bằng username + password
        if (username && password) {
            const result = await pool.query(`
                SELECT hld_id, hld_tendangnhap, hld_matkhau, hld_sodienthoai, hld_token, hld_trangthai
                FROM hms_login_dienthoai 
                WHERE hld_tendangnhap = $1 AND hld_matkhau = $2 AND hld_trangthai = '1'
            `, [username, password]);
            
            if (result.rows.length > 0) {
                user = result.rows[0];
            }
        }
        
        // Nếu chưa tìm thấy, kiểm tra bằng số điện thoại (không cần token vì mỗi QR code có token khác)
        // Chỉ cần kiểm tra số điện thoại có tồn tại trong database
        if (!user && phoneNumber) {
            const result = await pool.query(`
                SELECT hld_id, hld_tendangnhap, hld_matkhau, hld_sodienthoai, hld_token, hld_trangthai
                FROM hms_login_dienthoai 
                WHERE hld_sodienthoai = $1 AND hld_trangthai = '1'
            `, [phoneNumber]);
            
            if (result.rows.length > 0) {
                user = result.rows[0];
            }
        }
        
        if (!user) {
            return res.status(404).json({ 
                error: 'Tài khoản không tồn tại hoặc thông tin không đúng!',
                needRegister: true 
            });
        }
        
        // Lưu thông tin vào token
        tokenData.userId = user.hld_tendangnhap || user.hld_sodienthoai;
        tokenData.userName = user.hld_tendangnhap || user.hld_sodienthoai;
        tokenData.hldId = user.hld_id;
        tokenData.phoneNumber = user.hld_sodienthoai;
        
        res.json({ success: true, message: 'Xác thực thành công' });
    } catch (err) {
        console.error('Lỗi xác thực người dùng:', err);
        res.status(500).json({ error: 'Có lỗi xảy ra' });
    }
});

// API để đăng ký tài khoản điện thoại mới
app.post('/api/qr/register/:token', async (req, res) => {
    const { token } = req.params;
    const { username, password, phoneNumber, email, displayName, qrToken } = req.body;
    const tokenData = qrTokenStore.get(token);
    
    if (!tokenData) {
        return res.status(404).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
    
    try {
        // Kiểm tra tài khoản đã tồn tại chưa
        const checkUser = await pool.query(`
            SELECT hld_id FROM hms_login_dienthoai 
            WHERE hld_tendangnhap = $1 OR hld_sodienthoai = $2 OR hld_email = $3
        `, [username, phoneNumber, email]);
        
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'Tên đăng nhập, số điện thoại hoặc email đã tồn tại!' });
        }
        
        // Tạo tài khoản mới (không lưu token vì mỗi QR code có token khác)
        // Token chỉ dùng để xác định session QR code hiện tại
        const result = await pool.query(`
            INSERT INTO hms_login_dienthoai (hld_tendangnhap, hld_matkhau, hld_tenhienthi, hld_sodienthoai, hld_email, hld_token, hld_trangthai)
            VALUES ($1, $2, $3, $4, $5, NULL, '1')
            RETURNING hld_id, hld_tendangnhap, hld_sodienthoai, hld_email, hld_tenhienthi
        `, [username, password, displayName, phoneNumber, email]);
        
        if (result.rows.length > 0) {
            const newUser = result.rows[0];
            
            // Lưu thông tin vào token
            tokenData.userId = newUser.hld_tendangnhap;
            tokenData.userName = newUser.hld_tenhienthi || newUser.hld_tendangnhap;
            tokenData.hldId = newUser.hld_id;
            tokenData.phoneNumber = newUser.hld_sodienthoai;
            
            res.json({ success: true, message: 'Đăng ký thành công!' });
        } else {
            res.status(500).json({ error: 'Không thể tạo tài khoản' });
        }
    } catch (err) {
        console.error('Lỗi đăng ký:', err);
        res.status(500).json({ error: 'Có lỗi xảy ra khi đăng ký' });
    }
});

// API để lấy tổng số lượt truy cập từ bảng sys_logins
app.get('/api/total-logins', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) AS total FROM sys_logins');
        const totalLogins = result.rows[0].total;
        res.json({ total: totalLogins });
    } catch (err) {
        console.error('Lỗi khi lấy tổng số lượt truy cập:', err.message);
        res.status(500).json({ error: 'Có lỗi xảy ra khi lấy tổng số lượt truy cập' });
    }
});


// Route để lấy danh sách người sử dụng
app.get('/dm-nguoisudung', async (req, res) => {
    try {
        const query = `
            SELECT 
                su_userid AS ma_nsd,
                su_name AS ho_ten,
                su_password AS mat_khau,
                su_certificate AS chungchi_hanhnghe, 
                su_deptid AS ma_khoa,
                su_tel AS sodt,
                su_setup_bckt
            FROM sys_user ORDER BY su_name
        `;
        const result = await pool.query(query);

        res.render('dm-nguoisudung', { data: result.rows });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách người sử dụng:', err.message);
        res.status(500).send('Có lỗi xảy ra khi lấy danh sách người sử dụng');
    }
});

// Route để lấy danh sách người sử dụng
app.get('/dm-nguoisudung-pq', async (req, res) => {
    try {
        const query = `
            SELECT 
                su_userid AS ma_nsd,
                su_name AS ho_ten,
                su_password AS mat_khau,
                su_certificate AS chungchi_hanhnghe, 
                su_deptid AS ma_khoa,
                su_tel AS sodt,
                su_setup_bckt
            FROM sys_user ORDER BY su_name
        `;
        const result = await pool.query(query);

        res.render('dm-nguoisudung-pq', { data: result.rows });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách người sử dụng:', err.message);
        res.status(500).send('Có lỗi xảy ra khi lấy danh sách người sử dụng');
    }
});

app.get('/dm-lienhe', async (req, res) => {
    res.render('dm-lienhe');
});

app.get('/dm-nguoisudung/check/:maNSD', async (req, res) => {
    const maNSD = req.params.maNSD;

    try {
        const query = 'SELECT COUNT(*) FROM sys_user WHERE su_userid = $1';
        const result = await pool.query(query, [maNSD]);

        res.json({ exists: result.rows[0].count > 0 });
    } catch (err) {
        console.error('Error checking user existence:', err.message);
        res.status(500).json({ error: 'Server error occurred' });
    }
});

app.get('/dm-nguoisudung-reload', async (req, res) => {
    try {
        const query = `
            SELECT 
                su_userid AS ma_nsd,
                su_name AS ho_ten,
                su_password AS mat_khau,
                su_deptid AS ma_khoa,
                su_certificate AS chungchi_hanhnghe,
                su_tel AS sodt,
                su_setup_bckt 
            FROM sys_user ORDER BY su_name
        `;
        const result = await pool.query(query);
        res.json(result.rows); // Return user list as JSON
    } catch (err) {
        console.error('Error fetching user list:', err.message);
        res.status(500).json({ error: 'Server error occurred' });
    }
});


//Tìm kiếm ngời sử dụng
app.get('/dm-nguoisudung/tim-kiem-nsd', async (req, res) => {
    const { name } = req.query;
    try {
        //console.log('Tìm kiếm:', name); // Kiểm tra giá trị tìm kiếm
        const query = `SELECT 
                su_userid AS ma_nsd,
                su_name AS ho_ten,
                su_password AS mat_khau,
                su_certificate AS chungchi_hanhnghe,
                su_deptid AS ma_khoa,
                su_tel AS sodt,
                su_setup_bckt 
            FROM sys_user 
            WHERE su_name ILIKE $1 OR su_userid ILIKE $1
            ORDER BY su_name
        `;
        const values = [`%${name}%`];
        const result = await pool.query(query, values);

        //console.log(result.rows); // Kiểm tra dữ liệu trả về
        res.json(result.rows); // Trả về dữ liệu dưới dạng JSON
    } catch (err) {
        console.error('Lỗi khi tìm kiếm danh sách người sử dụng:', err.message);
        res.status(500).json({ error: 'Có lỗi xảy ra khi tìm kiếm danh sách người sử dụng' });
    }
});

// Route để lấy danh sách khoa từ bảng sys_dept
app.get('/dm-khoa', async (req, res) => {
    try {
        const query = 'SELECT sd_id, sd_name FROM sys_dept WHERE sd_isactive = \'Y\' ORDER BY sd_name';
        const result = await pool.query(query);

        // Đảm bảo bạn trả về đúng định dạng
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách khoa:', err.message);
        res.status(500).json({ error: 'Có lỗi xảy ra khi lấy danh sách khoa' });
    }
});

// Route để tìm kiếm khoa theo từ khóa sd_id hoặc sd_name
app.get('/dm-khoa/tim-kiem', async (req, res) => {
    const keyword = req.query.keyword || ''; // Lấy từ khóa tìm kiếm từ query params
    try {
        const query = `
            SELECT sd_id, sd_name 
            FROM sys_dept 
            WHERE (sd_id ILIKE $1 OR sd_name ILIKE $1) 
            AND sd_active = 'Y'
            ORDER BY sd_name
        `;
        const values = [`%${keyword}%`]; // Sử dụng keyword để tìm kiếm
        const result = await pool.query(query, values);

        res.json(result.rows); // Trả về kết quả dưới dạng JSON
    } catch (err) {
        console.error('Lỗi khi tìm kiếm khoa:', err.message);
        res.status(500).json({ error: 'Có lỗi xảy ra khi tìm kiếm khoa' });
    }
});


app.get('/get-dept-name/:ma_khoa', async (req, res) => {
    const maKhoa = req.params.ma_khoa.trim();
    try {
        const query = 'SELECT sd_name FROM sys_dept WHERE sd_id = $1';
        const result = await pool.query(query, [maKhoa]);

        if (result.rows.length > 0) {
            res.json({ deptName: result.rows[0].sd_name });
        } else {
            res.json({ deptName: '' }); // Nếu không tìm thấy khoa
        }
    } catch (err) {
        console.error('Error fetching dept name:', err);
        res.status(500).json({ error: 'Lỗi khi lấy tên khoa' });
    }
});

app.post('/dm-nguoisudung/add', async (req, res) => {
    const { ma_nsd, ho_ten, mat_khau, cchn, ma_khoa, sodt } = req.body;

    try {
        const query = `
            INSERT INTO sys_user (su_userid, su_name, su_password, su_certificate, su_deptid, su_tel)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const values = [ma_nsd, ho_ten, mat_khau, cchn, ma_khoa, sodt];

        await pool.query(query, values);

        res.json({ success: true, message: 'Thêm người sử dụng thành công' });
    } catch (err) {
        console.error('Lỗi khi thêm người sử dụng:', err.message);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi thêm người sử dụng' });
    }
});

// Route để cập nhật thông tin người sử dụng
app.put('/dm-nguoisudung/update/:userid', async (req, res) => {
    const { userid } = req.params;
    const { ho_ten, sodt, mat_khau, ma_khoa, cchn } = req.body;

    try {
        const query = `
            UPDATE sys_user
            SET su_name = $1, su_tel = $2, su_password = $3, su_deptid = $4, su_certificate = $5
            WHERE su_userid = $6
        `;
        const values = [ho_ten, sodt, mat_khau, ma_khoa, cchn, userid];

        await pool.query(query, values);

        res.json({ success: true, message: 'Cập nhật người sử dụng thành công' });
    } catch (err) {
        console.error('Lỗi khi cập nhật người sử dụng:', err.message);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi cập nhật người sử dụng' });
    }
});

// Route để xóa người sử dụng
app.delete('/dm-nguoisudung/delete/:userid', async (req, res) => {
    const { userid } = req.params;

    try {
        const query = 'DELETE FROM sys_user WHERE su_userid = $1';
        await pool.query(query, [userid]);

        res.json({ success: true, message: 'Xóa người sử dụng thành công' });
    } catch (err) {
        console.error('Lỗi khi xóa người sử dụng:', err.message);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi xóa người sử dụng' });
    }
});

app.get('/get-nguoisudung/:zMaNSD', async (req, res) => {
    const zMaNSD = req.params.zMaNSD;

    try {
        const query = `
            SELECT 
                    su_userid AS ma_nsd,
                    su_name AS ho_ten,
                    su_password AS mat_khau,
                    su_deptid AS ma_khoa,
                    su_certificate AS chungchi_hanhnghe,
                    su_tel AS sodt,
                    su_setup_bckt
                FROM sys_user 
                WHERE su_userid = $1`;

        const { rows } = await pool.query(query, [zMaNSD]);

        if (rows.length > 0) {
            res.json(rows[0]);  // Send the folder data as JSON
        } else {
            res.status(404).send('Folder not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching folder data from the database');
    }
});

// Route render trang dm-hoatdongbenhvien
app.get('/dm-hoatdongbenhvien', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }

    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-hoatdongbenhvien', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin,
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
});

// Thêm API /api/report vào app.js
app.get('/api/hoatdongbenhvien', async (req, res) => {
    const { startDate, endDate } = req.query;

    // Truy vấn dữ liệu hoạt động bệnh viện
    const query = `
        SELECT  
            COUNT(DISTINCT tong_so_nguoi_benh) AS tong_so_nguoi_benh, 
            SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 	AS tong_so_luot_kham,
            SUM(bn_bhyt)                          	AS so_luong_bao_hiem,
            SUM(bn_vien_phi)                        AS so_luong_dich_vu,
            SUM(bn_mien_giam)                       AS so_luong_mien_giam,		
            SUM(bn_cap_cuu)                         AS so_luong_cap_cuu,
            SUM(bn_nam)                             AS so_luong_bn_nam,	
            SUM(bn_nu)                              AS so_luong_bn_nu,		
            SUM(bn_nhap_vien)                       AS so_luong_nhap_vien,
            SUM(bn_chuyen_vien)                     AS so_luong_chuyen_vien,
            SUM(bn_dt_ngoaitru)                     AS so_luong_dt_ngoaitru 
        FROM (
            SELECT 			
                hp_patientno AS tong_so_nguoi_benh,
                CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,				
                0 AS bn_nhap_vien,
                0 AS bn_chuyen_vien,
                0 AS bn_dt_ngoaitru 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_object ON (hd_object = ho_id) 
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
            AND he_examdate BETWEEN $1::timestamp AND $2::timestamp 
            UNION ALL
            SELECT 	
                    0 AS tong_so_nguoi_benh,		
                    0 AS bn_bhyt,
                    0 AS bn_vien_phi,
                    0 AS bn_mien_giam,
                    0 AS bn_cap_cuu,
                    0 AS bn_nam,
                    0 AS bn_nu,			
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                    CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
            LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
            LEFT JOIN hms_object ON (hd_object = ho_id)
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
            AND hd_enddate BETWEEN $3::timestamp AND $4::timestamp       
        ) AS tbl     
    `;

    try {
        // Thực thi cả hai truy vấn
        const result = await pool.query(query, [startDate, endDate, startDate, endDate]);
        res.json(result.rows);

    } catch (err) {
        console.error('Error in API:', err.message);
        res.status(500).json({ error: 'Server error occurred' });
    }
});

app.get('/api/hoatdongbenhvientheongay', async (req, res) => {
    const query = `
        SELECT  
	        ROW_NUMBER() OVER (ORDER BY TO_DATE(ngay, 'DD/MM/YYYY') DESC) AS stt,
            COUNT(DISTINCT tong_so_nguoi_benh) AS tong_so_nguoi_benh, 
            ngay,
            TO_CHAR(TO_DATE(ngay, 'DD/MM/YYYY'), 'D')::int AS thu,
            CASE TO_CHAR(TO_DATE(ngay, 'DD/MM/YYYY'), 'D')::int
                    WHEN 2 THEN 'Thứ Hai'
                    WHEN 3 THEN 'Thứ Ba'
                    WHEN 4 THEN 'Thứ Tư'
                    WHEN 5 THEN 'Thứ Năm'
                    WHEN 6 THEN 'Thứ Sáu'
                    WHEN 7 THEN 'Thứ Bảy'
                    WHEN 1 THEN 'Chủ Nhật'
            END AS ten_thu,
            SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 	AS tong_so_luot_kham,
            SUM(bn_bhyt)                          	AS so_luong_bao_hiem,
            SUM(bn_vien_phi)                        AS so_luong_dich_vu,
            SUM(bn_mien_giam)                       AS so_luong_mien_giam,		
            SUM(bn_cap_cuu)                         AS so_luong_cap_cuu,
            SUM(bn_nam)                             AS so_luong_bn_nam,	
            SUM(bn_nu)                              AS so_luong_bn_nu,		
            SUM(bn_nhap_vien)                       AS so_luong_nhap_vien,
            SUM(bn_chuyen_vien)                     AS so_luong_chuyen_vien,
            SUM(bn_dt_ngoaitru)                     AS so_luong_dt_ngoaitru 
        FROM (
            SELECT 
				hp_patientno AS tong_so_nguoi_benh,
				TO_CHAR(he_examdate, 'DD/MM/YYYY') AS ngay,
                CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,				
                0 AS bn_nhap_vien,
                0 AS bn_chuyen_vien,
                0 AS bn_dt_ngoaitru 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_object ON (hd_object = ho_id) 
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND he_examdate >= (CURRENT_DATE - INTERVAL '32 DAY')::timestamp 
                AND he_examdate < (CURRENT_DATE + INTERVAL '1 DAY')::timestamp
            UNION ALL
            SELECT 	
                0 AS tong_so_nguoi_benh,
				TO_CHAR(hd_enddate, 'DD/MM/YYYY') AS ngay,
                0 AS bn_bhyt,
                0 AS bn_vien_phi,
                0 AS bn_mien_giam,
                0 AS bn_cap_cuu,
                0 AS bn_nam,
                0 AS bn_nu,			
                CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
            LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
            LEFT JOIN hms_object ON (hd_object = ho_id)
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND hd_enddate >= (CURRENT_DATE - INTERVAL '32 DAY')::timestamp 
                AND hd_enddate < (CURRENT_DATE + INTERVAL '1 DAY')::timestamp
        ) AS tbl  
		GROUP BY ngay
    `;

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn hoạt động bệnh viện theo ngày:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn hoạt động bệnh viện theo ngày:' });
    }
});

app.get('/api/sumhoatdongbenhvientheongay', async (req, res) => {
    const query = `
        SELECT  	        
            COUNT(DISTINCT tong_so_nguoi_benh) AS tong_so_nguoi_benh,             
            SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 	AS tong_so_luot_kham,
            SUM(bn_bhyt)                          	AS so_luong_bao_hiem,
            SUM(bn_vien_phi)                        AS so_luong_dich_vu,
            SUM(bn_mien_giam)                       AS so_luong_mien_giam,		
            SUM(bn_cap_cuu)                         AS so_luong_cap_cuu,
            SUM(bn_nam)                             AS so_luong_bn_nam,	
            SUM(bn_nu)                              AS so_luong_bn_nu,		
            SUM(bn_nhap_vien)                       AS so_luong_nhap_vien,
            SUM(bn_chuyen_vien)                     AS so_luong_chuyen_vien,
            SUM(bn_dt_ngoaitru)                     AS so_luong_dt_ngoaitru 
        FROM (
            SELECT 
				hp_patientno AS tong_so_nguoi_benh,
				TO_CHAR(he_examdate, 'DD/MM/YYYY') AS ngay,
                CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,				
                0 AS bn_nhap_vien,
                0 AS bn_chuyen_vien,
                0 AS bn_dt_ngoaitru 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_object ON (hd_object = ho_id) 
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND he_examdate >= (CURRENT_DATE - INTERVAL '32 DAY')::timestamp 
                AND he_examdate < (CURRENT_DATE + INTERVAL '1 DAY')::timestamp
            UNION ALL
            SELECT 	
                0 AS tong_so_nguoi_benh,
				TO_CHAR(hd_enddate, 'DD/MM/YYYY') AS ngay,
                0 AS bn_bhyt,
                0 AS bn_vien_phi,
                0 AS bn_mien_giam,
                0 AS bn_cap_cuu,
                0 AS bn_nam,
                0 AS bn_nu,			
                CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
            LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
            LEFT JOIN hms_object ON (hd_object = ho_id)
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND hd_enddate >= (CURRENT_DATE - INTERVAL '32 DAY')::timestamp 
                AND hd_enddate < (CURRENT_DATE + INTERVAL '1 DAY')::timestamp
        ) AS tbl  		
    `;

    try {
        const result = await pool.query(query);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum hoạt động bệnh viện theo ngày:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum hoạt động bệnh viện theo ngày:' });
    }
});

app.get('/dm-baocaongay', (req, res) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaongay', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
});

app.get('/api/baocaongay', async (req, res) => {
    let { startDate, endDate } = req.query;

    const query = `
        SELECT  
            COUNT(DISTINCT tong_so_nguoi_benh) AS tong_so_nguoi_benh, 
            SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 	AS tong_so_luot_kham,
            SUM(bn_bhyt)                          	AS so_luong_bao_hiem,
            SUM(bn_vien_phi)                        AS so_luong_dich_vu,
            SUM(bn_mien_giam)                       AS so_luong_mien_giam,		
            SUM(bn_cap_cuu)                         AS so_luong_cap_cuu,
            SUM(bn_nam)                             AS so_luong_bn_nam,	
            SUM(bn_nu)                              AS so_luong_bn_nu,		
            SUM(bn_nhap_vien)                       AS so_luong_nhap_vien,
            SUM(bn_chuyen_vien)                     AS so_luong_chuyen_vien,
            SUM(bn_dt_ngoaitru)                     AS so_luong_dt_ngoaitru 
        FROM (
                SELECT 
                        hp_patientno AS tong_so_nguoi_benh,
                        CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                        CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                        CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                        CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                        CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                        CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,				
                        0 AS bn_nhap_vien,
                        0 AS bn_chuyen_vien,
                        0 AS bn_dt_ngoaitru 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_object ON (hd_object = ho_id) 
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                        AND he_examdate BETWEEN $1::timestamp AND $2::timestamp 
                UNION ALL
                SELECT 	
                        0 AS tong_so_nguoi_benh,		
                        0 AS bn_bhyt,
                        0 AS bn_vien_phi,
                        0 AS bn_mien_giam,
                        0 AS bn_cap_cuu,
                        0 AS bn_nam,
                        0 AS bn_nu,			
                        CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                        CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                        CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
                LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
                LEFT JOIN hms_object ON (hd_object = ho_id)
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                        AND hd_enddate BETWEEN $3::timestamp AND $4::timestamp    
        ) AS tbl 
    `;

    try {
        const result = await pool.query(query, [startDate, endDate, startDate, endDate]);

        const responseData = {
            tong_so_luot_kham: result.rows[0]?.tong_so_luot_kham || 0,
            so_luong_nhap_vien: result.rows[0]?.so_luong_nhap_vien || 0,
            so_luong_chuyen_vien: result.rows[0]?.so_luong_chuyen_vien || 0,
            so_luong_dich_vu: result.rows[0]?.so_luong_dich_vu || 0,
            so_luong_bao_hiem: result.rows[0]?.so_luong_bao_hiem || 0,
            tong_so_nguoi_benh: result.rows[0]?.tong_so_nguoi_benh || 0,
        };

        res.json(responseData);
    } catch (err) {
        console.error('Error in API:', err.message);
        res.status(500).json({ error: 'Server error occurred' });
    }
});

app.get('/dm-baocaotuan', (req, res) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaotuan', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
});

app.get('/dm-dashboard-bskham', (req, res) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-dashboard-bskham', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
});

app.get('/api/baocaotuan', async (req, res) => {
    const { startDate, endDate } = req.query;

    // Thêm thời gian '23:59:59' vào endDate để bao gồm toàn bộ ngày
    const endDateWithTime = `${endDate} 23:59:59`;

    try {
        const query = `
            SELECT  
                SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 	AS tong_so_luot_kham,
                SUM(bn_bhyt)                          	AS so_luong_bao_hiem,
                SUM(bn_vien_phi)                        AS so_luong_dich_vu,
                SUM(bn_mien_giam)                       AS so_luong_mien_giam,		
                SUM(bn_cap_cuu)                         AS so_luong_cap_cuu,
                SUM(bn_nam)                             AS so_luong_bn_nam,	
                SUM(bn_nu)                              AS so_luong_bn_nu,		
                SUM(bn_nhap_vien)                       AS so_luong_nhap_vien,
                SUM(bn_chuyen_vien)                     AS so_luong_chuyen_vien,
                SUM(bn_dt_ngoaitru)                     AS so_luong_dt_ngoaitru, 
                COUNT(DISTINCT tong_so_nguoi_benh) AS tong_so_nguoi_benh  
            FROM (
                    SELECT 
                            hp_patientno AS tong_so_nguoi_benh,
                            CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                            CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                            CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                            CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                            CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                            CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,				
                            0 AS bn_nhap_vien,
                            0 AS bn_chuyen_vien,
                            0 AS bn_dt_ngoaitru 
                    FROM hms_doc
                    LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
                    LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                    LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                    LEFT JOIN hms_object ON (hd_object = ho_id) 
                    WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                            AND he_examdate BETWEEN $1::timestamp AND $2::timestamp 
                    UNION ALL
                    SELECT 				
                            0 AS tong_so_nguoi_benh,
                            0 AS bn_bhyt,
                            0 AS bn_vien_phi,
                            0 AS bn_mien_giam,
                            0 AS bn_cap_cuu,
                            0 AS bn_nam,
                            0 AS bn_nu,			
                            CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                            CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                            CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru 
                    FROM hms_doc
                    LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
                    LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
                    LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                    LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                    LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
                    LEFT JOIN hms_object ON (hd_object = ho_id)
                    WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                            AND hd_enddate BETWEEN $3::timestamp AND $4::timestamp    
            ) AS tbl;
        `;

        const result = await pool.query(query, [startDate, endDateWithTime, startDate, endDateWithTime]);
        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching weekly report:', err);
        res.status(500).json({ error: 'Error fetching weekly report' });
    }
});

app.get('/dm-baocaophongkham', (req, res) => {
    /* Lấy ngày hiện tại 
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaophongkham', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy ngày hôm trước */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaophongkham', {
        startDateBCPhongKham: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateBCPhongKham: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

app.get('/api/baocaophongkham', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        // Truy vấn Lịch khám
        const bsKhamResult = await pool.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY SUM(bn_bhyt + bn_vien_phi + bn_mien_giam) DESC) AS stt,
                ma_bac_si,
                ten_bac_si,
                SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) AS tong_so_bn, 
                SUM(bn_bhyt) AS tong_bn_bhyt 
            FROM (
                SELECT 
                    he_deptid AS ma_khoa,
                    he_roomid AS ma_phong,
                    hrl_name AS ten_phong,
                    he_doctor AS ma_bac_si,
                    CASE WHEN he_doctor = 'dv' OR he_doctor = '' THEN he_doctor ELSE su_name END AS ten_bac_si,
                    CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                    CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                    CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                    CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_object ON (hd_object = ho_id) 
                LEFT JOIN sys_user ON (su_userid = he_doctor)
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND he_examdate BETWEEN $1::timestamp AND $2::timestamp
            ) AS tbl
            GROUP BY ma_bac_si, ten_bac_si
            HAVING SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) > 0
            ORDER BY SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) DESC 
        `, [startDate, endDate]);

        res.json({
            bsKham: bsKhamResult.rows
        });
    } catch (error) {
        console.error('Lỗi khi truy vấn dữ liệu:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi truy vấn dữ liệu.' });
    }
});

app.get('/api/baocaothongkebskham', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY SUM(bn_bhyt + bn_vien_phi + bn_mien_giam) DESC) AS stt,
            ma_bac_si,
            ten_bac_si,
            SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) AS tong_so_bn, 
            SUM(bn_bhyt) AS tong_bn_bhyt 
        FROM (
            SELECT 
                he_deptid AS ma_khoa,
                he_roomid AS ma_phong,
                hrl_name AS ten_phong,
                he_doctor AS ma_bac_si,
                CASE WHEN he_doctor = 'dv' OR he_doctor = '' THEN he_doctor ELSE su_name END AS ten_bac_si,
                CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_object ON (hd_object = ho_id) 
            LEFT JOIN sys_user ON (su_userid = he_doctor)
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
            AND he_examdate BETWEEN $1::timestamp AND $2::timestamp
        ) AS tbl
        GROUP BY ma_bac_si, ten_bac_si
        HAVING SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) > 0
        ORDER BY SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) DESC 
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn theo bác sĩ khám:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn theo bác sĩ khám' });
    }
});

app.get('/api/sumbaocaothongkebskham', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT                 
            SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) AS tong_so_bn, 
            SUM(bn_bhyt) AS tong_bn_bhyt 
        FROM (
            SELECT 
                he_deptid AS ma_khoa,
                he_roomid AS ma_phong,
                hrl_name AS ten_phong,
                he_doctor AS ma_bac_si,
                CASE WHEN he_doctor = 'dv' OR he_doctor = '' THEN he_doctor ELSE su_name END AS ten_bac_si,
                CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu 
            FROM hms_doc
            LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
            LEFT JOIN hms_exam ON (he_docno = hd_docno) 
            LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
            LEFT JOIN hms_object ON (hd_object = ho_id) 
            LEFT JOIN sys_user ON (su_userid = he_doctor)
            WHERE he_deptid IN ('KB', 'KCC', 'CC') 
            AND he_examdate BETWEEN $1::timestamp AND $2::timestamp
        ) AS tbl
    `;

    try {
        const result = await pool.query(query, [startDate, endDate,]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum theo bác sĩ khám:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum theo bác sĩ khám' });
    }
});

app.get('/api/baocaochitietphongkham', async (req, res) => {
    const { startDate, endDate } = req.query;

    // Kiểm tra tham số
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Thiếu tham số startDate hoặc endDate' });
    }

    const query = `
            SELECT 
                ROW_NUMBER() OVER (ORDER BY SUM(bn_bhyt + bn_vien_phi + bn_mien_giam) DESC) AS stt,
                ma_khoa,
                ma_phong,
                ten_phong,
                SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 		AS tong_so_bn,
                SUM(bn_bhyt)                          		AS tong_bn_bhyt,
                SUM(bn_vien_phi)                            AS tong_bn_vien_phi,
                SUM(bn_mien_giam)                           AS tong_bn_mien_giam,
                SUM(bn_nam)                                	AS tong_bn_nam,
                SUM(bn_nu)                                	AS tong_bn_nu,
                SUM(bn_nam_duoi15tuoi)                      AS tong_bn_nam_duoi15tuoi,
                SUM(bn_nu_duoi15tuoi)                       AS tong_bn_nu_duoi15tuoi,
                SUM(bn_nam_tren60tuoi)                      AS tong_bn_nam_tren60tuoi,
                SUM(bn_nu_tren60tuoi)                       AS tong_bn_nu_tren60tuoi,
                SUM(bn_cap_cuu)                          	AS tong_bn_cap_cuu,
                SUM(bn_nhap_vien)                           AS tong_bn_nhap_vien,
                SUM(bn_chuyen_vien)                         AS tong_bn_chuyen_vien,
                SUM(bn_dt_ngoaitru)                         AS tong_bn_dt_ngoaitru,
                SUM(so_ngay_dt_ngoaitru)					AS tong_so_ngay_dt_ngoaitru 
            FROM (
                SELECT 
                    he_deptid AS ma_khoa,
                    he_roomid AS ma_phong,
                    hrl_name AS ten_phong,
                    CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                    CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                    CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                    CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                    CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                    CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) < 15 AND hp_sex= 'M' THEN 1 ELSE 0
                    END AS bn_nam_duoi15tuoi,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) < 15 AND hp_sex= 'F' THEN 1 ELSE 0
                    END AS bn_nu_duoi15tuoi,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) > 60 AND hp_sex = 'M' THEN 1 ELSE 0
                    END AS bn_nam_tren60tuoi,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) > 60 AND hp_sex= 'F' THEN 1 ELSE 0
                    END AS bn_nu_tren60tuoi,
                    0 AS bn_nhap_vien,
                    0 AS bn_chuyen_vien,
                    0 AS bn_dt_ngoaitru,
                    0 AS so_ngay_dt_ngoaitru 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_object ON (hd_object = ho_id) 
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND he_examdate BETWEEN $1::timestamp AND $2::timestamp 
                UNION ALL
                SELECT 
                    he_deptid AS ma_khoa,
                    he_roomid AS ma_phong,
                    hrl_name AS ten_phong,	
                    0 AS bn_bhyt,
                    0 AS bn_vien_phi,
                    0 AS bn_mien_giam,
                    0 AS bn_cap_cuu,
                    0 AS bn_nam,
                    0 AS bn_nu,
                    0 AS bn_nam_duoi15tuoi,
                    0 AS bn_nu_duoi15tuoi,
                    0 AS bn_nam_tren60tuoi,
                    0 AS bn_nu_tren60tuoi,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                    CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'B' AND hd_outpatient ='Y' THEN hop_treatdays ELSE 0 END AS so_ngay_dt_ngoaitru 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
                LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
                LEFT JOIN hms_object ON (hd_object = ho_id)
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND hd_enddate BETWEEN $3::timestamp AND $4::timestamp                 
            ) AS tbl
            GROUP BY ma_khoa, ma_phong, ten_phong
            ORDER BY tong_so_bn DESC
        `;

    const repeatedParams = Array(2).fill([startDate, endDate]).flat();

    try {
        const result = await pool.query(query, repeatedParams);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng chi tiết theo phòng khám:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng chi tiết theo phòng khám' });
    }
});

app.get('/api/sumbaocaochitietphongkham', async (req, res) => {
    const { startDate, endDate } = req.query;

    // Kiểm tra tham số
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Thiếu tham số startDate hoặc endDate' });
    }

    const query = `
        	SELECT  
                SUM(bn_bhyt+bn_vien_phi+bn_mien_giam) 		AS tong_so_bn,
                SUM(bn_bhyt)                          		AS tong_bn_bhyt,
                SUM(bn_vien_phi)                            AS tong_bn_vien_phi,
                SUM(bn_mien_giam)                           AS tong_bn_mien_giam,
                SUM(bn_nam)                                	AS tong_bn_nam,
                SUM(bn_nu)                                	AS tong_bn_nu,
                SUM(bn_nam_duoi15tuoi)                      AS tong_bn_nam_duoi15tuoi,
                SUM(bn_nu_duoi15tuoi)                       AS tong_bn_nu_duoi15tuoi,
                SUM(bn_nam_tren60tuoi)                      AS tong_bn_nam_tren60tuoi,
                SUM(bn_nu_tren60tuoi)                       AS tong_bn_nu_tren60tuoi,
                SUM(bn_cap_cuu)                          	AS tong_bn_cap_cuu,
                SUM(bn_nhap_vien)                           AS tong_bn_nhap_vien,
                SUM(bn_chuyen_vien)                         AS tong_bn_chuyen_vien,
                SUM(bn_dt_ngoaitru)                         AS tong_bn_dt_ngoaitru,
                SUM(so_ngay_dt_ngoaitru)					AS tong_so_ngay_dt_ngoaitru 
            FROM (
                SELECT 
                    he_deptid AS ma_khoa,
                    he_roomid AS ma_phong,
                    hrl_name AS ten_phong,
                    CASE WHEN ho_type IN ('I','C') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_bhyt,
                    CASE WHEN ho_type IN ('S') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_vien_phi,
                    CASE WHEN ho_type IN ('P') AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_mien_giam,
                    CASE WHEN he_emergency='Y' AND he_status <> 'O' THEN 1 ELSE 0 END AS bn_cap_cuu,
                    CASE WHEN he_status <> 'O' AND hp_sex='M' THEN 1 ELSE 0 END AS bn_nam,
                    CASE WHEN he_status <> 'O' AND hp_sex='F' THEN 1 ELSE 0 END AS bn_nu,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) < 15 AND hp_sex= 'M' THEN 1 ELSE 0
                    END AS bn_nam_duoi15tuoi,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) < 15 AND hp_sex= 'F' THEN 1 ELSE 0
                    END AS bn_nu_duoi15tuoi,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) > 60 AND hp_sex = 'M' THEN 1 ELSE 0
                    END AS bn_nam_tren60tuoi,
                    CASE WHEN he_status <> 'O' AND date_part('year', age(DATE(hd_admitdate), hp_birthdate)) > 60 AND hp_sex= 'F' THEN 1 ELSE 0
                    END AS bn_nu_tren60tuoi,
                    0 AS bn_nhap_vien,
                    0 AS bn_chuyen_vien,
                    0 AS bn_dt_ngoaitru,
                    0 AS so_ngay_dt_ngoaitru 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno) 
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_object ON (hd_object = ho_id) 
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND he_examdate BETWEEN $1::timestamp AND $2::timestamp 
                UNION ALL
                SELECT 
                    he_deptid AS ma_khoa,
                    he_roomid AS ma_phong,
                    hrl_name AS ten_phong,	
                    0 AS bn_bhyt,
                    0 AS bn_vien_phi,
                    0 AS bn_mien_giam,
                    0 AS bn_cap_cuu,
                    0 AS bn_nam,
                    0 AS bn_nu,
                    0 AS bn_nam_duoi15tuoi,
                    0 AS bn_nu_duoi15tuoi,
                    0 AS bn_nam_tren60tuoi,
                    0 AS bn_nu_tren60tuoi,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'D' AND hcr_status IN ('I','T') THEN 1 ELSE 0 END AS bn_nhap_vien,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'F' AND he_receptidx = hd_areceptidx THEN 1 ELSE 0 END AS bn_chuyen_vien,
                    CASE WHEN hd_status = 'T' AND hd_outpatient = 'Y' AND hd_suggestion = 'B' THEN 1 ELSE 0 END AS bn_dt_ngoaitru,
                    CASE WHEN hd_status = 'T' AND hd_suggestion = 'B' AND hd_outpatient ='Y' THEN hop_treatdays ELSE 0 END AS so_ngay_dt_ngoaitru 
                FROM hms_doc
                LEFT JOIN hms_patient ON (hp_patientno = hd_patientno)
                LEFT JOIN hms_clinical_record ON (hcr_docno = hd_docno)
                LEFT JOIN hms_exam ON (he_docno = hd_docno) 
                LEFT JOIN hms_roomlist ON (he_deptid = hrl_deptid AND he_roomid = hrl_id) 
                LEFT JOIN hms_outpatient ON (hop_docno = hd_docno AND hop_roomid = he_roomid)
                LEFT JOIN hms_object ON (hd_object = ho_id)
                WHERE he_deptid IN ('KB', 'KCC', 'CC') 
                AND hd_enddate BETWEEN $3::timestamp AND $4::timestamp                 
            ) AS tbl       
    `;

    const repeatedParams = Array(2).fill([startDate, endDate]).flat();

    try {
        const result = await pool.query(query, repeatedParams);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum chi tiết theo phòng khám:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum chi tiết theo phòng khám' });
    }
});

app.get('/dm-baocaodieutrinoitru', (req, res) => {
    /* Lấy ngày hiện tại 
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaodieutrinoitru', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy trước một ngày mặc định ngày hiện tại */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaodieutrinoitru', {
        startDateBCDTNoiTru: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateBCDTNoiTru: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

app.get('/api/doanhthunoitru', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            row_number() over(order by SUM(bh_phi_giuong+bh_phi_cls+bh_phi_pttt+bh_phi_thuoc_vtyt) desc) stt,
            (SELECT sd_name FROM sys_dept WHERE sd_id = deptid) AS deptname, 
            SUM(bh_phi_giuong+bh_phi_xn+bh_phi_cls+bh_phi_pttt+bh_phi_thuoc_vtyt) AS tong_bao_hiem_tra, 
            SUM(dv_phi_giuong+dv_phi_xn+dv_phi_cls+dv_phi_pttt+dv_phi_thuoc_vtyt+phi_vanchuyen+phi_khac) AS tong_dich_vu, 
            SUM(chenh_phi_giuong+chenh_phi_xn+chenh_phi_cls+chenh_phi_pttt+chenh_phi_thuoc_vtyt) AS tong_tra_chenh, 
            SUM(bh_phi_giuong) AS bh_phi_giuong, 
            SUM(dv_phi_giuong) AS dv_phi_giuong, 
            SUM(chenh_phi_giuong) AS chenh_phi_giuong,
            SUM(bh_phi_xn) AS bh_phi_xn, 
            SUM(dv_phi_xn) AS dv_phi_xn, 
            SUM(chenh_phi_xn) AS chenh_phi_xn, 
            SUM(bh_phi_cls) AS bh_phi_cls, 
            SUM(dv_phi_cls) AS dv_phi_cls, 
            SUM(chenh_phi_cls) AS chenh_phi_cls, 
            SUM(bh_phi_pttt) AS bh_phi_pttt, 
            SUM(dv_phi_pttt) AS dv_phi_pttt, 
            SUM(chenh_phi_pttt) AS chenh_phi_pttt, 
            SUM(bh_phi_thuoc_vtyt) AS bh_phi_thuoc_vtyt, 
            SUM(dv_phi_thuoc_vtyt) AS dv_phi_thuoc_vtyt, 
            SUM(chenh_phi_thuoc_vtyt) AS chenh_phi_thuoc_vtyt, 
            SUM(phi_vanchuyen) AS phi_vanchuyen, 
            SUM(phi_khac) AS phi_khac
        FROM(
            SELECT 
                e.hfe_deptid AS deptid, 
                hd_object AS pobject, 
                
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('C0') AND hfe_object = 4 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_giuong, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('C0') AND hfe_object = 7 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_giuong, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('C0') AND hfe_object = 4 AND hd_disrate < 100 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_giuong,
                    
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B1') AND hfe_object = 4 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_xn, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B1') AND hfe_object = 7 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_xn, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B1') AND hfe_object = 4 AND hd_disrate < 100 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_xn, 
                    
                    CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B2','B3') AND hfe_object = 4 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_cls, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B2','B3') AND hfe_object = 7 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_cls, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B2','B3') AND hfe_object = 4 AND hd_disrate < 100 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_cls, 

                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B4','B5') AND hfe_object = 4 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_pttt, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B4','B5') AND hfe_object = 7 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_pttt, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B4','B5') AND hfe_object = 4 AND hd_disrate < 100 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_pttt, 

                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('A1', 'A2', 'A3', 'A4','A9') AND hfe_object = 4 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_thuoc_vtyt, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('A1', 'A2', 'A3', 'A4','A9') AND hfe_object = 7 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_thuoc_vtyt, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('A1', 'A2', 'A3', 'A4','A9') AND hfe_object = 4 AND hd_disrate < 100 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_thuoc_vtyt, 

                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('F0') AND hfl_hastransfer = 'Y' 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS phi_vanchuyen, 
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('F0') AND hfl_hastransfer <> 'Y' 
                    THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS phi_khac, 
                0 AS phi_thuoc_pttt, 
                0 AS phi_vtyt_pttt, 
                0 AS phi_vtyt_daugiuong 
            FROM hms_fee e 
            LEFT JOIN hms_fee_invoice i ON (e.hfe_docno = i.hfe_docno AND e.hfe_invoiceno = i.hfe_invoiceno) 
            LEFT JOIN hms_doc ON (hd_docno = i.hfe_docno) 
            LEFT JOIN hms_fee_list ON (hfl_feeid = hfe_itemid) 
            WHERE i.hfe_status = 'P' 
            AND e.hfe_category <> 'Y' 
            AND e.hfe_deptid NOT IN ('KB', 'CC', 'NGOAICT')
            AND i.hfe_date BETWEEN $1::timestamp AND $2::timestamp
        ) AS tbl 
        GROUP BY deptid       
        ORDER BY tong_bao_hiem_tra DESC, deptid
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn doanh thu nội trú:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn doanh thu nội trú' });
    }
});

app.get('/api/sumdoanhthunoitru', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
    SELECT              
        SUM(bh_phi_giuong+bh_phi_xn+bh_phi_cls+bh_phi_pttt+bh_phi_thuoc_vtyt) AS tong_bao_hiem_tra, 
        SUM(dv_phi_giuong+dv_phi_xn+dv_phi_cls+dv_phi_pttt+dv_phi_thuoc_vtyt+phi_vanchuyen+phi_khac) AS tong_dich_vu, 
        SUM(chenh_phi_giuong+chenh_phi_xn+chenh_phi_cls+chenh_phi_pttt+chenh_phi_thuoc_vtyt) AS tong_tra_chenh, 
        SUM(bh_phi_giuong) AS bh_phi_giuong, 
        SUM(dv_phi_giuong) AS dv_phi_giuong, 
        SUM(chenh_phi_giuong) AS chenh_phi_giuong,
        SUM(bh_phi_xn) AS bh_phi_xn, 
        SUM(dv_phi_xn) AS dv_phi_xn, 
        SUM(chenh_phi_xn) AS chenh_phi_xn, 
        SUM(bh_phi_cls) AS bh_phi_cls, 
        SUM(dv_phi_cls) AS dv_phi_cls, 
        SUM(chenh_phi_cls) AS chenh_phi_cls, 
        SUM(bh_phi_pttt) AS bh_phi_pttt, 
        SUM(dv_phi_pttt) AS dv_phi_pttt, 
        SUM(chenh_phi_pttt) AS chenh_phi_pttt, 
        SUM(bh_phi_thuoc_vtyt) AS bh_phi_thuoc_vtyt, 
        SUM(dv_phi_thuoc_vtyt) AS dv_phi_thuoc_vtyt, 
        SUM(chenh_phi_thuoc_vtyt) AS chenh_phi_thuoc_vtyt, 
        SUM(phi_vanchuyen) AS phi_vanchuyen, 
        SUM(phi_khac) AS phi_khac
    FROM(
        SELECT 
            e.hfe_deptid AS deptid, 
            hd_object AS pobject, 
            
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('C0') AND hfe_object = 4 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_giuong, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('C0') AND hfe_object = 7 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_giuong, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('C0') AND hfe_object = 4 AND hd_disrate < 100 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_giuong,
                
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B1') AND hfe_object = 4 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_xn, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B1') AND hfe_object = 7 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_xn, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B1') AND hfe_object = 4 AND hd_disrate < 100 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_xn, 
                
                CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B2','B3') AND hfe_object = 4 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_cls, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B2','B3') AND hfe_object = 7 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_cls, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B2','B3') AND hfe_object = 4 AND hd_disrate < 100 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_cls, 

            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B4','B5') AND hfe_object = 4 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_pttt, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B4','B5') AND hfe_object = 7 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_pttt, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('B4','B5') AND hfe_object = 4 AND hd_disrate < 100 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_pttt, 

            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('A1', 'A2', 'A3', 'A4','A9') AND hfe_object = 4 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS bh_phi_thuoc_vtyt, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('A1', 'A2', 'A3', 'A4','A9') AND hfe_object = 7 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS dv_phi_thuoc_vtyt, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('A1', 'A2', 'A3', 'A4','A9') AND hfe_object = 4 AND hd_disrate < 100 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS chenh_phi_thuoc_vtyt, 

            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('F0') AND hfl_hastransfer = 'Y' 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS phi_vanchuyen, 
            CASE WHEN SUBSTR(hfe_group, 1, 2) IN('F0') AND hfl_hastransfer <> 'Y' 
                THEN e.hfe_cost - e.hfe_diffcost ELSE 0 END AS phi_khac, 
            0 AS phi_thuoc_pttt, 
            0 AS phi_vtyt_pttt, 
            0 AS phi_vtyt_daugiuong 
        FROM hms_fee e 
        LEFT JOIN hms_fee_invoice i ON (e.hfe_docno = i.hfe_docno AND e.hfe_invoiceno = i.hfe_invoiceno) 
        LEFT JOIN hms_doc ON (hd_docno = i.hfe_docno) 
        LEFT JOIN hms_fee_list ON (hfl_feeid = hfe_itemid) 
        WHERE i.hfe_status = 'P' 
        AND e.hfe_category <> 'Y' 
        AND e.hfe_deptid NOT IN ('KB', 'CC', 'NGOAICT')
        AND i.hfe_date BETWEEN $1::timestamp AND $2::timestamp
    ) AS tbl         
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng doanh thu nội trú:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng doanh thu nội trú' });
    }
});

app.get('/api/chitietdieutrinoitru', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY SUM(bn_dauky) DESC) AS stt,
            ma_khoa,
            sd_name AS ten_khoa,
            SUM(bn_dauky) AS bn_dauky,
            SUM(bn_vaovien) AS bn_vaovien,
            SUM(bn_ravien) AS bn_ravien,
            SUM(bn_chuyenkhoa_den) AS bn_chuyenkhoa_den,
            SUM(bn_chuyenkhoa_di) AS bn_chuyenkhoa_di,
            SUM(bn_chuyenvien) AS bn_chuyenvien,
            SUM(bn_tuvong) AS bn_tuvong,
            SUM(bn_cuoiky) AS bn_cuoiky,
            SUM(bn_capcuu) AS bn_capcuu,
            SUM(bn_vaovien_BHYT) AS bn_vaovien_BHYT
        FROM (
            SELECT 
                ma_khoa,
                1 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  < $1::timestamp
                    AND (htr_status        ='I'
                    OR (htr_status         ='T'
                    AND htr_dischargedate >= $2::timestamp))
                    AND htr_outpatient <> 'Y'
            ) AS tbl_dauky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                1 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx       =1
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl_vaovien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                1 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                LEFT JOIN hms_clinical_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                WHERE hcr_dischargedate BETWEEN $5::timestamp AND $6::timestamp
                    AND htr_status='T'
                    AND htr_suggestion <> 'F'
                    AND htr_outpatient <> 'Y'
            ) AS tbl_ravien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                1 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx > 1
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $7::timestamp AND $8::timestamp
            ) AS tbl_chuyenkhoa_den
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                1 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE  htr_status IN('T')
                    AND htr_suggestion = 'M'
                    AND htr_outpatient <> 'Y'
                    AND htr_dischargedate BETWEEN $9::timestamp AND $10::timestamp
            ) AS tbl_chuyenkhoa_di
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                1 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status      ='T'
                    AND htr_suggestion   ='F'
                    AND htr_outpatient <> 'Y'
                    AND htr_dischargedate BETWEEN $11::timestamp AND $12::timestamp
            ) AS tbl_chuyenvien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                1 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    hd_patientno AS patientno,
                    hd_docno AS docno,
                    hd_admitdept AS ma_khoa
                FROM hms_doc
                WHERE hd_status    ='T'
                    AND hd_result     IN('5','6','9')
                    AND LENGTH(hd_icd) > 0
                    AND hd_enddate BETWEEN $13::timestamp AND $14::timestamp
                    AND hd_outpatient <> 'Y'
                UNION ALL
                SELECT 
                    hcr_patientno AS patietnNo,
                    hcr_docno AS docno,
                    hcr_admitdept AS ma_khoa
                FROM hms_clinical_record
                LEFT JOIN hms_treatment_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                LEFT JOIN hms_doc ON (hcr_docno = hd_docno)
                WHERE hcr_status = 'T' 
                    AND hcr_result IN ('5','6','9')
                    AND LENGTH(hcr_mainicd) > 0
                    AND htr_outpatient <> 'Y'
                    AND hcr_dischargedate BETWEEN $15::timestamp AND $16::timestamp
            ) AS tbl_tuvong
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                1 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  <= $17::timestamp
                    AND htr_outpatient <> 'Y'
                    AND (htr_status       ='I'
                    OR (htr_status        ='T'
                    AND htr_dischargedate > $18::timestamp))
            ) AS tbl_cuoiky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                1 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status       IN('I','T')
                    AND htr_emergency      ='Y'
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate      < $19::timestamp
                    AND (htr_status        ='I'
                    OR(htr_status          ='T'
                    AND htr_dischargedate >= $20::timestamp))
                UNION ALL
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_emergency='Y'
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $21::timestamp AND $22::timestamp
            ) AS tbl_capcuu
            UNION ALL 
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                1 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx AS idx,
                    htr_docno AS docno 
                FROM hms_treatment_record 
                LEFT JOIN hms_doc ON (hd_docno = htr_docno) 
                WHERE htr_status IN('I','T') 
                AND htr_idx =1 
                AND htr_outpatient <> 'Y' 
                AND length(hd_cardno)>0 
                AND htr_admitdate BETWEEN $23::timestamp AND $24::timestamp
            ) AS tbl_thebhyt 
        ) AS tblTong
        LEFT JOIN sys_dept ON(sd_id = ma_khoa)
        WHERE ma_khoa NOT IN ('NGOAICT') 
        GROUP BY ma_khoa, ten_khoa
    `;

    try {
        const result = await pool.query(query, [startDate, startDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            endDate, endDate,
            startDate, startDate,
            startDate, startDate,
            startDate, endDate,
        ]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn chi tiết điều trị nội trú:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn chi tiết điều trị nội trú' });
    }
});

app.get('/api/sumchitietdieutrinoitru', async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = `
        SELECT             
            SUM(bn_dauky) AS bn_dauky,
            SUM(bn_vaovien) AS bn_vaovien,
            SUM(bn_ravien) AS bn_ravien,
            SUM(bn_chuyenkhoa_den) AS bn_chuyenkhoa_den,
            SUM(bn_chuyenkhoa_di) AS bn_chuyenkhoa_di,
            SUM(bn_chuyenvien) AS bn_chuyenvien,
            SUM(bn_tuvong) AS bn_tuvong,
            SUM(bn_cuoiky) AS bn_cuoiky,
            SUM(bn_capcuu) AS bn_capcuu,
            SUM(bn_vaovien_BHYT) AS bn_vaovien_BHYT
        FROM (
            SELECT 
                ma_khoa,
                1 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  < $1::timestamp
                    AND (htr_status        ='I'
                    OR (htr_status         ='T'
                    AND htr_dischargedate >= $2::timestamp))
                    AND htr_outpatient <> 'Y'
            ) AS tbl_dauky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                1 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx       =1
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl_vaovien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                1 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                LEFT JOIN hms_clinical_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                WHERE hcr_dischargedate BETWEEN $5::timestamp AND $6::timestamp
                    AND htr_status='T'
                    AND htr_suggestion <> 'F'
                    AND htr_outpatient <> 'Y'
            ) AS tbl_ravien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                1 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx > 1
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $7::timestamp AND $8::timestamp
            ) AS tbl_chuyenkhoa_den
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                1 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE  htr_status IN('T')
                    AND htr_suggestion = 'M'
                    AND htr_outpatient <> 'Y'
                    AND htr_dischargedate BETWEEN $9::timestamp AND $10::timestamp
            ) AS tbl_chuyenkhoa_di
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                1 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status      ='T'
                    AND htr_suggestion   ='F'
                    AND htr_outpatient <> 'Y'
                    AND htr_dischargedate BETWEEN $11::timestamp AND $12::timestamp
            ) AS tbl_chuyenvien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                1 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    hd_patientno AS patientno,
                    hd_docno AS docno,
                    hd_admitdept AS ma_khoa
                FROM hms_doc
                WHERE hd_status    ='T'
                    AND hd_result     IN('5','6','9')
                    AND LENGTH(hd_icd) > 0
                    AND hd_enddate BETWEEN $13::timestamp AND $14::timestamp
                    AND hd_outpatient <> 'Y'
                UNION ALL
                SELECT 
                    hcr_patientno AS patietnNo,
                    hcr_docno AS docno,
                    hcr_admitdept AS ma_khoa
                FROM hms_clinical_record
                LEFT JOIN hms_treatment_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                LEFT JOIN hms_doc ON (hcr_docno = hd_docno)
                WHERE hcr_status = 'T' 
                    AND hcr_result IN ('5','6','9')
                    AND LENGTH(hcr_mainicd) > 0
                    AND htr_outpatient <> 'Y'
                    AND hcr_dischargedate BETWEEN $15::timestamp AND $16::timestamp
            ) AS tbl_tuvong
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                1 AS bn_cuoiky,
                0 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  <= $17::timestamp
                    AND htr_outpatient <> 'Y'
                    AND (htr_status       ='I'
                    OR (htr_status        ='T'
                    AND htr_dischargedate > $18::timestamp))
            ) AS tbl_cuoiky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                1 AS bn_capcuu,
                0 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status       IN('I','T')
                    AND htr_emergency      ='Y'
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate      < $19::timestamp
                    AND (htr_status        ='I'
                    OR(htr_status          ='T'
                    AND htr_dischargedate >= $20::timestamp))
                UNION ALL
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_emergency='Y'
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $21::timestamp AND $22::timestamp
            ) AS tbl_capcuu
            UNION ALL 
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu,
                1 AS bn_vaovien_BHYT
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx AS idx,
                    htr_docno AS docno 
                FROM hms_treatment_record 
                LEFT JOIN hms_doc ON (hd_docno = htr_docno) 
                WHERE htr_status IN('I','T') 
                AND htr_idx =1 
                AND htr_outpatient <> 'Y' 
                AND length(hd_cardno)>0 
                AND htr_admitdate BETWEEN $23::timestamp AND $24::timestamp
            ) AS tbl_thebhyt 
        ) AS tblTong        
        WHERE ma_khoa NOT IN ('NGOAICT')         
    `;

    try {
        const result = await pool.query(query, [startDate, startDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            endDate, endDate,
            startDate, startDate,
            startDate, startDate,
            startDate, endDate
        ]);

        const params = [
            startDate, startDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            endDate, endDate,
            startDate, startDate,
            startDate, startDate,
            startDate, endDate
        ];

        // Thay thế các tham số vào câu SQL để debug
        const formattedQuery = query.replace(/\$(\d+)/g, (_, index) => {
            const value = params[index - 1];
            return value ? `'${value}'` : 'NULL';
        });

        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng chi tiết điều trị nội trú:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng chi tiết điều trị nội trú' });
    }
});

app.get('/api/chitietdieutringoaitrutrongkhoa', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY SUM(bn_dauky) DESC) AS stt,
            ma_khoa,
            sd_name AS ten_khoa,
            SUM(bn_dauky) AS bn_dauky,
            SUM(bn_vaovien) AS bn_vaovien,
            SUM(bn_ravien) AS bn_ravien,
            SUM(bn_chuyenkhoa_den) AS bn_chuyenkhoa_den,
            SUM(bn_chuyenkhoa_di) AS bn_chuyenkhoa_di,
            SUM(bn_chuyenvien) AS bn_chuyenvien,
            SUM(bn_tuvong) AS bn_tuvong,
            SUM(bn_cuoiky) AS bn_cuoiky,
            SUM(bn_capcuu) AS bn_capcuu
        FROM (
            SELECT 
                ma_khoa,
                1 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  < $1::timestamp
                    AND (htr_status        ='I'
                    OR (htr_status         ='T'
                    AND htr_dischargedate >= $2::timestamp))
                    AND htr_outpatient = 'Y'
            ) AS tbl_dauky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                1 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx       =1
                    AND htr_outpatient = 'Y'
                    AND htr_admitdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl_vaovien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                1 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                LEFT JOIN hms_clinical_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                WHERE hcr_dischargedate BETWEEN $5::timestamp AND $6::timestamp
                    AND htr_status='T'
                    AND htr_suggestion <> 'F'
                    AND htr_outpatient = 'Y'
            ) AS tbl_ravien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                1 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx > 1
                    AND htr_outpatient = 'Y'
                    AND htr_admitdate BETWEEN $7::timestamp AND $8::timestamp
            ) AS tbl_chuyenkhoa_den
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                1 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE  htr_status IN('T')
                    AND htr_suggestion = 'M'
                    AND htr_outpatient = 'Y'
                    AND htr_dischargedate BETWEEN $9::timestamp AND $10::timestamp
            ) AS tbl_chuyenkhoa_di
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                1 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status      ='T'
                    AND htr_suggestion   ='F'
                    AND htr_outpatient = 'Y'
                    AND htr_dischargedate BETWEEN $11::timestamp AND $12::timestamp
            ) AS tbl_chuyenvien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                1 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    hd_patientno AS patientno,
                    hd_docno AS docno,
                    hd_admitdept AS ma_khoa
                FROM hms_doc
                WHERE hd_status    ='T'
                    AND hd_result     IN('5','6','9')
                    AND LENGTH(hd_icd) > 0
                    AND hd_enddate BETWEEN $13::timestamp AND $14::timestamp
                    AND hd_outpatient <> 'Y'
                UNION ALL
                SELECT 
                    hcr_patientno AS patietnNo,
                    hcr_docno AS docno,
                    hcr_admitdept AS ma_khoa
                FROM hms_clinical_record
                LEFT JOIN hms_treatment_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                LEFT JOIN hms_doc ON (hcr_docno = hd_docno)
                WHERE hcr_status = 'T' 
                    AND hcr_result IN ('5','6','9')
                    AND LENGTH(hcr_mainicd) > 0
                    AND htr_outpatient <> 'Y'
                    AND hcr_dischargedate BETWEEN $15::timestamp AND $16::timestamp
            ) AS tbl_tuvong
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                1 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  <= $17::timestamp
                    AND htr_outpatient = 'Y'
                    AND (htr_status       ='I'
                    OR (htr_status        ='T'
                    AND htr_dischargedate > $18::timestamp))
            ) AS tbl_cuoiky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                1 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status       IN('I','T')
                    AND htr_emergency      ='Y'
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate      < $19::timestamp
                    AND (htr_status        ='I'
                    OR(htr_status          ='T'
                    AND htr_dischargedate >= $20::timestamp))
                UNION ALL
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_emergency='Y'
                    AND htr_outpatient <> 'Y'
                    AND htr_admitdate BETWEEN $21::timestamp AND $22::timestamp
            ) AS tbl_capcuu
        ) AS tblTong
        LEFT JOIN sys_dept ON(sd_id = ma_khoa)
        WHERE ma_khoa NOT IN ('NGOAICT') 
        GROUP BY ma_khoa, ten_khoa
    `;

    try {
        const result = await pool.query(query, [startDate, startDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            endDate, endDate,
            startDate, startDate,
            startDate, startDate
        ]);
        res.json(result.rows);

    } catch (error) {
        console.error('Lỗi khi truy vấn chi tiết điều trị ngoại trú trong nội trú:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn chi tiết điều trị ngoại trú trong nội trú' });
    }
});

app.get('/api/sumchitietdieutringoaitrutrongkhoa', async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = `
        SELECT 
            SUM(bn_dauky) AS bn_dauky,
            SUM(bn_vaovien) AS bn_vaovien,
            SUM(bn_ravien) AS bn_ravien,
            SUM(bn_chuyenkhoa_den) AS bn_chuyenkhoa_den,
            SUM(bn_chuyenkhoa_di) AS bn_chuyenkhoa_di,
            SUM(bn_chuyenvien) AS bn_chuyenvien,
            SUM(bn_tuvong) AS bn_tuvong,
            SUM(bn_cuoiky) AS bn_cuoiky,
            SUM(bn_capcuu) AS bn_capcuu
        FROM (
            SELECT 
                ma_khoa,
                1 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  < $1::timestamp
                    AND (htr_status        ='I'
                    OR (htr_status         ='T'
                    AND htr_dischargedate >= $2::timestamp))
                    AND htr_outpatient = 'Y'
            ) AS tbl_dauky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                1 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx       =1
                    AND htr_outpatient = 'Y'
                    AND htr_admitdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl_vaovien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                1 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                LEFT JOIN hms_clinical_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                WHERE hcr_dischargedate BETWEEN $5::timestamp AND $6::timestamp
                    AND htr_status='T'
                    AND htr_suggestion <> 'F'
                    AND htr_outpatient = 'Y'
            ) AS tbl_ravien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                1 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status IN('I','T')
                    AND htr_idx > 1
                    AND htr_outpatient = 'Y'
                    AND htr_admitdate BETWEEN $7::timestamp AND $8::timestamp
            ) AS tbl_chuyenkhoa_den
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                1 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE  htr_status IN('T')
                    AND htr_suggestion = 'M'
                    AND htr_outpatient = 'Y'
                    AND htr_dischargedate BETWEEN $9::timestamp AND $10::timestamp
            ) AS tbl_chuyenkhoa_di
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                1 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status      ='T'
                    AND htr_suggestion   ='F'
                    AND htr_outpatient = 'Y'
                    AND htr_dischargedate BETWEEN $11::timestamp AND $12::timestamp
            ) AS tbl_chuyenvien
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                1 AS bn_tuvong,
                0 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    hd_patientno AS patientno,
                    hd_docno AS docno,
                    hd_admitdept AS ma_khoa
                FROM hms_doc
                WHERE hd_status    ='T'
                    AND hd_result     IN('5','6','9')
                    AND LENGTH(hd_icd) > 0
                    AND hd_enddate BETWEEN $13::timestamp AND $14::timestamp
                    AND hd_outpatient <> 'Y'
                UNION ALL
                SELECT 
                    hcr_patientno AS patietnNo,
                    hcr_docno AS docno,
                    hcr_admitdept AS ma_khoa
                FROM hms_clinical_record
                LEFT JOIN hms_treatment_record ON (htr_docno = hcr_docno AND hcr_refidx=htr_idx)
                LEFT JOIN hms_doc ON (hcr_docno = hd_docno)
                WHERE hcr_status = 'T' 
                    AND hcr_result IN ('5','6','9')
                    AND LENGTH(hcr_mainicd) > 0
                    AND htr_outpatient = 'Y'
                    AND hcr_dischargedate BETWEEN $15::timestamp AND $16::timestamp
            ) AS tbl_tuvong
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                1 AS bn_cuoiky,
                0 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_admitdate  <= $17::timestamp
                    AND htr_outpatient = 'Y'
                    AND (htr_status       ='I'
                    OR (htr_status        ='T'
                    AND htr_dischargedate > $18::timestamp))
            ) AS tbl_cuoiky
            UNION ALL
            SELECT 
                ma_khoa,
                0 AS bn_dauky,
                0 AS bn_vaovien,
                0 AS bn_ravien,
                0 AS bn_chuyenkhoa_den,
                0 AS bn_chuyenkhoa_di,
                0 AS bn_chuyenvien,
                0 AS bn_tuvong,
                0 AS bn_cuoiky,
                1 AS bn_capcuu
            FROM (
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_status       IN('I','T')
                    AND htr_emergency      ='Y'
                    AND htr_outpatient = 'Y'
                    AND htr_admitdate      < $19::timestamp
                    AND (htr_status        ='I'
                    OR(htr_status          ='T'
                    AND htr_dischargedate >= $20::timestamp))
                UNION ALL
                SELECT 
                    htr_deptid AS ma_khoa,
                    htr_idx          AS idx,
                    htr_docno        AS docno
                FROM hms_treatment_record
                WHERE htr_emergency='Y'
                    AND htr_outpatient = 'Y'
                    AND htr_admitdate BETWEEN $21::timestamp AND $22::timestamp
            ) AS tbl_capcuu
        ) AS tblTong
        WHERE ma_khoa NOT IN ('NGOAICT') 
    `;

    try {
        const result = await pool.query(query, [startDate, startDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            endDate, endDate,
            startDate, startDate,
            startDate, startDate
        ]);

        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng chi tiết điều trị ngoại trú trong nội trú:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng chi tiết điều trị ngoại trú trong nội trú' });
    }
});

app.get('/dm-baocaocls', (req, res) => {
    /* Lấy ngày hiện tại
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaocls', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy ngày hôm trước */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaocls', {
        startDateBCCLS: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateBCCLS: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

app.get('/api/baocaocls', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        WITH cte1 AS (
            SELECT 
                ma_nhom, 
                SUM(tong_cong) AS tong_cong, 
                SUM(bh_ngoaitru) AS bh_ngoaitru, 
                SUM(dv_ngoaitru) AS dv_ngoaitru,
                SUM(bh_noitru) AS bh_noitru, 
                SUM(dv_noitru) AS dv_noitru
            FROM (
                SELECT 
                    ma_nhom, 
                    CASE WHEN depttype = 'I' THEN 1 ELSE 0 END AS Noitru, 
                    CASE WHEN depttype = 'I' AND hd_object <> '7' THEN 1 ELSE 0 END AS bh_noitru, 
                    CASE WHEN depttype = 'I' AND hd_object = '7' THEN 1 ELSE 0 END AS dv_noitru, 
                    CASE WHEN depttype = 'E' THEN 1 ELSE 0 END AS Ngoaitru, 
                    CASE WHEN depttype = 'E' AND hd_object <> '7' THEN 1 ELSE 0 END AS bh_ngoaitru, 
                    CASE WHEN depttype = 'E' AND hd_object = '7' THEN 1 ELSE 0 END AS dv_ngoaitru, 
                    1 AS tong_cong 
                FROM (
                    SELECT 
                        hpc_docno AS docno, 
                        hpc_groupid AS ma_nhom, 
                        hpc_class AS depttype 
                    FROM hms_testorder 
                    WHERE hpc_status <> 'O' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $1::timestamp AND $2::timestamp
                    UNION ALL 
                    SELECT 
                        hpc_docno AS docno, 
                        hpc_groupid AS ma_nhom, 
                        hpc_class AS depttype 
                    FROM hms_pacsorder 
                    LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid)
                    WHERE hpc_status <> 'O' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $3::timestamp AND $4::timestamp
                ) AS tbl 
                LEFT JOIN hms_doc ON (hd_docno = docno)
            ) AS tbl2 
            GROUP BY ma_nhom
        ),
        cte2 AS (
            SELECT 
                ma_nhom, 
                SUM(noi_soi) AS noi_soi,
                SUM(noi_soi_tmh) AS noi_soi_tmh,
                SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
				SUM(noi_soi_hohap) AS noi_soi_hohap,
                SUM(noi_soi_tucung) AS noi_soi_tucung
            FROM (
                SELECT 
                    hpc_docno AS docno, 
                    hpc_groupid AS ma_nhom, 
                    hpc_class AS depttype,
                    CASE
                        WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN 1
                        ELSE 0
                        END AS noi_soi,
                    CASE
                        WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN 1
                        ELSE 0
                        END AS noi_soi_tmh,
                    CASE
                        WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN 1
                        ELSE 0
                        END AS noi_soi_tieuhoa,
                    CASE
                        WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN 1
                        ELSE 0
                        END AS noi_soi_hohap,				
                    CASE
                        WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN 1
                        ELSE 0
                        END AS noi_soi_tucung  
                FROM hms_pacsorder 
                LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid) 
                LEFT JOIN hms_fee_list ON (hpcl_itemid = hfl_feeid)
                WHERE hpc_status <> 'O' 
                AND (hpc_payment = 'P' OR hpc_status = 'T') 
                AND hpc_orderdate BETWEEN $5::timestamp AND $6::timestamp
                AND hpc_groupid = 'B3100' 
            ) AS tbl3 
            GROUP BY ma_nhom
        )
        SELECT 
            ROW_NUMBER() OVER (ORDER BY cte1.ma_nhom) AS stt,
            (SELECT hfg_name FROM hms_fee_group WHERE hfg_id = cte1.ma_nhom) AS nhom_cls,
            cte1.tong_cong,
            cte1.bh_ngoaitru,
            cte1.dv_ngoaitru,
            cte1.bh_noitru,
            cte1.dv_noitru,
            COALESCE(cte2.noi_soi, 0) AS noi_soi,
			COALESCE(cte2.noi_soi_tmh, 0) AS noi_soi_tmh,
            COALESCE(cte2.noi_soi_tieuhoa, 0) AS noi_soi_tieuhoa,
            COALESCE(cte2.noi_soi_hohap, 0) AS noi_soi_hohap,
            COALESCE(cte2.noi_soi_tucung, 0) AS noi_soi_tucung 
        FROM cte1
        LEFT JOIN cte2 ON cte1.ma_nhom = cte2.ma_nhom
        ORDER BY cte1.ma_nhom;
    `;

    try {
        const result = await pool.query(query, [startDate, endDate, startDate, endDate, startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn cls:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn cls' });
    }
});

app.get('/api/sumbaocaocls', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
    WITH cte1 AS (
        SELECT 
            ma_nhom, 
            SUM(tong_cong) AS tong_cong, 
            SUM(bh_ngoaitru) AS bh_ngoaitru, 
            SUM(dv_ngoaitru) AS dv_ngoaitru,
            SUM(bh_noitru) AS bh_noitru, 
            SUM(dv_noitru) AS dv_noitru
        FROM (
            SELECT 
                ma_nhom, 
                CASE WHEN depttype = 'I' THEN 1 ELSE 0 END AS Noitru, 
                CASE WHEN depttype = 'I' AND hd_object <> '7' THEN 1 ELSE 0 END AS bh_noitru, 
                CASE WHEN depttype = 'I' AND hd_object = '7' THEN 1 ELSE 0 END AS dv_noitru, 
                CASE WHEN depttype = 'E' THEN 1 ELSE 0 END AS Ngoaitru, 
                CASE WHEN depttype = 'E' AND hd_object <> '7' THEN 1 ELSE 0 END AS bh_ngoaitru, 
                CASE WHEN depttype = 'E' AND hd_object = '7' THEN 1 ELSE 0 END AS dv_ngoaitru, 
                1 AS tong_cong 
            FROM (
                SELECT 
                    hpc_docno AS docno, 
                    hpc_groupid AS ma_nhom, 
                    hpc_class AS depttype 
                FROM hms_testorder 
                WHERE hpc_status <> 'O' 
                AND (hpc_payment = 'P' OR hpc_status = 'T') 
                AND hpc_orderdate BETWEEN $1::timestamp AND $2::timestamp
                UNION ALL 
                SELECT 
                    hpc_docno AS docno, 
                    hpc_groupid AS ma_nhom, 
                    hpc_class AS depttype 
                FROM hms_pacsorder 
                LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid)
                WHERE hpc_status <> 'O' 
                AND (hpc_payment = 'P' OR hpc_status = 'T') 
                AND hpc_orderdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl 
            LEFT JOIN hms_doc ON (hd_docno = docno)
        ) AS tbl2 
        GROUP BY ma_nhom
    ),
    cte2 AS (
        SELECT 
            ma_nhom, 
            SUM(noi_soi) AS noi_soi,
            SUM(noi_soi_tmh) AS noi_soi_tmh,
            SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
            SUM(noi_soi_hohap) AS noi_soi_hohap,
            SUM(noi_soi_tucung) AS noi_soi_tucung 
        FROM (
            SELECT 
                hpc_docno AS docno, 
                hpc_groupid AS ma_nhom, 
                hpc_class AS depttype,
                CASE
                    WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN 1
                    ELSE 0
                    END AS noi_soi,
                CASE
                    WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN 1
                    ELSE 0
                    END AS noi_soi_tmh,
                CASE
                    WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN 1
                    ELSE 0
                    END AS noi_soi_tieuhoa,
                CASE
                    WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN 1
                    ELSE 0
                    END AS noi_soi_hohap,				
                CASE
                    WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN 1
                    ELSE 0
                    END AS noi_soi_tucung 
            FROM hms_pacsorder 
            LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid) 
            LEFT JOIN hms_fee_list ON (hpcl_itemid = hfl_feeid)
            WHERE hpc_status <> 'O' 
            AND (hpc_payment = 'P' OR hpc_status = 'T') 
            AND hpc_orderdate BETWEEN $5::timestamp AND $6::timestamp
            AND hpc_groupid = 'B3100' 
        ) AS tbl3 
        GROUP BY ma_nhom
    ),
    main_query AS (
        SELECT 
            ROW_NUMBER() OVER (ORDER BY cte1.ma_nhom) AS stt,
            (SELECT hfg_name FROM hms_fee_group WHERE hfg_id = cte1.ma_nhom) AS nhom_cls,
            cte1.tong_cong,
            cte1.bh_ngoaitru,
            cte1.dv_ngoaitru,
            cte1.bh_noitru,
            cte1.dv_noitru,
            COALESCE(cte2.noi_soi, 0) AS noi_soi,
			COALESCE(cte2.noi_soi_tmh, 0) AS noi_soi_tmh,
            COALESCE(cte2.noi_soi_tieuhoa, 0) AS noi_soi_tieuhoa,
            COALESCE(cte2.noi_soi_hohap, 0) AS noi_soi_hohap,
            COALESCE(cte2.noi_soi_tucung, 0) AS noi_soi_tucung 
        FROM cte1
        LEFT JOIN cte2 ON cte1.ma_nhom = cte2.ma_nhom        
    )
    SELECT 
        SUM(tong_cong) AS tong_cong,
        SUM(bh_ngoaitru) AS bh_ngoaitru,
        SUM(dv_ngoaitru) AS dv_ngoaitru,
        SUM(bh_noitru) AS bh_noitru,
        SUM(dv_noitru) AS dv_noitru,
        SUM(noi_soi) AS noi_soi,
        SUM(noi_soi_tmh) AS noi_soi_tmh,
        SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
        SUM(noi_soi_hohap) AS noi_soi_hohap,
        SUM(noi_soi_tucung) AS noi_soi_tucung
    FROM main_query;
    `;

    try {
        const result = await pool.query(query, [startDate, endDate, startDate, endDate, startDate, endDate]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum cls:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum cls' });
    }
});

app.get('/api/baocaoclstheokhoa', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY sum(tong_cong) DESC) AS stt,
            ma_khoa,
            (SELECT sd_name FROM sys_dept WHERE sd_id = ma_khoa) AS ten_khoa,
            sum(tong_cong) AS tong_cong,
            SUM(CASE WHEN ma_nhom = 'B1100' THEN tong_cong ELSE 0 END) AS xn_hh,
            SUM(CASE WHEN ma_nhom = 'B1200' THEN tong_cong ELSE 0 END) AS xn_sh,
            SUM(CASE WHEN ma_nhom = 'B1300' THEN tong_cong ELSE 0 END) AS xn_nt,
            SUM(CASE WHEN ma_nhom = 'B1500' THEN tong_cong ELSE 0 END) AS xn_vs,
            SUM(CASE WHEN substr(ma_nhom, 1, 2) = 'B1' AND ma_nhom NOT IN ('B1500','B1300','B1200','B1100') THEN tong_cong ELSE 0 END) AS xn_khac,
            SUM(CASE WHEN ma_nhom IN ('B2100','B2600') THEN tong_cong ELSE 0 END) AS x_quang_kts,
            SUM(CASE WHEN ma_nhom = 'B2200' THEN tong_cong ELSE 0 END) AS citi,
            SUM(CASE WHEN ma_nhom = 'B2300' THEN tong_cong ELSE 0 END) AS mri,
            SUM(CASE WHEN ma_nhom IN ('B2400','B2500') THEN tong_cong ELSE 0 END) AS sieu_am_mau,
            SUM(CASE WHEN substr(ma_nhom, 1, 2) = 'B2' AND ma_nhom NOT IN ('B2100','B2200','B2600','B2400','B2500') THEN tong_cong ELSE 0 END) AS cdha_khac,
            SUM(noi_soi) AS noi_soi,
            SUM(noi_soi_tmh) AS noi_soi_tmh,
            SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
            SUM(noi_soi_hohap) AS noi_soi_hohap,
            SUM(noi_soi_tucung) AS noi_soi_tucung, 
            SUM(CASE WHEN ma_nhom IN ('B3300','B3400') THEN tong_cong ELSE 0 END) AS dien_tim,
            SUM(CASE WHEN ma_nhom = 'B3600' THEN tong_cong ELSE 0 END) AS cnhh,
            SUM(CASE WHEN ma_nhom = 'B3500' THEN tong_cong ELSE 0 END) AS tdcn
        FROM (
            SELECT 
                ma_khoa,
                ma_nhom,
                (SELECT hfg_name FROM hms_fee_group WHERE hfg_id = ma_nhom) AS nhom_cls,
                1 AS tong_cong,
                0 AS noi_soi,
				0 AS noi_soi_tmh,
				0 AS noi_soi_tieuhoa,
				0 AS noi_soi_hohap,
				0 AS noi_soi_tucung 
            FROM (
                    SELECT 
                            hpc_docno AS docno, 
                            hpc_deptid AS ma_khoa,
                            hpc_groupid AS ma_nhom
                    FROM hms_testorder
                    WHERE hpc_status <> 'O' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $1::timestamp AND $2::timestamp
                    UNION ALL 
                    SELECT 
                            hpc_docno AS docno, 
                            hpc_deptid AS ma_khoa,
                            hpc_groupid AS ma_nhom
                    FROM hms_pacsorder
                    LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid)
                    WHERE hpc_status <> 'O' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl1
            UNION ALL
            SELECT 
                ma_khoa,
                ma_nhom,
                nhom_cls,
                0 AS tong_cong,
                SUM(noi_soi) AS noi_soi,
				SUM(noi_soi_tmh) AS noi_soi_tmh,
				SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
				SUM(noi_soi_hohap) AS noi_soi_hohap,
				SUM(noi_soi_tucung) AS noi_soi_tucung 
            FROM (
                SELECT 
                    ma_khoa,
                    ma_nhom,
                    CASE WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN 'Nội soi khác'
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN 'Nội soi tai mũi họng' 
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN 'Nội soi tiêu hóa' 
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN 'Nội soi hô hấp' 
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN 'Nội soi tử cung'
                            ELSE '' END AS nhom_cls,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN 1
                            ELSE 0
                            END AS noi_soi,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN 1
                            ELSE 0
                            END AS noi_soi_tmh,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN 1
                            ELSE 0
                            END AS noi_soi_tieuhoa,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN 1
                            ELSE 0
                            END AS noi_soi_hohap,				
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN 1
                            ELSE 0
                            END AS noi_soi_tucung 
                FROM (
                    SELECT 
                            hpc_docno AS docno, 
                            hpc_deptid AS ma_khoa,
                            hpc_groupid AS ma_nhom,
                            hpcl_itemid
                    FROM hms_pacsorder
                    LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid)
                    WHERE hpc_status <> 'O' 
                    AND hpc_groupid = 'B3100' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $5::timestamp AND $6::timestamp
                ) AS tbl2
                LEFT JOIN hms_fee_list ON (hpcl_itemid = hfl_feeid)
            ) AS tbl3
            GROUP BY ma_khoa, ma_nhom, nhom_cls
        ) AS tblTong
        GROUP BY ma_khoa
        ORDER BY tong_cong DESC;
    `;

    try {
        const result = await pool.query(query, [startDate, endDate, startDate, endDate, startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn cls theo khoa:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn cls theo khoa' });
    }
});

app.get('/api/sumbaocaoclstheokhoa', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
       SELECT 
            sum(tong_cong) AS tong_cong,
            SUM(CASE WHEN ma_nhom = 'B1100' THEN tong_cong ELSE 0 END) AS xn_hh,
            SUM(CASE WHEN ma_nhom = 'B1200' THEN tong_cong ELSE 0 END) AS xn_sh,
            SUM(CASE WHEN ma_nhom = 'B1300' THEN tong_cong ELSE 0 END) AS xn_nt,
            SUM(CASE WHEN ma_nhom = 'B1500' THEN tong_cong ELSE 0 END) AS xn_vs,
            SUM(CASE WHEN substr(ma_nhom, 1, 2) = 'B1' AND ma_nhom NOT IN ('B1500','B1300','B1200','B1100') THEN tong_cong ELSE 0 END) AS xn_khac,
            SUM(CASE WHEN ma_nhom IN ('B2100','B2600') THEN tong_cong ELSE 0 END) AS x_quang_kts,
            SUM(CASE WHEN ma_nhom = 'B2200' THEN tong_cong ELSE 0 END) AS citi,
            SUM(CASE WHEN ma_nhom = 'B2300' THEN tong_cong ELSE 0 END) AS mri,
            SUM(CASE WHEN ma_nhom IN ('B2400','B2500') THEN tong_cong ELSE 0 END) AS sieu_am_mau,
            SUM(CASE WHEN substr(ma_nhom, 1, 2) = 'B2' AND ma_nhom NOT IN ('B2100','B2200','B2600','B2400','B2500') THEN tong_cong ELSE 0 END) AS cdha_khac,
            SUM(noi_soi) AS noi_soi,
            SUM(noi_soi_tmh) AS noi_soi_tmh,
            SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
            SUM(noi_soi_hohap) AS noi_soi_hohap,
            SUM(noi_soi_tucung) AS noi_soi_tucung, 
            SUM(CASE WHEN ma_nhom IN ('B3300','B3400') THEN tong_cong ELSE 0 END) AS dien_tim,
            SUM(CASE WHEN ma_nhom = 'B3600' THEN tong_cong ELSE 0 END) AS cnhh,
            SUM(CASE WHEN ma_nhom = 'B3500' THEN tong_cong ELSE 0 END) AS tdcn
        FROM (
            SELECT 
                ma_khoa,
                ma_nhom,
                (SELECT hfg_name FROM hms_fee_group WHERE hfg_id = ma_nhom) AS nhom_cls,
                1 AS tong_cong,
                0 AS noi_soi,
				0 AS noi_soi_tmh,
				0 AS noi_soi_tieuhoa,
				0 AS noi_soi_hohap,
				0 AS noi_soi_tucung 
            FROM (
                    SELECT 
                            hpc_docno AS docno, 
                            hpc_deptid AS ma_khoa,
                            hpc_groupid AS ma_nhom
                    FROM hms_testorder
                    WHERE hpc_status <> 'O' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $1::timestamp AND $2::timestamp
                    UNION ALL 
                    SELECT 
                            hpc_docno AS docno, 
                            hpc_deptid AS ma_khoa,
                            hpc_groupid AS ma_nhom
                    FROM hms_pacsorder
                    LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid)
                    WHERE hpc_status <> 'O' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $3::timestamp AND $4::timestamp
            ) AS tbl1
            UNION ALL
            SELECT 
                ma_khoa,
                ma_nhom,
                nhom_cls,
                0 AS tong_cong,
                SUM(noi_soi) AS noi_soi,
				SUM(noi_soi_tmh) AS noi_soi_tmh,
				SUM(noi_soi_tieuhoa) AS noi_soi_tieuhoa,
				SUM(noi_soi_hohap) AS noi_soi_hohap,
				SUM(noi_soi_tucung) AS noi_soi_tucung 
            FROM (
                SELECT 
                    ma_khoa,
                    ma_nhom,
                    CASE WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN 'Nội soi khác'
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN 'Nội soi tai mũi họng' 
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN 'Nội soi tiêu hóa' 
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN 'Nội soi hô hấp' 
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN 'Nội soi tử cung'
                            ELSE '' END AS nhom_cls,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN 1
                            ELSE 0
                            END AS noi_soi,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN 1
                            ELSE 0
                            END AS noi_soi_tmh,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN 1
                            ELSE 0
                            END AS noi_soi_tieuhoa,
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN 1
                            ELSE 0
                            END AS noi_soi_hohap,				
                    CASE
                            WHEN substr(hfl_groupid, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN 1
                            ELSE 0
                            END AS noi_soi_tucung 
                FROM (
                    SELECT 
                            hpc_docno AS docno, 
                            hpc_deptid AS ma_khoa,
                            hpc_groupid AS ma_nhom,
                            hpcl_itemid
                    FROM hms_pacsorder
                    LEFT JOIN hms_pacsorderline ON (hpcl_orderid = hpc_orderid)
                    WHERE hpc_status <> 'O' 
                    AND hpc_groupid = 'B3100' 
                    AND (hpc_payment = 'P' OR hpc_status = 'T') 
                    AND hpc_orderdate BETWEEN $5::timestamp AND $6::timestamp
                ) AS tbl2
                LEFT JOIN hms_fee_list ON (hpcl_itemid = hfl_feeid)
            ) AS tbl3
            GROUP BY ma_khoa, ma_nhom, nhom_cls
        ) AS tblTong         
    `;

    try {
        const result = await pool.query(query, [startDate, endDate, startDate, endDate, startDate, endDate]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum cls theo khoa:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum cls theo khoa' });
    }
});

app.get('/dm-baocaopttt', (req, res) => {
    /* Lấy mặc định ngày hiện tại
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaopttt', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy trước một ngày mặc định ngày hiện tại */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaopttt', {
        startDateBCPTTT: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateBCPTTT: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

app.get('/api/baocaopttt', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            row_number() over(order by groupid) stt,
            grouptype, 
            groupid, 
            operatype as description, 
            SUM(tong_cong) AS tong_cong, 
            SUM(bh_ngoaitru) AS bh_ngoaitru, 
            SUM(dv_ngoaitru) AS dv_ngoaitru,
            SUM(bh_noitru) AS bh_noitru, 
            SUM(dv_noitru) AS dv_noitru
        FROM (
            SELECT 
                substr(hfl_groupid, 1, 2) as grouptype, 
                (select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
                hfl_groupid as groupid, 
                ho_itemid as itemid, 
                ho_refidx, 
                ho_qty as tong_cong, 
                CASE WHEN ho_depttype = 'I' AND hd_object <> '7' THEN ho_qty ELSE 0 END AS bh_noitru, 
                CASE WHEN ho_depttype = 'I' AND hd_object = '7' THEN ho_qty ELSE 0 END AS dv_noitru, 
                CASE WHEN ho_depttype = 'E' AND hd_object <> '7' THEN ho_qty ELSE 0 END AS bh_ngoaitru, 
                CASE WHEN ho_depttype = 'E' AND hd_object = '7' THEN ho_qty ELSE 0 END AS dv_ngoaitru
            FROM hms_operation 
            LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
            LEFT JOIN hms_doc ON(hd_docno = ho_docno) 
            WHERE ho_status = 'T'
            AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
        ) as tbl 
        WHERE 
        length(operatype) > 0 
        GROUP BY grouptype, groupid, operatype 
        ORDER BY grouptype, groupid, operatype
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn pttt:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn pttt' });
    }
});

app.get('/api/sumbaocaopttt', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            SUM(tong_cong) AS tong_cong, 
            SUM(bh_ngoaitru) AS bh_ngoaitru, 
            SUM(dv_ngoaitru) AS dv_ngoaitru,
            SUM(bh_noitru) AS bh_noitru, 
            SUM(dv_noitru) AS dv_noitru
        FROM 
        (
            SELECT 
            substr(hfl_groupid, 1, 2) as grouptype, 
            (
                select 
                distinct hfg_name 
                from 
                hms_fee_group 
                where 
                hfg_id = hfl_groupid
            ) as operatype, 
            hfl_groupid as groupid, 
            ho_itemid as itemid, 
            ho_refidx, 
            ho_qty as tong_cong, 
            CASE WHEN ho_depttype = 'I' AND hd_object <> '7' THEN ho_qty ELSE 0 END AS bh_noitru, 
                    CASE WHEN ho_depttype = 'I' AND hd_object = '7' THEN ho_qty ELSE 0 END AS dv_noitru, 
            CASE WHEN ho_depttype = 'E' AND hd_object <> '7' THEN ho_qty ELSE 0 END AS bh_ngoaitru, 
                    CASE WHEN ho_depttype = 'E' AND hd_object = '7' THEN ho_qty ELSE 0 END AS dv_ngoaitru
            FROM 
            hms_operation 
            LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
            LEFT JOIN hms_doc ON(hd_docno = ho_docno) 
            LEFT JOIN hms_treatment_record ON(
                ho_docno = htr_docno 
                and ho_refidx = htr_idx
            ) 
            WHERE 
            ho_orderdate BETWEEN $1::timestamp AND $2::timestamp 
            and ho_status = 'T'
        ) as tbl 
        WHERE 
        length(operatype) > 0
    `;

    try {
        const result = await pool.query(query, [startDate, endDate,]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum pttt:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum pttt' });
    }
});

app.get('/api/baocaopttttheobacsi', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
					row_number() over(order by tong_cong DESC) stt,
					(SELECT su_name FROM sys_user WHERE su_certificate = chung_chi_hanh_nghe limit 1) AS nguoi_thuc_hien,
	                chung_chi_hanh_nghe,
					pt_loai_db,
					pt_loai_1,
					pt_loai_1a,
					pt_loai_1b,
					pt_loai_1c,
					pt_loai_2,
					pt_loai_2a,
					pt_loai_2b,
					pt_loai_2c,
					pt_loai_3,
					pt_loai_3a,
					pt_loai_3b,
					pt_loai_3c,
					tong_cong
				FROM (
					SELECT 
						chung_chi_hanh_nghe,
						SUM(pt_loai_db) AS pt_loai_db,
						SUM(pt_loai_1) AS pt_loai_1,
						SUM(pt_loai_1a) AS pt_loai_1a,
						SUM(pt_loai_1b) AS pt_loai_1b,
						SUM(pt_loai_1c) AS pt_loai_1c,
						SUM(pt_loai_2) AS pt_loai_2,
						SUM(pt_loai_2a) AS pt_loai_2a,
						SUM(pt_loai_2b) AS pt_loai_2b,
						SUM(pt_loai_2c) AS pt_loai_2c,
						SUM(pt_loai_3) AS pt_loai_3,
						SUM(pt_loai_3a) AS pt_loai_3a,
						SUM(pt_loai_3b) AS pt_loai_3b,
						SUM(pt_loai_3c) AS pt_loai_3c,
						SUM(pt_loai_1+pt_loai_db+pt_loai_1a+pt_loai_1b+pt_loai_1c+
						pt_loai_2+pt_loai_2a+pt_loai_2b+pt_loai_2c+
						pt_loai_3+pt_loai_3a+pt_loai_3b+pt_loai_3c) AS tong_cong
					FROM (
						SELECT 
							substr(hfl_groupid, 1, 2) as grouptype, 
							ho_docno,
							(select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
							hfl_groupid as groupid, 
							ho_itemid as itemid,
							ho_practitioner AS nguoi_thuc_hien,
			                su_certificate AS chung_chi_hanh_nghe,
							CASE WHEN hfl_groupid = 'B4400' THEN ho_qty ELSE 0 END AS pt_loai_db,
							CASE WHEN hfl_groupid = 'B4100' THEN ho_qty ELSE 0 END AS pt_loai_1,
							CASE WHEN hfl_groupid = 'B4110' THEN ho_qty ELSE 0 END AS pt_loai_1a,
							CASE WHEN hfl_groupid = 'B4120' THEN ho_qty ELSE 0 END AS pt_loai_1b,
							CASE WHEN hfl_groupid = 'B4130' THEN ho_qty ELSE 0 END AS pt_loai_1c,
							CASE WHEN hfl_groupid = 'B4200' THEN ho_qty ELSE 0 END AS pt_loai_2,
							CASE WHEN hfl_groupid = 'B4210' THEN ho_qty ELSE 0 END AS pt_loai_2a,
							CASE WHEN hfl_groupid = 'B4220' THEN ho_qty ELSE 0 END AS pt_loai_2b,
							CASE WHEN hfl_groupid = 'B4230' THEN ho_qty ELSE 0 END AS pt_loai_2c,
							CASE WHEN hfl_groupid = 'B4300' THEN ho_qty ELSE 0 END AS pt_loai_3,
							CASE WHEN hfl_groupid = 'B4310' THEN ho_qty ELSE 0 END AS pt_loai_3a,
							CASE WHEN hfl_groupid = 'B4320' THEN ho_qty ELSE 0 END AS pt_loai_3b,
							CASE WHEN hfl_groupid = 'B4330' THEN ho_qty ELSE 0 END AS pt_loai_3c
						FROM hms_operation 
						LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
                        LEFT JOIN sys_user ON (ho_practitioner = su_userid)
						WHERE ho_status = 'T'  
						AND substr(hfl_groupid,1,2) = 'B4' 
						AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
					) as tbl 
						GROUP BY chung_chi_hanh_nghe
				) AS tbltong
					ORDER BY tong_cong DESC
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn pttt theo bác sĩ:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn pttt theo bác sĩ' });
    }
});

app.get('/api/sumbaocaopttttheobacsi', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        	SELECT 
						SUM(pt_loai_db) AS pt_loai_db,
						SUM(pt_loai_1) AS pt_loai_1,
						SUM(pt_loai_1a) AS pt_loai_1a,
						SUM(pt_loai_1b) AS pt_loai_1b,
						SUM(pt_loai_1c) AS pt_loai_1c,
						SUM(pt_loai_2) AS pt_loai_2,
						SUM(pt_loai_2a) AS pt_loai_2a,
						SUM(pt_loai_2b) AS pt_loai_2b,
						SUM(pt_loai_2c) AS pt_loai_2c,
						SUM(pt_loai_3) AS pt_loai_3,
						SUM(pt_loai_3a) AS pt_loai_3a,
						SUM(pt_loai_3b) AS pt_loai_3b,
						SUM(pt_loai_3c) AS pt_loai_3c,
						SUM(pt_loai_1+pt_loai_db+pt_loai_1a+pt_loai_1b+pt_loai_1c+
						pt_loai_2+pt_loai_2a+pt_loai_2b+pt_loai_2c+
						pt_loai_3+pt_loai_3a+pt_loai_3b+pt_loai_3c) AS tong_cong
					FROM (
						SELECT 
							substr(hfl_groupid, 1, 2) as grouptype, 
							ho_docno,
							(select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
							hfl_groupid as groupid, 
							ho_itemid as itemid,
							ho_practitioner AS nguoi_thuc_hien,
							CASE WHEN hfl_groupid = 'B4400' THEN ho_qty ELSE 0 END AS pt_loai_db,
							CASE WHEN hfl_groupid = 'B4100' THEN ho_qty ELSE 0 END AS pt_loai_1,
							CASE WHEN hfl_groupid = 'B4110' THEN ho_qty ELSE 0 END AS pt_loai_1a,
							CASE WHEN hfl_groupid = 'B4120' THEN ho_qty ELSE 0 END AS pt_loai_1b,
							CASE WHEN hfl_groupid = 'B4130' THEN ho_qty ELSE 0 END AS pt_loai_1c,
							CASE WHEN hfl_groupid = 'B4200' THEN ho_qty ELSE 0 END AS pt_loai_2,
							CASE WHEN hfl_groupid = 'B4210' THEN ho_qty ELSE 0 END AS pt_loai_2a,
							CASE WHEN hfl_groupid = 'B4220' THEN ho_qty ELSE 0 END AS pt_loai_2b,
							CASE WHEN hfl_groupid = 'B4230' THEN ho_qty ELSE 0 END AS pt_loai_2c,
							CASE WHEN hfl_groupid = 'B4300' THEN ho_qty ELSE 0 END AS pt_loai_3,
							CASE WHEN hfl_groupid = 'B4310' THEN ho_qty ELSE 0 END AS pt_loai_3a,
							CASE WHEN hfl_groupid = 'B4320' THEN ho_qty ELSE 0 END AS pt_loai_3b,
							CASE WHEN hfl_groupid = 'B4330' THEN ho_qty ELSE 0 END AS pt_loai_3c
						FROM hms_operation 
						LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
						WHERE ho_status = 'T'  
						AND substr(hfl_groupid,1,2) = 'B4' 
						AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp 
					) as tbl 
    `;

    try {
        const result = await pool.query(query, [startDate, endDate,]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum pttt theo bác sĩ:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum pttt theo bác sĩ' });
    }
});

app.get('/api/baocaopttttheokhoaphong', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            row_number() over(order by tong_cong DESC) stt,
            ma_khoa, 
            ten_khoa,
            pt_loai_db,
            pt_loai_1,
            pt_loai_1a,
            pt_loai_1b,
            pt_loai_1c,
            pt_loai_2,
            pt_loai_2a,
            pt_loai_2b,
            pt_loai_2c,
            pt_loai_3,
            pt_loai_3a,
            pt_loai_3b,
            pt_loai_3c,
            tong_cong
        FROM (
            SELECT 
                ma_khoa,
                ten_khoa,
                SUM(pt_loai_db) AS pt_loai_db,
                SUM(pt_loai_1) AS pt_loai_1,
                SUM(pt_loai_1a) AS pt_loai_1a,
                SUM(pt_loai_1b) AS pt_loai_1b,
                SUM(pt_loai_1c) AS pt_loai_1c,
                SUM(pt_loai_2) AS pt_loai_2,
                SUM(pt_loai_2a) AS pt_loai_2a,
                SUM(pt_loai_2b) AS pt_loai_2b,
                SUM(pt_loai_2c) AS pt_loai_2c,
                SUM(pt_loai_3) AS pt_loai_3,
                SUM(pt_loai_3a) AS pt_loai_3a,
                SUM(pt_loai_3b) AS pt_loai_3b,
                SUM(pt_loai_3c) AS pt_loai_3c,
                SUM(pt_loai_1+pt_loai_db+pt_loai_1a+pt_loai_1b+pt_loai_1c+
                pt_loai_2+pt_loai_2a+pt_loai_2b+pt_loai_2c+
                pt_loai_3+pt_loai_3a+pt_loai_3b+pt_loai_3c) AS tong_cong
            FROM (
                SELECT 
                    substr(hfl_groupid, 1, 2) as grouptype, 
                    ho_docno,
                    (select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
                    hfl_groupid as groupid, 
                    ho_itemid as itemid,
                    ho_deptid AS ma_khoa,
                    sd_name AS ten_khoa,
                    ho_practitioner AS nguoi_thuc_hien,
                    su_certificate AS chung_chi_hanh_nghe,
                    CASE WHEN hfl_groupid = 'B4400' THEN ho_qty ELSE 0 END AS pt_loai_db,
                    CASE WHEN hfl_groupid = 'B4100' THEN ho_qty ELSE 0 END AS pt_loai_1,
                    CASE WHEN hfl_groupid = 'B4110' THEN ho_qty ELSE 0 END AS pt_loai_1a,
                    CASE WHEN hfl_groupid = 'B4120' THEN ho_qty ELSE 0 END AS pt_loai_1b,
                    CASE WHEN hfl_groupid = 'B4130' THEN ho_qty ELSE 0 END AS pt_loai_1c,
                    CASE WHEN hfl_groupid = 'B4200' THEN ho_qty ELSE 0 END AS pt_loai_2,
                    CASE WHEN hfl_groupid = 'B4210' THEN ho_qty ELSE 0 END AS pt_loai_2a,
                    CASE WHEN hfl_groupid = 'B4220' THEN ho_qty ELSE 0 END AS pt_loai_2b,
                    CASE WHEN hfl_groupid = 'B4230' THEN ho_qty ELSE 0 END AS pt_loai_2c,
                    CASE WHEN hfl_groupid = 'B4300' THEN ho_qty ELSE 0 END AS pt_loai_3,
                    CASE WHEN hfl_groupid = 'B4310' THEN ho_qty ELSE 0 END AS pt_loai_3a,
                    CASE WHEN hfl_groupid = 'B4320' THEN ho_qty ELSE 0 END AS pt_loai_3b,
                    CASE WHEN hfl_groupid = 'B4330' THEN ho_qty ELSE 0 END AS pt_loai_3c
                FROM hms_operation 
                LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
                LEFT JOIN sys_user ON (ho_practitioner = su_userid)
                LEFT JOIN sys_dept ON (sd_id = ho_deptid)
                WHERE ho_status = 'T'  
                AND substr(hfl_groupid,1,2) = 'B4' 
                AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
            ) as tbl 
                GROUP BY ma_khoa, ten_khoa
        ) AS tbltong
            ORDER BY tong_cong DESC 
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn pttt theo khoa phòng:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn pttt theo khoa phòng' });
    }
});

app.get('/api/sumbaocaopttttheokhoaphong', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `        	
        SELECT 							
            SUM(pt_loai_db) AS pt_loai_db,
            SUM(pt_loai_1) AS pt_loai_1,
            SUM(pt_loai_1a) AS pt_loai_1a,
            SUM(pt_loai_1b) AS pt_loai_1b,
            SUM(pt_loai_1c) AS pt_loai_1c,
            SUM(pt_loai_2) AS pt_loai_2,
            SUM(pt_loai_2a) AS pt_loai_2a,
            SUM(pt_loai_2b) AS pt_loai_2b,
            SUM(pt_loai_2c) AS pt_loai_2c,
            SUM(pt_loai_3) AS pt_loai_3,
            SUM(pt_loai_3a) AS pt_loai_3a,
            SUM(pt_loai_3b) AS pt_loai_3b,
            SUM(pt_loai_3c) AS pt_loai_3c,
            SUM(pt_loai_1+pt_loai_db+pt_loai_1a+pt_loai_1b+pt_loai_1c+
            pt_loai_2+pt_loai_2a+pt_loai_2b+pt_loai_2c+
            pt_loai_3+pt_loai_3a+pt_loai_3b+pt_loai_3c) AS tong_cong
        FROM (
            SELECT 
                substr(hfl_groupid, 1, 2) as grouptype, 
                ho_docno,
                (select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
                hfl_groupid as groupid, 
                ho_itemid as itemid,
                ho_deptid AS ma_khoa,
                sd_name AS ten_khoa,
                ho_practitioner AS nguoi_thuc_hien,
                su_certificate AS chung_chi_hanh_nghe,
                CASE WHEN hfl_groupid = 'B4400' THEN ho_qty ELSE 0 END AS pt_loai_db,
                CASE WHEN hfl_groupid = 'B4100' THEN ho_qty ELSE 0 END AS pt_loai_1,
                CASE WHEN hfl_groupid = 'B4110' THEN ho_qty ELSE 0 END AS pt_loai_1a,
                CASE WHEN hfl_groupid = 'B4120' THEN ho_qty ELSE 0 END AS pt_loai_1b,
                CASE WHEN hfl_groupid = 'B4130' THEN ho_qty ELSE 0 END AS pt_loai_1c,
                CASE WHEN hfl_groupid = 'B4200' THEN ho_qty ELSE 0 END AS pt_loai_2,
                CASE WHEN hfl_groupid = 'B4210' THEN ho_qty ELSE 0 END AS pt_loai_2a,
                CASE WHEN hfl_groupid = 'B4220' THEN ho_qty ELSE 0 END AS pt_loai_2b,
                CASE WHEN hfl_groupid = 'B4230' THEN ho_qty ELSE 0 END AS pt_loai_2c,
                CASE WHEN hfl_groupid = 'B4300' THEN ho_qty ELSE 0 END AS pt_loai_3,
                CASE WHEN hfl_groupid = 'B4310' THEN ho_qty ELSE 0 END AS pt_loai_3a,
                CASE WHEN hfl_groupid = 'B4320' THEN ho_qty ELSE 0 END AS pt_loai_3b,
                CASE WHEN hfl_groupid = 'B4330' THEN ho_qty ELSE 0 END AS pt_loai_3c
            FROM hms_operation 
            LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
            LEFT JOIN sys_user ON (ho_practitioner = su_userid)
            LEFT JOIN sys_dept ON (sd_id = ho_deptid)
            WHERE ho_status = 'T'  
            AND substr(hfl_groupid,1,2) = 'B4' 
            AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
        ) AS tbltong						
    `;

    try {
        const result = await pool.query(query, [startDate, endDate,]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum pttt theo khoa phòng:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum pttt theo khoa phòng' });
    }
});

app.get('/api/baocaothuthuattheokhoaphong', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            row_number() over(order by tong_cong DESC) stt,
            ma_khoa, 
            ten_khoa,
            tt_loai_db,
            tt_loai_1,
            tt_loai_1a,
            tt_loai_1b,
            tt_loai_1c,
            tt_loai_2,
            tt_loai_2a,
            tt_loai_2b,
            tt_loai_2c,
            tt_loai_3,
            tt_loai_3a,
            tt_loai_3b,
            tt_loai_3c,
            tong_cong
        FROM (
            SELECT 
                ma_khoa,
                ten_khoa,
                SUM(tt_loai_db) AS tt_loai_db,
                SUM(tt_loai_1) AS tt_loai_1,
                SUM(tt_loai_1a) AS tt_loai_1a,
                SUM(tt_loai_1b) AS tt_loai_1b,
                SUM(tt_loai_1c) AS tt_loai_1c,
                SUM(tt_loai_2) AS tt_loai_2,
                SUM(tt_loai_2a) AS tt_loai_2a,
                SUM(tt_loai_2b) AS tt_loai_2b,
                SUM(tt_loai_2c) AS tt_loai_2c,
                SUM(tt_loai_3) AS tt_loai_3,
                SUM(tt_loai_3a) AS tt_loai_3a,
                SUM(tt_loai_3b) AS tt_loai_3b,
                SUM(tt_loai_3c) AS tt_loai_3c,
                SUM(tt_loai_1+tt_loai_db+tt_loai_1a+tt_loai_1b+tt_loai_1c+
                tt_loai_2+tt_loai_2a+tt_loai_2b+tt_loai_2c+
                tt_loai_3+tt_loai_3a+tt_loai_3b+tt_loai_3c) AS tong_cong
            FROM (
                SELECT 
                    substr(hfl_groupid, 1, 2) as grouptype, 
                    ho_docno,
                    (select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
                    hfl_groupid as groupid, 
                    ho_itemid as itemid,
                    ho_deptid AS ma_khoa,
                    sd_name AS ten_khoa,
                    ho_practitioner AS nguoi_thuc_hien,
                    su_certificate AS chung_chi_hanh_nghe,
                    CASE WHEN hfl_groupid = 'B5400' THEN ho_qty ELSE 0 END AS tt_loai_db,
                    CASE WHEN hfl_groupid = 'B5100' THEN ho_qty ELSE 0 END AS tt_loai_1,
                    CASE WHEN hfl_groupid = 'B5110' THEN ho_qty ELSE 0 END AS tt_loai_1a,
                    CASE WHEN hfl_groupid = 'B5120' THEN ho_qty ELSE 0 END AS tt_loai_1b,
                    CASE WHEN hfl_groupid = 'B5130' THEN ho_qty ELSE 0 END AS tt_loai_1c,
                    CASE WHEN hfl_groupid = 'B5200' THEN ho_qty ELSE 0 END AS tt_loai_2,
                    CASE WHEN hfl_groupid = 'B5210' THEN ho_qty ELSE 0 END AS tt_loai_2a,
                    CASE WHEN hfl_groupid = 'B5220' THEN ho_qty ELSE 0 END AS tt_loai_2b,
                    CASE WHEN hfl_groupid = 'B5230' THEN ho_qty ELSE 0 END AS tt_loai_2c,
                    CASE WHEN hfl_groupid = 'B5300' THEN ho_qty ELSE 0 END AS tt_loai_3,
                    CASE WHEN hfl_groupid = 'B5310' THEN ho_qty ELSE 0 END AS tt_loai_3a,
                    CASE WHEN hfl_groupid = 'B5320' THEN ho_qty ELSE 0 END AS tt_loai_3b,
                    CASE WHEN hfl_groupid = 'B5330' THEN ho_qty ELSE 0 END AS tt_loai_3c
                FROM hms_operation 
                LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
                LEFT JOIN sys_user ON (ho_practitioner = su_userid)
                LEFT JOIN sys_dept ON (sd_id = ho_deptid)
                WHERE ho_status = 'T'  
                AND substr(hfl_groupid,1,2) = 'B5' 
                AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
            ) as tbl 
                GROUP BY ma_khoa, ten_khoa
        ) AS tbltong
            ORDER BY tong_cong DESC 
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn thủ thuật theo khoa phòng:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn thủ thuật theo khoa phòng' });
    }
});

app.get('/api/sumbaocaothuthuattheokhoaphong', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
            SELECT 
                SUM(tt_loai_db) AS tt_loai_db,
                SUM(tt_loai_1) AS tt_loai_1,
                SUM(tt_loai_1a) AS tt_loai_1a,
                SUM(tt_loai_1b) AS tt_loai_1b,
                SUM(tt_loai_1c) AS tt_loai_1c,
                SUM(tt_loai_2) AS tt_loai_2,
                SUM(tt_loai_2a) AS tt_loai_2a,
                SUM(tt_loai_2b) AS tt_loai_2b,
                SUM(tt_loai_2c) AS tt_loai_2c,
                SUM(tt_loai_3) AS tt_loai_3,
                SUM(tt_loai_3a) AS tt_loai_3a,
                SUM(tt_loai_3b) AS tt_loai_3b,
                SUM(tt_loai_3c) AS tt_loai_3c,
                SUM(tt_loai_1+tt_loai_db+tt_loai_1a+tt_loai_1b+tt_loai_1c+
                tt_loai_2+tt_loai_2a+tt_loai_2b+tt_loai_2c+
                tt_loai_3+tt_loai_3a+tt_loai_3b+tt_loai_3c) AS tong_cong
            FROM (
                SELECT 
                    substr(hfl_groupid, 1, 2) as grouptype, 
                    ho_docno,
                    (select distinct hfg_name from hms_fee_group where hfg_id = hfl_groupid) as operatype, 
                    hfl_groupid as groupid, 
                    ho_itemid as itemid,
                    ho_deptid AS ma_khoa,
                    sd_name AS ten_khoa,
                    ho_practitioner AS nguoi_thuc_hien,
                    su_certificate AS chung_chi_hanh_nghe,
                    CASE WHEN hfl_groupid = 'B5400' THEN ho_qty ELSE 0 END AS tt_loai_db,
                    CASE WHEN hfl_groupid = 'B5100' THEN ho_qty ELSE 0 END AS tt_loai_1,
                    CASE WHEN hfl_groupid = 'B5110' THEN ho_qty ELSE 0 END AS tt_loai_1a,
                    CASE WHEN hfl_groupid = 'B5120' THEN ho_qty ELSE 0 END AS tt_loai_1b,
                    CASE WHEN hfl_groupid = 'B5130' THEN ho_qty ELSE 0 END AS tt_loai_1c,
                    CASE WHEN hfl_groupid = 'B5200' THEN ho_qty ELSE 0 END AS tt_loai_2,
                    CASE WHEN hfl_groupid = 'B5210' THEN ho_qty ELSE 0 END AS tt_loai_2a,
                    CASE WHEN hfl_groupid = 'B5220' THEN ho_qty ELSE 0 END AS tt_loai_2b,
                    CASE WHEN hfl_groupid = 'B5230' THEN ho_qty ELSE 0 END AS tt_loai_2c,
                    CASE WHEN hfl_groupid = 'B5300' THEN ho_qty ELSE 0 END AS tt_loai_3,
                    CASE WHEN hfl_groupid = 'B5310' THEN ho_qty ELSE 0 END AS tt_loai_3a,
                    CASE WHEN hfl_groupid = 'B5320' THEN ho_qty ELSE 0 END AS tt_loai_3b,
                    CASE WHEN hfl_groupid = 'B5330' THEN ho_qty ELSE 0 END AS tt_loai_3c
                FROM hms_operation 
                LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
                LEFT JOIN sys_user ON (ho_practitioner = su_userid)
                LEFT JOIN sys_dept ON (sd_id = ho_deptid)
                WHERE ho_status = 'T'  
                AND substr(hfl_groupid,1,2) = 'B5' 
                AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
		) AS tbltong						
    `;

    try {
        const result = await pool.query(query, [startDate, endDate,]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum thủ thuật theo khoa phòng:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum thủ thuật theo khoa phòng' });
    }
});

app.get('/api/baocaothuthuattheobenhnhan', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT 
            row_number() over(order by sd_name, TRIM(hp_surname || ' ' || hp_midname || ' ' || hp_firstname)) stt,                   
            ho_docno AS so_hs,
            TRIM(hp_surname || ' ' || hp_midname || ' ' || hp_firstname) AS ten_bn,                                        
            ho_deptid AS ma_khoa,
            sd_name AS ten_khoa,	            		
            SUM(CASE WHEN hfl_groupid = 'B4400' THEN ho_qty ELSE 0 END) AS pt_loai_db,
            SUM(CASE WHEN hfl_groupid = 'B4100' THEN ho_qty ELSE 0 END) AS pt_loai_1,
            SUM(CASE WHEN hfl_groupid = 'B4110' THEN ho_qty ELSE 0 END) AS pt_loai_1a,
            SUM(CASE WHEN hfl_groupid = 'B4120' THEN ho_qty ELSE 0 END) AS pt_loai_1b,
            SUM(CASE WHEN hfl_groupid = 'B4130' THEN ho_qty ELSE 0 END) AS pt_loai_1c,
            SUM(CASE WHEN hfl_groupid = 'B4200' THEN ho_qty ELSE 0 END) AS pt_loai_2,
            SUM(CASE WHEN hfl_groupid = 'B4210' THEN ho_qty ELSE 0 END) AS pt_loai_2a,
            SUM(CASE WHEN hfl_groupid = 'B4220' THEN ho_qty ELSE 0 END) AS pt_loai_2b,
            SUM(CASE WHEN hfl_groupid = 'B4230' THEN ho_qty ELSE 0 END) AS pt_loai_2c,
            SUM(CASE WHEN hfl_groupid = 'B4300' THEN ho_qty ELSE 0 END) AS pt_loai_3,
            SUM(CASE WHEN hfl_groupid = 'B4310' THEN ho_qty ELSE 0 END) AS pt_loai_3a,
            SUM(CASE WHEN hfl_groupid = 'B4320' THEN ho_qty ELSE 0 END) AS pt_loai_3b,
            SUM(CASE WHEN hfl_groupid = 'B4330' THEN ho_qty ELSE 0 END) AS pt_loai_3c
        FROM hms_operation 
        LEFT JOIN hms_patient ON (hp_patientno = ho_patientno)
        LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid)         
        LEFT JOIN sys_dept ON (sd_id = ho_deptid)
        WHERE ho_status = 'T'  
            AND SUBSTR(hfl_groupid, 1, 2) = 'B4' 
            AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp
        GROUP BY 
            ho_docno, hp_surname, hp_midname, hp_firstname, ho_deptid, sd_name
        ORDER BY sd_name, ten_bn 
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn bệnh nhân làm phẫu thuật:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn bệnh nhân làm phẫu thuật' });
    }
});

app.get('/api/sumbaocaopttttheonguoibenh', async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
        SELECT        	
            SUM(CASE WHEN hfl_groupid = 'B4400' THEN ho_qty ELSE 0 END) AS pt_loai_db,
            SUM(CASE WHEN hfl_groupid = 'B4100' THEN ho_qty ELSE 0 END) AS pt_loai_1,
            SUM(CASE WHEN hfl_groupid = 'B4110' THEN ho_qty ELSE 0 END) AS pt_loai_1a,
            SUM(CASE WHEN hfl_groupid = 'B4120' THEN ho_qty ELSE 0 END) AS pt_loai_1b,
            SUM(CASE WHEN hfl_groupid = 'B4130' THEN ho_qty ELSE 0 END) AS pt_loai_1c,
            SUM(CASE WHEN hfl_groupid = 'B4200' THEN ho_qty ELSE 0 END) AS pt_loai_2,
            SUM(CASE WHEN hfl_groupid = 'B4210' THEN ho_qty ELSE 0 END) AS pt_loai_2a,
            SUM(CASE WHEN hfl_groupid = 'B4220' THEN ho_qty ELSE 0 END) AS pt_loai_2b,
            SUM(CASE WHEN hfl_groupid = 'B4230' THEN ho_qty ELSE 0 END) AS pt_loai_2c,
            SUM(CASE WHEN hfl_groupid = 'B4300' THEN ho_qty ELSE 0 END) AS pt_loai_3,
            SUM(CASE WHEN hfl_groupid = 'B4310' THEN ho_qty ELSE 0 END) AS pt_loai_3a,
            SUM(CASE WHEN hfl_groupid = 'B4320' THEN ho_qty ELSE 0 END) AS pt_loai_3b,
            SUM(CASE WHEN hfl_groupid = 'B4330' THEN ho_qty ELSE 0 END) AS pt_loai_3c
        FROM hms_operation 
        LEFT JOIN hms_patient ON (hp_patientno = ho_patientno)
        LEFT JOIN hms_fee_list ON (hfl_feeid = ho_itemid) 
        LEFT JOIN sys_user ON (ho_practitioner = su_userid)
        LEFT JOIN sys_dept ON (sd_id = ho_deptid)
        WHERE ho_status = 'T'  
            AND SUBSTR(hfl_groupid, 1, 2) = 'B4' 
            AND ho_orderdate BETWEEN $1::timestamp AND $2::timestamp						
    `;

    try {
        const result = await pool.query(query, [startDate, endDate,]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn tổng sum phẫu thuật theo người bệnh:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tổng sum phẫu thuật theo người bệnh' });
    }
});

app.get('/dm-baocaothcpkhoaphong', (req, res) => {
    /* Lấy mặc định ngày hiện tại
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaopttt', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy trước một ngày mặc định ngày hiện tại */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaothcpkhoaphong', {
        startDateBCTHCPKhoaPhong: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateBCTHCPKhoaPhong: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

app.get('/api/baocaothcpkhoaphong', async (req, res) => {
    const { startDate, endDate } = req.query;

    // Kiểm tra tham số đầu vào
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Thiếu tham số startDate hoặc endDate' });
    }

    const query = `
        SELECT  
            row_number() over(order by ma_khoa DESC) stt, 
            ma_khoa, 
            ten_khoa, 
            sum(tong_chi_phi) AS tong_chi_phi, 
            sum(bao_hiem_tra) AS bao_hiem_tra, 
            sum(tong_bao_hiem-bao_hiem_tra) AS dich_vu_tra, 
            sum(chenh_lech) AS chenh_lech, 
            sum(phi_kham) AS phi_kham, 
            sum(phi_giuong) AS phi_giuong, 
            sum(xn_hoa_sinh) AS xn_hoa_sinh, 
            sum(xn_vi_sinh) AS xn_vi_sinh, 
            sum(xn_mien_dich) AS xn_mien_dich, 
            sum(xn_gpb) AS xn_gpb, 
            sum(xn_khac) AS xn_khac, 
            sum(x_quang) AS x_quang, 
            sum(cty) AS cty, 
            sum(mri) AS mri, 
            sum(noi_soi) AS noi_soi, 
            sum(noi_soi_tmh) AS noi_soi_tmh, 
            sum(noi_soi_tieuhoa) AS noi_soi_tieuhoa, 
            sum(noi_soi_hohap) AS noi_soi_hohap, 
            sum(noi_soi_tucung) AS noi_soi_tucung, 
            sum(sa_2d) AS sa_2d, 
            sum(sa_4d) AS sa_4d, 
            sum(sa_tim) AS sa_tim, 
            sum(dien_tim) AS dien_tim, 
            sum(dien_nao) AS dien_nao,     
            sum(phau_thuat) AS phau_thuat, 
            sum(thu_thuat) AS thu_thuat, 
            sum(thuoc_vattu) AS thuoc_vattu, 
            sum(tong_chi_phi-phi_kham-phi_giuong-xn_hoa_sinh-xn_vi_sinh-xn_mien_dich-xn_gpb-xn_khac-x_quang-cty-mri- 
                                            noi_soi-noi_soi_tmh-noi_soi_tieuhoa-noi_soi_hohap-noi_soi_tucung-sa_2d-sa_4d-sa_tim-dien_tim- 
                                            dien_nao-phau_thuat-thu_thuat-thuoc_vattu) AS chi_phi_khac      
        FROM ( 
            SELECT  
                    CASE WHEN e.hfe_deptid = 'KB' THEN CAST(he_roomid AS TEXT) ELSE e.hfe_deptid END AS ma_khoa, 
                    CASE WHEN e.hfe_deptid = 'KB' THEN (SELECT hrl_name FROM hms_roomlist WHERE hrl_id = he_roomid AND hrl_deptid = 'KB')  
                                    ELSE (SELECT sd_name FROM sys_dept WHERE sd_id = e.hfe_deptid) END AS ten_khoa, 
                            e.hfe_cost AS tong_chi_phi, 
                            e.hfe_inspaid AS tong_bao_hiem, 
                            e.hfe_discount AS bao_hiem_tra,                 
                            CASE WHEN e.hfe_diffcost > 0 THEN e.hfe_diffcost  
                            WHEN e.hfe_inspaid <= 0 AND e.hfe_discount <=0  
                            THEN e.hfe_patdebt + e.hfe_patpaid ELSE 0 END AS chenh_lech, 
                            CASE 
                                                            WHEN hfe_group='D0000' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phi_kham, 
                            CASE 
                                                            WHEN e.hfe_type = 'B' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phi_giuong, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B1100','B1200','B1300','B1700','B1600') 
                                                            AND hfe_itemid <> 'B1900452' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_hoa_sinh, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B14','B15') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_vi_sinh, 
                            CASE 
                                                            WHEN hfe_itemid = 'B1900452' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_mien_dich, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B1F','B1E') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_gpb, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B1900') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_khac, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B21','B26','B27') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS x_quang, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B22') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS cty, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B23') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS mri, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_tmh, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_tieuhoa, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_hohap,				 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_tucung, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B24') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS sa_2d, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B25') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS sa_4d, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B28') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS sa_tim, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 2) IN ('B4') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phau_thuat, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 2) IN ('B5') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS thu_thuat, 
                            CASE WHEN hfe_group LIKE 'A%' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS thuoc_vattu, 
                            CASE 
                                                            WHEN hfe_group='F0000' AND hfe_itemid NOT IN ( 
                                                            'F0000010','F0000011','F0000012','F0000013','F0000014','F0000015','F0000021', 
                                                            'F0000022','F0000023','F0000024','F0000025','F0000026') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phi_khac, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B3300') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS dien_tim, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B3400') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS dien_nao  
            FROM hms_fee_invoice i 
            LEFT JOIN hms_fee e ON (e.hfe_docno = i.hfe_docno AND e.hfe_invoiceno = i.hfe_invoiceno AND e.hfe_category <> 'Y') 
            LEFT JOIN hms_fee_list on (hfl_feeid= e.hfe_itemid) 
            LEFT JOIN hms_exam ON (he_docno = e.hfe_docno and he_roomid=hfe_roomid) 
            WHERE i.hfe_status='P' 	 
            AND hfe_category = 'N'  
            AND i.hfe_date BETWEEN $1::timestamp AND $2::timestamp 
        ) AS tbl 
        GROUP BY ma_khoa, ten_khoa 
        HAVING SUM(tong_chi_phi)>0 
        ORDER BY ma_khoa DESC              
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn báo cáo tổng hợp chi phí theo khoa phòng:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn báo cáo tổng hợp chi phí theo khoa phòng' });
    }
});

app.get('/api/sumbaocaothcpkhoaphong', async (req, res) => {
    const { startDate, endDate } = req.query;

    // Kiểm tra tham số đầu vào
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Thiếu tham số startDate hoặc endDate' });
    }

    const query = `
        SELECT
            sum(tong_chi_phi) AS tong_chi_phi, 
            sum(bao_hiem_tra) AS bao_hiem_tra, 
            sum(tong_bao_hiem-bao_hiem_tra) AS dich_vu_tra, 
            sum(chenh_lech) AS chenh_lech, 
            sum(phi_kham) AS phi_kham, 
            sum(phi_giuong) AS phi_giuong, 
            sum(xn_hoa_sinh) AS xn_hoa_sinh, 
            sum(xn_vi_sinh) AS xn_vi_sinh, 
            sum(xn_mien_dich) AS xn_mien_dich, 
            sum(xn_gpb) AS xn_gpb, 
            sum(xn_khac) AS xn_khac, 
            sum(x_quang) AS x_quang, 
            sum(cty) AS cty, 
            sum(mri) AS mri, 
            sum(noi_soi) AS noi_soi, 
            sum(noi_soi_tmh) AS noi_soi_tmh, 
            sum(noi_soi_tieuhoa) AS noi_soi_tieuhoa, 
            sum(noi_soi_hohap) AS noi_soi_hohap, 
            sum(noi_soi_tucung) AS noi_soi_tucung, 
            sum(sa_2d) AS sa_2d, 
            sum(sa_4d) AS sa_4d, 
            sum(sa_tim) AS sa_tim, 
            sum(dien_tim) AS dien_tim, 
            sum(dien_nao) AS dien_nao,     
            sum(phau_thuat) AS phau_thuat, 
            sum(thu_thuat) AS thu_thuat, 
            sum(thuoc_vattu) AS thuoc_vattu, 
            sum(tong_chi_phi-phi_kham-phi_giuong-xn_hoa_sinh-xn_vi_sinh-xn_mien_dich-xn_gpb-xn_khac-x_quang-cty-mri- 
                                            noi_soi-noi_soi_tmh-noi_soi_tieuhoa-noi_soi_hohap-noi_soi_tucung-sa_2d-sa_4d-sa_tim-dien_tim- 
                                            dien_nao-phau_thuat-thu_thuat-thuoc_vattu) AS chi_phi_khac      
        FROM ( 
            SELECT  
                    CASE WHEN e.hfe_deptid = 'KB' THEN CAST(he_roomid AS TEXT) ELSE e.hfe_deptid END AS ma_khoa, 
                    CASE WHEN e.hfe_deptid = 'KB' THEN (SELECT hrl_name FROM hms_roomlist WHERE hrl_id = he_roomid AND hrl_deptid = 'KB')  
                                    ELSE (SELECT sd_name FROM sys_dept WHERE sd_id = e.hfe_deptid) END AS ten_khoa, 
                            e.hfe_cost AS tong_chi_phi, 
                            e.hfe_inspaid AS tong_bao_hiem, 
                            e.hfe_discount AS bao_hiem_tra,                 
                            CASE WHEN e.hfe_diffcost > 0 THEN e.hfe_diffcost  
                            WHEN e.hfe_inspaid <= 0 AND e.hfe_discount <=0  
                            THEN e.hfe_patdebt + e.hfe_patpaid ELSE 0 END AS chenh_lech, 
                            CASE 
                                                            WHEN hfe_group='D0000' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phi_kham, 
                            CASE 
                                                            WHEN e.hfe_type = 'B' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phi_giuong, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B1100','B1200','B1300','B1700','B1600') 
                                                            AND hfe_itemid <> 'B1900452' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_hoa_sinh, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B14','B15') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_vi_sinh, 
                            CASE 
                                                            WHEN hfe_itemid = 'B1900452' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_mien_dich, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B1F','B1E') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_gpb, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B1900') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS xn_khac, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B21','B26','B27') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS x_quang, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B22') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS cty, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B23') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS mri, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu NOT IN ('1', '2', '3', '4') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '1' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_tmh, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '2' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_tieuhoa, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '3' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_hohap,				 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B31') AND hfl_phanloai_dichvu = '4' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS noi_soi_tucung, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B24') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS sa_2d, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B25') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS sa_4d, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 3) IN ('B28') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS sa_tim, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 2) IN ('B4') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phau_thuat, 
                            CASE 
                                                            WHEN substr(hfe_group, 1, 2) IN ('B5') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS thu_thuat, 
                            CASE WHEN hfe_group LIKE 'A%' THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS thuoc_vattu, 
                            CASE 
                                                            WHEN hfe_group='F0000' AND hfe_itemid NOT IN ( 
                                                            'F0000010','F0000011','F0000012','F0000013','F0000014','F0000015','F0000021', 
                                                            'F0000022','F0000023','F0000024','F0000025','F0000026') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS phi_khac, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B3300') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS dien_tim, 
                            CASE 
                                                            WHEN SUBSTR(hfe_group, 1, 5) IN('B3400') THEN e.hfe_cost 
                                                            ELSE 0 
                                                            END AS dien_nao  
            FROM hms_fee_invoice i 
            LEFT JOIN hms_fee e ON (e.hfe_docno = i.hfe_docno AND e.hfe_invoiceno = i.hfe_invoiceno AND e.hfe_category <> 'Y') 
            LEFT JOIN hms_fee_list on (hfl_feeid= e.hfe_itemid) 
            LEFT JOIN hms_exam ON (he_docno = e.hfe_docno and he_roomid=hfe_roomid) 
            WHERE i.hfe_status='P' 	 
            AND hfe_category = 'N'  
            AND i.hfe_date BETWEEN $1::timestamp AND $2::timestamp 
        ) AS tbl 
        HAVING SUM(tong_chi_phi)>0     
    `;

    try {
        const result = await pool.query(query, [startDate, endDate]);
        if (result.rows && result.rows.length > 0) {
            res.json(result.rows[0]); // Return the first row directly as JSON
        } else {
            res.json({}); // Return empty object if no data
        }
    } catch (error) {
        console.error('Lỗi khi truy vấn Sum báo cáo tổng hợp chi phí theo khoa phòng:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn Sum báo cáo tổng hợp chi phí theo khoa phòng' });
    }
});

// Báo cáo tính công suất sử dụng giường
app.get('/dm-baocaocongsuatgiuong', (req, res) => {
    /* Lấy mặc định ngày hiện tại
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaopttt', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy trước một ngày mặc định ngày hiện tại */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaocongsuatgiuong', {
        startDateCongSuatGiuong: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateCongSuatGiuong: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

// Báo cáo tính công suất sử dụng giường
app.get('/dm-baocaocongsuatgiuong', (req, res) => {
    /* Lấy mặc định ngày hiện tại
    const today = new Date();
    const formattedDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaopttt', {
        defaultDate: formattedDate, // Truyền ngày hiện tại vào template
    });
    */

    /* Lấy trước một ngày mặc định ngày hiện tại */
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1); // Giảm ngày đi 1

    // Định dạng ngày theo định dạng 'dd/MM/yyyy' của Việt Nam
    const formattedToday = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const formattedYesterday = yesterday.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    res.render('dm-baocaocongsuatgiuong', {
        startDateCongSuatGiuong: formattedYesterday, // Ngày trước (dd/MM/yyyy)
        endDateCongSuatGiuong: formattedToday,      // Ngày hiện tại (dd/MM/yyyy)
    });
});

app.get('/api/baocaocongsuatgiuong', async (req, res) => {

    const { startDate, endDate } = req.query;
    const query = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY du_lieu_goc.cong_suat_su_dung_giuong DESC) AS stt,
            du_lieu_goc.ma_khoa,
            du_lieu_goc.ten_khoa,
            du_lieu_goc.phong_thuong,
            du_lieu_goc.phong_tyc,
            du_lieu_goc.tong_giuong,
            du_lieu_goc.so_luong_dang_nam,
            du_lieu_goc.so_luong_dang_dieu_tri,
            du_lieu_goc.cong_suat_su_dung_giuong
        FROM (
            SELECT 
                COALESCE(d.sd_id, p.ma_khoa, g.ma_khoa, b1.ma_khoa, b2.ma_khoa) AS ma_khoa,
                d.sd_name AS ten_khoa,
                COALESCE(p.phong_thuong, 0) AS phong_thuong,
                COALESCE(p.phong_tyc, 0) AS phong_tyc,
                COALESCE(g.tong_giuong, 0) AS tong_giuong,
                COALESCE(b1.so_luong_dang_nam, 0) AS so_luong_dang_nam,
                COALESCE(b2.so_luong_dang_dieu_tri, 0) AS so_luong_dang_dieu_tri,
                CASE 
                    WHEN COALESCE(g.tong_giuong, 0) = 0 THEN 0
                    ELSE ROUND((COALESCE(b2.so_luong_dang_dieu_tri, 0) * 100.0) / COALESCE(g.tong_giuong, 1), 2)
                END AS cong_suat_su_dung_giuong
            FROM sys_dept d

            -- phong_tonghop
            LEFT JOIN (
                SELECT 
                    p.ma_khoa,
                    SUM(p.phong_thuong) AS phong_thuong,
                    SUM(p.phong_tyc) AS phong_tyc
                FROM (
                    SELECT 
                        hrl_deptid AS ma_khoa,
                        CASE WHEN hrl_isreq = 'N' THEN 1 ELSE 0 END AS phong_thuong,
                        CASE WHEN hrl_isreq = 'Y' THEN 1 ELSE 0 END AS phong_tyc
                    FROM hms_roomlist  
                    WHERE hrl_active = 'Y'
                ) p
                GROUP BY p.ma_khoa
            ) p ON d.sd_id = p.ma_khoa

            -- giuong_tong
            LEFT JOIN (
                SELECT 
                    hbl_deptid AS ma_khoa,
                    COUNT(*) AS tong_giuong
                FROM hms_bedlist
                WHERE hbl_active = 'Y'
                GROUP BY hbl_deptid
            ) g ON d.sd_id = g.ma_khoa

            -- benh_nhan_giuong
            LEFT JOIN (
                SELECT 
                    hb_deptid AS ma_khoa,
                    COUNT(*) AS so_luong_dang_nam
                FROM hms_bed 
                WHERE hb_status = 'O'
                AND hb_admitdate BETWEEN $1::timestamp AND $2::timestamp 
                GROUP BY hb_deptid
            ) b1 ON d.sd_id = b1.ma_khoa

            -- benh_nhan_dieu_tri
            LEFT JOIN (
                SELECT 
                    htr_deptid AS ma_khoa,   
                    COUNT(*) AS so_luong_dang_dieu_tri
                FROM hms_patient 
                LEFT JOIN hms_doc ON hd_patientno = hp_patientno
                LEFT JOIN hms_treatment_record ON hd_docno = htr_docno
                WHERE 
                    htr_admitdate <= $3::timestamp
                    AND (htr_status = 'I' OR (htr_status = 'T' AND htr_dischargedate > $4::timestamp))
                GROUP BY htr_deptid
            ) b2 ON d.sd_id = b2.ma_khoa 

            WHERE d.sd_isactive = 'Y' 
            AND d.sd_type = 'DT'
        ) du_lieu_goc
        ORDER BY du_lieu_goc.cong_suat_su_dung_giuong DESC;       
    `;

    try {
        const result = await pool.query(query, [startDate, endDate, endDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi khi truy vấn tính công suất giường:', error);
        res.status(500).json({ error: 'Lỗi server khi truy vấn tính công suất giường' });
    }
});

// Thêm các route cho từng trang
app.get('/hoatdongbenhvien', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }

    // Lấy ngày hiện tại theo định dạng dd/MM/yyyy
    const today = new Date();
    const defaultDate = today.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, '/');

    res.render('dm-hoatdongbenhvien', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin,
        defaultDate: defaultDate
    });
});

app.get('/nguoisudung', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-nguoisudung', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/nguoisudung-pq', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-nguoisudung-pq', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaophongkham', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaophongkham', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaodieutrinoitru', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaodieutrinoitru', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaocls', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaocls', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaopttt', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaopttt', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaothcpkhoaphong', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaothcpkhoaphong', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaocongsuatgiuong', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaocongsuatgiuong', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaongay', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaongay', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/baocaotuan', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-baocaotuan', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/dashboard-bskham', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-dashboard-bskham', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/lienhe', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-lienhe', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.get('/pdftoword', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.render('dm-pdftoword', {
        fullname: req.session.fullname,
        ip: req.ip || req.connection.remoteAddress,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

// ========== TRANSLATION ROUTES ==========

// Trang dịch thuật
app.get('/translate', async (req, res) => {
    // Kiểm tra đăng nhập
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    
    try {
        res.render('translate', {
            fullname: req.session.fullname || 'Người dùng',
            userid: req.session.userid
        });
    } catch (err) {
        console.error('Lỗi render translate:', err);
        res.status(500).send('Lỗi server');
    }
});

// API upload và extract text từ PDF
app.post('/api/translate/upload', upload.single('pdfFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn file PDF' });
    }
    
    try {
        const filePath = req.file.path;
        const dataBuffer = fs.readFileSync(filePath);
        
        // pdf-parse version 2.x: sử dụng PDFParse class
        const { PDFParse } = pdfParseModule;
        if (!PDFParse || typeof PDFParse !== 'function') {
            throw new Error('PDFParse class không tìm thấy trong pdf-parse module');
        }
        
        // Tạo instance với data buffer (theo README: { data: buffer })
        const parser = new PDFParse({ data: dataBuffer });
        
        // Lấy text - getText() trả về object có property text
        const textResult = await parser.getText();
        const text = textResult?.text || '';
        
        // Lấy info để có số trang
        const infoResult = await parser.getInfo({ parsePageInfo: true });
        const numPages = infoResult?.total || 0;
        const info = infoResult?.info || {};
        
        // Cleanup
        await parser.destroy();
        
        // Xóa file tạm sau khi đọc
        fs.unlinkSync(filePath);
        
        res.json({
            success: true,
            text: text || '',
            numPages: numPages,
            info: info || {}
        });
    } catch (err) {
        console.error('Lỗi đọc PDF:', err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Không thể đọc file PDF. Vui lòng kiểm tra file và thử lại.' });
    }
});

// API dịch text (sử dụng Google Translate API hoặc dịch thủ công)
app.post('/api/translate/text', async (req, res) => {
    const { sourceText, sourceLang = 'zh', targetLang = 'vi' } = req.body;
    
    if (!sourceText || sourceText.trim() === '') {
        return res.status(400).json({ error: 'Vui lòng nhập text cần dịch' });
    }
    
    try {
        // Tạm thời sử dụng dịch thủ công (có thể tích hợp Google Translate API sau)
        const translatedText = await translateText(sourceText, sourceLang, targetLang);
        
        res.json({
            success: true,
            originalText: sourceText,
            translatedText: translatedText,
            sourceLang: sourceLang,
            targetLang: targetLang
        });
    } catch (err) {
        console.error('Lỗi dịch text:', err);
        res.status(500).json({ error: 'Có lỗi xảy ra khi dịch. Vui lòng thử lại.' });
    }
});

// Hàm dịch text sử dụng Google Translate API (miễn phí, không cần API key)
async function translateText(text, sourceLang, targetLang) {
    try {
        // Chia text thành các đoạn nhỏ để tránh giới hạn độ dài
        const maxLength = 5000; // Giới hạn mỗi lần dịch
        const chunks = [];
        
        // Chia text thành các đoạn
        for (let i = 0; i < text.length; i += maxLength) {
            chunks.push(text.substring(i, i + maxLength));
        }
        
        // Dịch từng đoạn
        const translatedChunks = [];
        for (const chunk of chunks) {
            if (chunk.trim()) {
                const result = await translate(chunk, {
                    from: sourceLang,
                    to: targetLang
                });
                translatedChunks.push(result.text);
            }
        }
        
        // Ghép các đoạn đã dịch lại
        return translatedChunks.join('\n');
    } catch (err) {
        console.error('Lỗi dịch text:', err);
        // Nếu có lỗi, trả về text gốc và thông báo
        throw new Error('Không thể dịch tự động. Vui lòng nhập bản dịch thủ công hoặc thử lại sau.');
    }
}

// API lưu file đã dịch
app.post('/api/translate/save', async (req, res) => {
    const { originalText, translatedText, fileName } = req.body;
    
    if (!translatedText || translatedText.trim() === '') {
        return res.status(400).json({ error: 'Không có nội dung để lưu' });
    }
    
    try {
        const outputDir = path.join(__dirname, 'public', 'translations');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeFileName = (fileName || 'translated') + '_' + timestamp;
        
        // Lưu dưới dạng PDF
        const pdfPath = path.join(outputDir, safeFileName + '.pdf');
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);
        
        // Thêm nội dung
        doc.fontSize(12);
        doc.text('BẢN DỊCH TIẾNG VIỆT', { align: 'center' });
        doc.moveDown();
        doc.text('Nội dung gốc (Trung-Anh):', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(originalText || 'N/A', { align: 'left' });
        doc.moveDown();
        doc.fontSize(12);
        doc.text('Nội dung đã dịch (Tiếng Việt):', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(translatedText, { align: 'left' });
        
        doc.end();
        
        await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
        
        // Lưu dưới dạng text
        const txtPath = path.join(outputDir, safeFileName + '.txt');
        fs.writeFileSync(txtPath, `BẢN DỊCH TIẾNG VIỆT\n\nNội dung gốc (Trung-Anh):\n${originalText || 'N/A'}\n\nNội dung đã dịch (Tiếng Việt):\n${translatedText}`, 'utf8');
        
        res.json({
            success: true,
            message: 'Đã lưu file thành công',
            pdfUrl: '/translations/' + safeFileName + '.pdf',
            txtUrl: '/translations/' + safeFileName + '.txt',
            fileName: safeFileName
        });
    } catch (err) {
        console.error('Lỗi lưu file:', err);
        res.status(500).json({ error: 'Có lỗi xảy ra khi lưu file' });
    }
});

// API chuyển đổi PDF/Ảnh sang Word (DOCX)
// LƯU Ý: Cần cài đặt thư viện 'docx' để tạo file DOCX
// Chạy lệnh: npm install docx
app.post('/api/convert-pdf-to-word', uploadPdfImage.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn file PDF hoặc ảnh' });
    }

    try {
        const filePath = req.file.path;
        const fileMime = req.file.mimetype;
        let textContent = '';

        // Xử lý file PDF
        if (fileMime === 'application/pdf') {
            try {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                textContent = pdfData.text || 'Không thể đọc nội dung từ PDF.';
            } catch (pdfError) {
                console.error('Lỗi đọc PDF:', pdfError);
                // Xóa file tạm
                fs.unlinkSync(filePath);
                return res.status(400).json({ error: 'Không thể đọc file PDF. Vui lòng kiểm tra file có bị lỗi không.' });
            }
        } 
        // Xử lý file ảnh (cần OCR - sẽ thêm sau nếu cần)
        else if (fileMime.startsWith('image/')) {
            // TODO: Thêm OCR để đọc text từ ảnh
            // Có thể sử dụng thư viện như: tesseract.js, ocr-space-api, etc.
            textContent = '[Ảnh đã được tải lên. Chức năng OCR đang được phát triển. Vui lòng sử dụng file PDF để chuyển đổi text.]';
        }

        // Tạo file DOCX
        // LƯU Ý: Cần cài đặt thư viện 'docx' trước khi sử dụng
        // npm install docx
        try {
            // Kiểm tra xem thư viện docx đã được cài đặt chưa
            let Docx;
            try {
                Docx = require('docx');
            } catch (docxError) {
                // Nếu chưa cài docx, tạo file DOCX đơn giản bằng cách khác
                // Hoặc trả về lỗi yêu cầu cài đặt
                fs.unlinkSync(filePath);
                return res.status(500).json({ 
                    error: 'Thư viện docx chưa được cài đặt. Vui lòng chạy lệnh: npm install docx' 
                });
            }

            // Tạo document DOCX
            const { Document, Packer, Paragraph, TextRun, HeadingLevel } = Docx;

            // Chia text thành các đoạn
            const paragraphs = textContent.split('\n').filter(line => line.trim().length > 0);
            const docParagraphs = paragraphs.map(text => 
                new Paragraph({
                    children: [new TextRun(text.trim())],
                    spacing: { after: 200 }
                })
            );

            // Nếu không có nội dung, thêm một đoạn mặc định
            if (docParagraphs.length === 0) {
                docParagraphs.push(new Paragraph({
                    children: [new TextRun('Không có nội dung để chuyển đổi.')]
                }));
            }

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: docParagraphs
                }]
            });

            // Tạo buffer từ document
            const buffer = await Packer.toBuffer(doc);

            // Xóa file tạm
            fs.unlinkSync(filePath);

            // Gửi file DOCX về client
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace(/\.[^/.]+$/, '')}.docx"`);
            res.send(buffer);

        } catch (docxError) {
            console.error('Lỗi tạo file DOCX:', docxError);
            // Xóa file tạm
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(500).json({ 
                error: 'Có lỗi xảy ra khi tạo file DOCX. Vui lòng thử lại sau.' 
            });
        }

    } catch (error) {
        console.error('Lỗi chuyển đổi file:', error);
        // Xóa file tạm nếu có
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ 
            error: 'Có lỗi xảy ra khi xử lý file. Vui lòng thử lại sau.' 
        });
    }
});

/** Tách nhiều câu lệnh SQL theo ; (bỏ qua chuỗi trong dấu nháy đơn) */
function splitSqlStatements(sql) {
    const parts = [];
    let current = '';
    let inSingle = false;
    for (let i = 0; i < sql.length; i++) {
        const c = sql[i];
        if (c === "'" && !inSingle) {
            inSingle = true;
            current += c;
        } else if (c === "'" && inSingle) {
            if (sql[i + 1] === "'") {
                current += "''";
                i++;
            } else {
                inSingle = false;
                current += c;
            }
        } else if (c === ';' && !inSingle) {
            const trimmed = current.trim();
            if (trimmed) parts.push(trimmed);
            current = '';
        } else {
            current += c;
        }
    }
    const last = current.trim();
    if (last) parts.push(last);
    return parts;
}

function serializeSqlCell(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    if (Buffer.isBuffer(val)) return '\\x' + val.toString('hex');
    return val;
}

function serializeSqlRows(rows) {
    return rows.map((row) => {
        const o = {};
        for (const [k, v] of Object.entries(row)) {
            o[k] = serializeSqlCell(v);
        }
        return o;
    });
}

function sqlResultMessage(r) {
    const cmd = (r.command || '').toUpperCase();
    if (cmd === 'SELECT' || cmd === 'WITH' || cmd === 'SHOW' || cmd === 'EXPLAIN') {
        const n = r.rowCount != null ? r.rowCount : 0;
        return '(' + n + ' row' + (n === 1 ? '' : 's') + ')';
    }
    if (r.rowCount != null && ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'COPY'].includes(cmd)) {
        return r.command + ' ' + r.rowCount;
    }
    return r.command || 'OK';
}

app.get('/sql-console', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    if (!req.session.isAdmin) {
        return res.status(403).send('Chỉ tài khoản quản trị (su_setup_qt = 01) mới được dùng SQL Console.');
    }
    res.render('sql-console', {
        fullname: req.session.fullname,
        companyName: companyName,
        logoImageBV: logoImageBV,
        isAdmin: req.session.isAdmin
    });
});

app.post('/api/sql-exec', async (req, res) => {
    if (!req.session.loggedin || !req.session.isAdmin) {
        return res.status(403).json({ error: 'Không có quyền thực thi SQL.' });
    }
    const sql = (req.body && req.body.sql) ? String(req.body.sql) : '';
    if (!sql.trim()) {
        return res.status(400).json({ error: 'Câu lệnh SQL trống.' });
    }
    const statements = splitSqlStatements(sql);
    if (statements.length > 100) {
        return res.status(400).json({ error: 'Tối đa 100 câu lệnh mỗi lần gửi.' });
    }
    const results = [];
    let client;
    try {
        client = await pool.connect();
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            const r = await client.query(stmt);
            const fields = (r.fields || []).map((f) => f.name);
            const sqlSnippet = stmt.length > 500 ? stmt.slice(0, 500) + '...' : stmt;
            results.push({
                index: i + 1,
                sql: sqlSnippet,
                command: r.command,
                message: sqlResultMessage(r),
                fields,
                rows: serializeSqlRows(r.rows || [])
            });
        }
        res.json({ ok: true, results });
    } catch (err) {
        res.status(400).json({
            ok: false,
            error: err.message,
            detail: err.detail,
            hint: err.hint,
            position: err.position,
            results
        });
    } finally {
        if (client) client.release();
    }
});

// Thêm route để xử lý tất cả các request không khớp với route nào
app.get('*', (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }
    res.redirect('/');
});

app.listen(PORT, host, () => {
    console.log(`App is running at http://${host}:${PORT}`);
});