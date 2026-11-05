// ======= Các hàm tiện ích dùng chung =======
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value) || parseFloat(value) === 0) return '';
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function isAllZeroOrEmpty(obj, keys) {
    return keys.every(key => !obj[key] || parseFloat(obj[key]) === 0);
}

// ======= Các hàm thao tác DOM đã kiểm tra tồn tại =======
document.addEventListener('DOMContentLoaded', function () {
    // Toggle main
    const toggleButton = document.getElementById('toggle-main-btn');
    if (toggleButton) {
        toggleButton.addEventListener('click', function () {
            const mainElement = document.querySelector('.main');
            if (mainElement) {
                mainElement.classList.toggle('shrink');
                const icon = toggleButton.querySelector('i');
                if (icon) {
                    if (mainElement.classList.contains('shrink')) {
                        icon.classList.remove('fa-expand');
                        icon.classList.add('fa-compress');
                    } else {
                        icon.classList.remove('fa-compress');
                        icon.classList.add('fa-expand');
                    }
                }
            }
        });
    }
});

// Sắp xếp tiêu đề cột
function sortTable(columnIndex) {
    const table = document.getElementById("table-body");
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tr"));
    let ascending = true;
    if (table.getAttribute("data-sort-column") == columnIndex) {
        ascending = table.getAttribute("data-sort-order") === "asc" ? false : true;
    }
    rows.sort((a, b) => {
        const cellA = a.querySelectorAll("td")[columnIndex]?.innerText || '';
        const cellB = b.querySelectorAll("td")[columnIndex]?.innerText || '';
        const valA = isNaN(cellA) ? cellA : parseFloat(cellA);
        const valB = isNaN(cellB) ? cellB : parseFloat(cellB);
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
    table.innerHTML = "";
    rows.forEach(row => table.appendChild(row));
    table.setAttribute("data-sort-column", columnIndex);
    table.setAttribute("data-sort-order", ascending ? "asc" : "desc");
}

// Hàm Ẩn Các Giá Trị = 0
function AnGiaTriKhongTable(data, tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.forEach(row => {
        const tableRow = document.createElement('tr');
        Object.keys(row).forEach(key => {
            const cell = document.createElement('td');
            cell.textContent = row[key] === 0 ? '' : row[key];
            tableRow.appendChild(cell);
        });
        tableBody.appendChild(tableRow);
    });
}

// Các hàm load dữ liệu: luôn kiểm tra DOM trước khi thao tác
function loadKhoa() {
    fetch('/dm-khoa')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('zMaKhoa');
            if (!select) return;
            select.innerHTML = '';
            if (data.length === 0) return;
            data.forEach(khoa => {
                const option = document.createElement('option');
                option.value = khoa.ma_khoa.trim();
                option.text = `${khoa.ma_khoa} - ${khoa.ten_khoa}`;
                select.appendChild(option);
            });
        });
}

function timKiemNguoiSuDung(event) {
    if (event.key === 'Enter') {
        const input = document.getElementById('tim-kiem-nsd');
        if (!input) return;
        const query = input.value.trim();
        if (query) {
            fetch(`/dm-nguoisudung/tim-kiem-nsd?name=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(data => capNhatTimKiemNSD(data));
        } else {
            fetch('/dm-nguoisudung')
                .then(response => response.text())
                .then(data => {
                    const area = document.getElementById('content-area');
                    if (area) area.innerHTML = data;
                });
        }
    }
}

function capNhatTimKiemNSD(data) {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td style="width: 3%;">${row.ma_nsd || ''}</td>
        <td style="width: 45%;">${row.ho_ten || ''}</td>
        <td style="width: 12%;">${row.ma_khoa || ''}</td>
        <td style="width: 25%;">${row.chungchi_hanhnghe || ''}</td>
        <td style="width: 15%;">${row.sodt || ''}</td>
		<td class="hidden-col" style="width: 0%;">${row.mat_khau || ''}</td>
    `;
        tr.addEventListener('click', function () {
            loadUserInfo(row.ma_nsd, row.ho_ten, row.ma_khoa, row.chungchi_hanhnghe, row.sodt, row.mat_khau);
        });
        tbody.appendChild(tr);
        if (typeof zSuKienLoadTableTimKiem === 'function') zSuKienLoadTableTimKiem();
    });
}

function loadUserInfo(ma_nsd, ho_ten, ma_khoa, cchn, sodt, mat_khau) {
    const zMaNSD = document.getElementById('zMaNSD');
    const zTenNSD = document.getElementById('zTenNSD');
    const zMatKhau = document.getElementById('zMatKhau');
    const zCCHN = document.getElementById('zCCHN');
    const zSoDT = document.getElementById('zSoDT');
    const zMaKhoa = document.getElementById('zMaKhoa');
    const showThongBao = document.getElementById('showThongBao');
    if (zMaNSD) zMaNSD.value = ma_nsd;
    if (zTenNSD) zTenNSD.value = ho_ten;
    if (zMatKhau) zMatKhau.value = mat_khau;
    if (zCCHN) zCCHN.value = cchn;
    if (zSoDT) zSoDT.value = sodt;
    if (showThongBao) showThongBao.textContent = '';
    if (zMaKhoa) {
        fetch(`/get-dept-name/${ma_khoa}`)
            .then(response => response.json())
            .then(data => {
                zMaKhoa.value = data.deptName ? `${ma_khoa.trim()} - ${data.deptName}` : `${ma_khoa.trim()} - Không tìm thấy khoa`;
            })
            .catch(() => {
                zMaKhoa.value = `${ma_khoa.trim()} - Lỗi lấy tên khoa`;
            });
    }
}

// Sử dụng Ajax để tải danh sách Người sử dụng vào #content-area
function loadNguoiSuDung() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-nguoisudung', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            //console.log(xhr.responseText); // In phản hồi ra console
            document.getElementById('content-area').innerHTML = xhr.responseText;
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function loadLienHe() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-lienhe', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            //console.log(xhr.responseText); // In phản hồi ra console
            document.getElementById('content-area').innerHTML = xhr.responseText;
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

// Sử dụng Ajax để tải danh sách Người sử dụng phân quyền vào #content-area
function loadNguoiSuDung_pq() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-nguoisudung-pq', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            //console.log(xhr.responseText); // In phản hồi ra console
            document.getElementById('content-area').innerHTML = xhr.responseText;
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

// Sử dụng Ajax để tải hoạt động bệnh viện vào #content-area
// Hàm loadhoatdongbenhvien
function loadhoatdongbenhvien() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-hoatdongbenhvien', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;

            // Gọi hàm fetchHoatDongBenhVien sau khi thêm nội dung vào DOM
            const today = getDefaultDateTime(); // Gọi 1 lần duy nhất
            const startTime = "00:01";
            const endTime = "23:59";

            const startTimestamp = `${today} ${startTime}`;
            const endTimestamp = `${today} ${endTime}`;

            // Load all dashboard data
            fetchHoatDongBenhVien(startTimestamp, endTimestamp);
            fetchHoatDongBenhVienTheoNgay();
            fetchKPIDashboardData(startTimestamp, endTimestamp);
            fetchServiceChartData(startTimestamp, endTimestamp);
            fetchNoiTruTableData(startTimestamp, endTimestamp);
            fetchReceptionChartData();
            fetchRevenueChartData();
            fetchRevenueStructureData(startTimestamp, endTimestamp);

        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

// Định nghĩa hàm getDefaultDateTime trước khi sử dụng
function getDefaultDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fetchHoatDongBenhVien(startTimestamp, endTimestamp) {
    fetch(`/api/hoatdongbenhvien?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`)
        .then(response => response.json())
        .then(data => {
            console.log("API response data:", data); // Log toàn bộ dữ liệu nhận được từ API

            if (data && data.length > 0) {
                const row = data[0]; // vì query chỉ trả về 1 dòng tổng hợp
                
                // Update main KPI values
                const tongSoNguoiBenh = parseInt(row.tong_so_nguoi_benh) || 0;
                const tongSoLuotKham = parseInt(row.tong_so_luot_kham) || 0;
                const soLuongBaoHiem = parseInt(row.so_luong_bao_hiem) || 0;
                const soLuongNhapVien = parseInt(row.so_luong_nhap_vien) || 0;
                const soLuongChuyenVien = parseInt(row.so_luong_chuyen_vien) || 0;
                const soLuongDichVu = parseInt(row.so_luong_dich_vu) || 0;
                
                // Calculate BHYT and Dịch Vụ breakdowns
                const tongSoNguoiBenhBHYT = soLuongBaoHiem; // Assuming BHYT patients
                const tongSoNguoiBenhDV = tongSoNguoiBenh - tongSoNguoiBenhBHYT;
                
                const tongSoLuotKhamBHYT = soLuongBaoHiem; // Assuming BHYT consultations
                const tongSoLuotKhamDV = tongSoLuotKham - tongSoLuotKhamBHYT;
                
                const soLuongBaoHiemBHYT = soLuongBaoHiem;
                const soLuongBaoHiemDV = 0; // Health insurance is always BHYT
                
                const soLuongNhapVienBHYT = Math.floor(soLuongNhapVien * 0.8); // Estimate
                const soLuongNhapVienDV = soLuongNhapVien - soLuongNhapVienBHYT;
                
                const soLuongChuyenVienBHYT = soLuongChuyenVien; // Usually all BHYT
                const soLuongChuyenVienDV = 0;
                
                const soLuongDichVuBHYT = 0; // Services are usually non-BHYT
                const soLuongDichVuDV = soLuongDichVu;
                
                // Update main values
                updateElement("tong_so_nguoi_benh", tongSoNguoiBenh);
                updateElement("tong_so_luot_kham", tongSoLuotKham);
                updateElement("so_luong_bao_hiem", soLuongBaoHiem);
                updateElement("so_luong_nhap_vien", soLuongNhapVien);
                updateElement("so_luong_chuyen_vien", soLuongChuyenVien);
                updateElement("so_luong_dich_vu", soLuongDichVu);
                
                // Update breakdowns
                updateElement("tong_so_nguoi_benh_bhyt", tongSoNguoiBenhBHYT);
                updateElement("tong_so_nguoi_benh_dv", tongSoNguoiBenhDV >= 0 ? tongSoNguoiBenhDV : 0);
                
                updateElement("tong_so_luot_kham_bhyt", tongSoLuotKhamBHYT);
                updateElement("tong_so_luot_kham_dv", tongSoLuotKhamDV >= 0 ? tongSoLuotKhamDV : 0);
                
                updateElement("so_luong_bao_hiem_bhyt", soLuongBaoHiemBHYT);
                updateElement("so_luong_bao_hiem_dv", soLuongBaoHiemDV);
                
                updateElement("so_luong_nhap_vien_bhyt", soLuongNhapVienBHYT);
                updateElement("so_luong_nhap_vien_dv", soLuongNhapVienDV >= 0 ? soLuongNhapVienDV : 0);
                
                updateElement("so_luong_chuyen_vien_bhyt", soLuongChuyenVienBHYT);
                updateElement("so_luong_chuyen_vien_dv", soLuongChuyenVienDV);
                
                updateElement("so_luong_dich_vu_bhyt", soLuongDichVuBHYT);
                updateElement("so_luong_dich_vu_dv", soLuongDichVuDV);
                
            } else {
                console.warn("API returned no data");
                // Clear all elements
                const elements = [
                    "tong_so_nguoi_benh", "tong_so_luot_kham", "so_luong_bao_hiem",
                    "so_luong_nhap_vien", "so_luong_chuyen_vien", "so_luong_dich_vu",
                    "tong_so_nguoi_benh_bhyt", "tong_so_nguoi_benh_dv",
                    "tong_so_luot_kham_bhyt", "tong_so_luot_kham_dv",
                    "so_luong_bao_hiem_bhyt", "so_luong_bao_hiem_dv",
                    "so_luong_nhap_vien_bhyt", "so_luong_nhap_vien_dv",
                    "so_luong_chuyen_vien_bhyt", "so_luong_chuyen_vien_dv",
                    "so_luong_dich_vu_bhyt", "so_luong_dich_vu_dv"
                ];
                elements.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = "0";
                });
            }
        })
        .catch(error => {
            console.error("Lỗi khi lấy dữ liệu thống kê:", error);
            alert("Có lỗi xảy ra khi tải dữ liệu, vui lòng thử lại.");
        });
}

// Helper function to update element
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || 0;
}

async function fetchHoatDongBenhVienTheoNgay() {
    try {
        const response = await fetch(`/api/hoatdongbenhvientheongay`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-hoatdongbenhvien');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            // Kiểm tra nếu "ten_thu" là "Chủ Nhật", thêm lớp `row-sunday`
            if (row.ten_thu === 'Chủ Nhật') {
                tr.classList.add('row-sunday');
            }
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td>${row.ten_thu}</td>
                <td>${row.ngay}</td>
                <td class="currency">${formatCurrency(row.tong_so_nguoi_benh)}</td>
                <td class="currency">${formatCurrency(row.tong_so_luot_kham)}</td>
                <td class="currency">${formatCurrency(row.so_luong_nhap_vien)}</td>
                <td class="currency">${formatCurrency(row.so_luong_chuyen_vien)}</td>
                <td class="currency">${formatCurrency(row.so_luong_bao_hiem)}</td>
                <td class="currency">${formatCurrency(row.so_luong_dich_vu)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API doanh thu noi tru:", error);
    }

    try {
        const response = await fetch(`/api/sumhoatdongbenhvientheongay`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-hoatdongbenhvien');
        if (tbody) {
            tbody.innerHTML = `
            <td colspan="3">Tổng cộng</td>
            <td class="currency">${formatCurrency(data.tong_so_nguoi_benh)}</td>
            <td class="currency">${formatCurrency(data.tong_so_luot_kham)}</td>
            <td class="currency">${formatCurrency(data.so_luong_nhap_vien)}</td>
            <td class="currency">${formatCurrency(data.so_luong_chuyen_vien)}</td>
            <td class="currency">${formatCurrency(data.so_luong_bao_hiem)}</td>
            <td class="currency">${formatCurrency(data.so_luong_dich_vu)}</td>
        `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum pttt:", error);
    }
}

// Global chart variables
let serviceChart = null;
let receptionChart = null;
let revenueChart = null;
let revenueStructureChart = null;
let revenueBySubjectChart = null;

// Hàm load KPI Dashboard Data
async function fetchKPIDashboardData(startTimestamp, endTimestamp) {
    try {
        // Fetch main dashboard data
        const response = await fetch(`/api/hoatdongbenhvien?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            const row = data[0];
            
            // Update KPI cards - NGOẠI TRÚ (Lượt đăng ký)
            const tongLuotKham = parseInt(row.tong_so_luot_kham) || 0;
            const bhytLuotKham = parseInt(row.so_luong_bao_hiem) || 0;
            const khongBhytLuotKham = tongLuotKham - bhytLuotKham;
            
            document.getElementById("kpi-ngoai-tru-total").textContent = tongLuotKham;
            document.getElementById("kpi-ngoai-tru-bhyt").textContent = bhytLuotKham;
            document.getElementById("kpi-ngoai-tru-khong-bhyt").textContent = khongBhytLuotKham >= 0 ? khongBhytLuotKham : 0;
            
            // Update KPI cards - CHUYỂN VIỆN (Người)
            const tongChuyenVien = parseInt(row.so_luong_chuyen_vien) || 0;
            document.getElementById("kpi-chuyen-vien-total").textContent = tongChuyenVien;
            document.getElementById("kpi-chuyen-vien-bhyt").textContent = tongChuyenVien; // Assuming all are BHYT
            document.getElementById("kpi-chuyen-vien-khong-bhyt").textContent = "0";
            
            // Update KPI cards - NHẬP VIỆN (Người)
            const tongNhapVien = parseInt(row.so_luong_nhap_vien) || 0;
            document.getElementById("kpi-nhap-vien-total").textContent = tongNhapVien;
            // Assuming some logic for BHYT split - adjust based on actual data
            document.getElementById("kpi-nhap-vien-bhyt").textContent = Math.floor(tongNhapVien * 0.8);
            document.getElementById("kpi-nhap-vien-khong-bhyt").textContent = tongNhapVien - Math.floor(tongNhapVien * 0.8);
            
            // Update KPI cards - ĐANG ĐIỀU TRỊ (Người)
            const tongDangDieuTri = parseInt(row.tong_so_nguoi_benh) || 0;
            document.getElementById("kpi-dang-dieu-tri-total").textContent = tongDangDieuTri;
            document.getElementById("kpi-dang-dieu-tri-bhyt").textContent = Math.floor(tongDangDieuTri * 0.95);
            document.getElementById("kpi-dang-dieu-tri-khong-bhyt").textContent = tongDangDieuTri - Math.floor(tongDangDieuTri * 0.95);
            
            // Note: CẤP CỨU, PHẪU THUẬT, ĐƠN THUỐC need separate API calls
            // For now, set to 0 or fetch from appropriate endpoints
            document.getElementById("kpi-cap-cuu-total").textContent = "0";
            document.getElementById("kpi-cap-cuu-bhyt").textContent = "0";
            document.getElementById("kpi-cap-cuu-khong-bhyt").textContent = "0";
            
            document.getElementById("kpi-phau-thuat-total").textContent = "0";
            document.getElementById("kpi-phau-thuat-bhyt").textContent = "0";
            document.getElementById("kpi-phau-thuat-khong-bhyt").textContent = "0";
            
            document.getElementById("kpi-don-thuoc-total").textContent = "0";
            document.getElementById("kpi-don-thuoc-bhyt").textContent = "0";
            document.getElementById("kpi-don-thuoc-khong-bhyt").textContent = "0";
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu KPI dashboard:", error);
    }
}

// Hàm load và vẽ biểu đồ dịch vụ khám chữa bệnh
async function fetchServiceChartData(startTimestamp, endTimestamp) {
    try {
        // Fetch CLS data for services
        const response = await fetch(`/api/baocaocls?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            // Process data for stacked bar chart
            const services = [
                'Khám bệnh', 'Siêu âm', 'Thăm dò chức năng', 'Thủ thuật',
                'Xét nghiệm huyết học', 'Xét nghiệm nước tiểu', 'Xét nghiệm sinh hóa',
                'Xét nghiệm vi sinh', 'X-Quang'
            ];
            
            const chuaThucHien = [];
            const daThucHien = [];
            
            // Map service names to data
            const serviceMap = {
                'Khám bệnh': { chua: 0, da: 0 },
                'Siêu âm': { chua: 0, da: 0 },
                'Thăm dò chức năng': { chua: 0, da: 0 },
                'Thủ thuật': { chua: 0, da: 0 },
                'Xét nghiệm huyết học': { chua: 0, da: 0 },
                'Xét nghiệm nước tiểu': { chua: 0, da: 0 },
                'Xét nghiệm sinh hóa': { chua: 0, da: 0 },
                'Xét nghiệm vi sinh': { chua: 0, da: 0 },
                'X-Quang': { chua: 0, da: 0 }
            };
            
            // Process actual data if available
            data.forEach(item => {
                // Map data based on service type - adjust based on actual API response
                // This is a placeholder - adjust according to your actual data structure
            });
            
            // For now, use sample data structure
            services.forEach(() => {
                chuaThucHien.push(0);
                daThucHien.push(0);
            });
            
            // Draw chart
            const ctx = document.getElementById('serviceChart');
            if (ctx && serviceChart) {
                serviceChart.destroy();
            }
            
            if (ctx) {
                serviceChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: services,
                        datasets: [
                            {
                                label: 'Chưa thực hiện',
                                data: chuaThucHien,
                                backgroundColor: 'rgba(255, 159, 64, 0.8)',
                                borderColor: 'rgba(255, 159, 64, 1)',
                                borderWidth: 1
                            },
                            {
                                label: 'Đã thực hiện',
                                data: daThucHien,
                                backgroundColor: 'rgba(75, 192, 192, 0.8)',
                                borderColor: 'rgba(75, 192, 192, 1)',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                beginAtZero: true
                            },
                            y: {
                                stacked: true
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu biểu đồ dịch vụ:", error);
    }
}

// Hàm load dữ liệu bảng người bệnh nội trú
async function fetchNoiTruTableData(startTimestamp, endTimestamp) {
    try {
        const response = await fetch(`/api/chitietdieutrinoitru?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-noitru');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        function formatCurrency(value) {
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
        }

        if (data && data.length > 0) {
            let stt = 1;
            data.forEach(row => {
                const tr = document.createElement('tr');
                const hienCo = parseInt(row.cuoi_ky) || 0;
                const vaoKhoa = parseInt(row.vao_vien) || 0;
                const raKhoa = parseInt(row.chuyen_khoa_di) || 0;
                const raVien = parseInt(row.ra_vien) || 0;
                const giuongKeHoach = parseInt(row.giuong_ke_hoach) || 0;
                const congSuat = giuongKeHoach > 0 ? ((hienCo / giuongKeHoach) * 100).toFixed(2) : 0;
                
                tr.innerHTML = `
                    <td>${stt++}</td>
                    <td class="hrl_name">${row.ten_khoa || ''}</td>
                    <td>${formatCurrency(hienCo)}</td>
                    <td>${formatCurrency(vaoKhoa)}</td>
                    <td>${formatCurrency(raKhoa)}</td>
                    <td>${formatCurrency(raVien)}</td>
                    <td>${formatCurrency(giuongKeHoach)}</td>
                    <td>${congSuat}%</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            // Show empty state or message if no data
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px;">Không có dữ liệu</td>';
            tbody.appendChild(tr);
        }

        // Load total row
        try {
            const sumResponse = await fetch(`/api/sumchitietdieutrinoitru?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
            const sumData = await sumResponse.json();
            
            const tbody2 = document.getElementById('table-body2-noitru');
            if (tbody2 && sumData) {
                const totalHienCo = parseInt(sumData.cuoi_ky) || 0;
                const totalVaoKhoa = parseInt(sumData.vao_vien) || 0;
                const totalRaKhoa = parseInt(sumData.chuyen_khoa_di) || 0;
                const totalRaVien = parseInt(sumData.ra_vien) || 0;
                const totalGiuong = parseInt(sumData.giuong_ke_hoach) || 0;
                const totalCongSuat = totalGiuong > 0 ? ((totalHienCo / totalGiuong) * 100).toFixed(2) : 0;
                
                tbody2.innerHTML = `
                    <td colspan="2">TOÀN VIỆN</td>
                    <td>${formatCurrency(totalHienCo)}</td>
                    <td>${formatCurrency(totalVaoKhoa)}</td>
                    <td>${formatCurrency(totalRaKhoa)}</td>
                    <td>${formatCurrency(totalRaVien)}</td>
                    <td>${formatCurrency(totalGiuong)}</td>
                    <td>${totalCongSuat}%</td>
                `;
            }
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu tổng nội trú:", error);
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu bảng nội trú:", error);
    }
}

// Hàm load và vẽ biểu đồ thống kê lượt tiếp đón
async function fetchReceptionChartData() {
    try {
        const response = await fetch(`/api/hoatdongbenhvientheongay`);
        const data = await response.json();

        if (data && data.length > 0) {
            const labels = data.map(row => row.ngay || '').slice(-7); // Last 7 days
            const receptionData = data.map(row => parseInt(row.tong_so_luot_kham) || 0).slice(-7);

            const ctx = document.getElementById('receptionChart');
            if (ctx && receptionChart) {
                receptionChart.destroy();
            }
            
            if (ctx) {
                receptionChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Lượt tiếp đón',
                            data: receptionData,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu biểu đồ tiếp đón:", error);
    }
}

// Hàm load và vẽ biểu đồ doanh thu ngày
async function fetchRevenueChartData() {
    try {
        // Using existing API or create new one for revenue
        const response = await fetch(`/api/doanhthunoitru`);
        const data = await response.json();

        if (data && data.length > 0) {
            // Process last 7 days
            const last7Days = data.slice(-7);
            const labels = last7Days.map(row => row.ngay || '');
            const revenueData = last7Days.map(row => parseFloat(row.tong_doanh_thu || 0) / 1000000); // Convert to millions

            const ctx = document.getElementById('revenueChart');
            if (ctx && revenueChart) {
                revenueChart.destroy();
            }
            
            if (ctx) {
                revenueChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Doanh thu (Tr)',
                            data: revenueData,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return value + ' Tr';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu biểu đồ doanh thu:", error);
    }
}

// Hàm load và vẽ biểu đồ cơ cấu doanh thu
async function fetchRevenueStructureData(startTimestamp, endTimestamp) {
    try {
        // Fetch revenue data
        const response = await fetch(`/api/doanhthunoitru?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            // Calculate total revenue
            let totalRevenue = 0;
            data.forEach(row => {
                totalRevenue += parseFloat(row.tong_doanh_thu || 0);
            });

            // Sample structure - adjust based on actual data
            const structureData = {
                labels: ['Nội trú điều trị ngoại trú', 'Nội trú', 'Khác'],
                values: [
                    totalRevenue * 0.08,  // 8%
                    totalRevenue * 0.21,  // 21%
                    totalRevenue * 0.71   // 71%
                ]
            };

            // Draw revenue structure chart
            const ctx1 = document.getElementById('revenueStructureChart');
            if (ctx1 && revenueStructureChart) {
                revenueStructureChart.destroy();
            }
            
            if (ctx1) {
                revenueStructureChart = new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: structureData.labels,
                        datasets: [{
                            data: structureData.values,
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.8)',
                                'rgba(75, 192, 192, 0.8)',
                                'rgba(153, 102, 255, 0.8)'
                            ],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }

            // Update total revenue
            document.getElementById('total-revenue-structure').textContent = 
                new Intl.NumberFormat('vi-VN').format(totalRevenue);

            // Draw revenue by subject chart
            const subjectData = {
                labels: ['Khám sức khỏe', 'Viện phí', 'Khác'],
                values: [
                    totalRevenue * 0.2758,  // 27.58%
                    totalRevenue * 0.0,     // 0%
                    totalRevenue * 0.7242   // 72.42%
                ]
            };

            const ctx2 = document.getElementById('revenueBySubjectChart');
            if (ctx2 && revenueBySubjectChart) {
                revenueBySubjectChart.destroy();
            }
            
            if (ctx2) {
                revenueBySubjectChart = new Chart(ctx2, {
                    type: 'doughnut',
                    data: {
                        labels: subjectData.labels,
                        datasets: [{
                            data: subjectData.values,
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(201, 203, 207, 0.8)',
                                'rgba(255, 159, 64, 0.8)'
                            ],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }

            // Update total revenue for subject chart
            document.getElementById('total-revenue-subject').textContent = 
                new Intl.NumberFormat('vi-VN').format(totalRevenue);
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu cơ cấu doanh thu:", error);
    }
}

// Hàm tải lại chỉ phần nội dung của `dm-hoatdongbenhvien`
function autoReloadHoatDongBenhVien() {
    const tongSoLuotKham = document.getElementById("tong_so_luot_kham");
    if (tongSoLuotKham) {
        // Nếu phần tử tồn tại, tức là trang `dm-hoatdongbenhvien` đang được tải
        const startDate = getDefaultDateTime();
        const startTime = "00:01";
        const endDate = getDefaultDateTime();
        const endTime = "23:59";
        const startTimestamp = `${startDate} ${startTime}`;
        const endTimestamp = `${endDate} ${endTime}`;

        fetch(`/api/hoatdongbenhvien?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`)
            .then(response => response.json())
            .then(data => {
                console.log("Auto-reloaded data:", data);

                if (data && data.length > 0) {
                    const row = data[0];
                    document.getElementById("tong_so_luot_kham").textContent = row.tong_so_luot_kham || 0;
                    document.getElementById("so_luong_nhap_vien").textContent = row.so_luong_nhap_vien || 0;
                    document.getElementById("so_luong_chuyen_vien").textContent = row.so_luong_chuyen_vien || 0;
                    document.getElementById("so_luong_bao_hiem").textContent = row.so_luong_bao_hiem || 0;
                    document.getElementById("so_luong_dich_vu").textContent = row.so_luong_dich_vu || 0;
                    document.getElementById("tong_so_nguoi_benh").textContent = row.tong_so_nguoi_benh || 0;
                } else {
                    console.warn("API returned no data");
                    document.getElementById("tong_so_luot_kham").textContent = "";
                    document.getElementById("so_luong_nhap_vien").textContent = "";
                    document.getElementById("so_luong_chuyen_vien").textContent = "";
                    document.getElementById("so_luong_bao_hiem").textContent = "";
                    document.getElementById("so_luong_dich_vu").textContent = "";
                    document.getElementById("tong_so_nguoi_benh").textContent = "";
                }
            })
            .catch(error => {
                console.error("Error in autoReloadHoatDongBenhVien:", error);
            });
    }
}

function updateEndTime() {
    const tongSoLuotKham = document.getElementById("tong_so_luot_kham");
    if (tongSoLuotKham) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const endTime = `${hours}:${minutes}:${seconds}`;

        document.getElementById('endTime').value = endTime; // Cập nhật giá trị endTime trên web
    }
}

// Gọi hàm `updateEndTime` mỗi giây để cập nhật thời gian
setInterval(updateEndTime, 1000);
// Gọi hàm autoReloadHoatDongBenhVien mỗi 30 giây để tự động cập nhật các trường cần thiết
setInterval(autoReloadHoatDongBenhVien, 5000); // 30000 ms = 30 giây

function loadBaoCaoNgay() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaongay', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;

            initBaoCaoNgay(); // Gọi hàm khởi tạo sau khi nội dung được tải
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}


function initBaoCaoNgay() {
    // Gán sự kiện cho nút sau khi đảm bảo DOM đã tải
    document.getElementById('loadReportButton').addEventListener('click', fetchAndDrawChart);

    // Kiểm tra sự tồn tại của các phần tử input
    const startDateInput = document.getElementById('startDateBCNgay');
    const startTimeInput = document.getElementById('startTimeBCNgay');
    const endDateInput = document.getElementById('endDateBCNgay');
    const endTimeInput = document.getElementById('endTimeBCNgay');

    if (startDateInput && startTimeInput && endTimeInput && endDateInput) {
        console.log("Tất cả các phần tử input tồn tại.");
        fetchAndDrawChart();  // Gọi hàm chỉ khi các phần tử tồn tại
    } else {
        console.error("Một hoặc nhiều phần tử input không tồn tại.");
    }
}

async function fetchAndDrawChart() {
    console.log('Bắt đầu tải dữ liệu cho biểu đồ');
    const startDateInput = document.getElementById('startDateBCNgay');
    const startTimeInput = document.getElementById('startTimeBCNgay');
    const endDateInput = document.getElementById('endDateBCNgay');
    const endTimeInput = document.getElementById('endTimeBCNgay');

    try {
        if (!startDateInput || !startTimeInput || !endDateInput || !endTimeInput) {
            console.error("Một hoặc nhiều phần tử input không tồn tại.");
            return;
        }

        const startDate = getDefaultDateTime();
        const startTime = "00:01";
        const endDate = getDefaultDateTime();
        const endTime = "23:59";
        const startTimestamp = `${startDate} ${startTime}`;
        const endTimestamp = `${endDate} ${endTime}`;


        const response = await fetch(`/api/baocaongay?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        console.log("Dữ liệu từ API:", data);

        const ctx = document.getElementById('dailyReportChart')?.getContext('2d');
        if (!ctx) {
            console.error('Không tìm thấy phần tử canvas với id "dailyReportChart"');
            return;
        }

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [
                    'Tổng số người bệnh',
                    'Tổng số lượt khám',
                    'Số lượng nhập viện',
                    'Số lượng chuyển viện',
                    'Bảo hiểm y tế',
                    'Dịch vụ',
                ],
                datasets: [{
                    label: 'Thống kê theo ngày',
                    data: [
                        data.tong_so_nguoi_benh,
                        data.tong_so_luot_kham,
                        data.so_luong_nhap_vien,
                        data.so_luong_chuyen_vien,
                        data.so_luong_bao_hiem,
                        data.so_luong_dich_vu
                    ],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    datalabels: {
                        anchor: 'end',          // Đặt vị trí nhãn phía trên cột
                        align: 'end',           // Căn chỉnh nhãn ở đầu mỗi cột
                        font: {
                            size: 14,           // Điều chỉnh kích thước chữ
                            weight: 'bold'      // Chữ đậm
                        },
                        color: '#333'           // Màu chữ (đậm hơn)
                    }
                }
            },
            plugins: [ChartDataLabels] // Kích hoạt plugin Data Labels
        });
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API:", error);
    }
}

// Khởi tạo báo cáo theo tuần
function loadBaoCaoTuan() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaotuan', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            setThoiGianBaoCaoTuan('startDate', 'endDate');
            fetchAndDrawWeeklyChart();
            initBaoCaoTuan(); // Khởi tạo biểu đồ theo tuần
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function loadDashBoardBSKham() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-dashboard-bskham', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;

            fetchDashBoardBSKham(); // Gọi hàm khởi tạo sau khi nội dung được tải
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}


// Hàm định dạng ngày thành dd/mm/yyyy để hiển thị trên giao diện
function formatDateDisplay(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Hàm định dạng ngày thành yyyy-mm-dd để truyền vào API
function formatDateToApi(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setThoiGianBaoCaoTuan(startDateId, endDateId) {
    const startDateInput = document.getElementById(startDateId);
    const endDateInput = document.getElementById(endDateId);

    if (startDateInput && endDateInput) {
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 6);

        // Gán giá trị theo định dạng dd/mm/yyyy cho giao diện
        startDateInput.value = formatDateDisplay(pastDate);
        endDateInput.value = formatDateDisplay(today);
    } else {
        console.error(`Không tìm thấy phần tử với id '${startDateId}' hoặc '${endDateId}'`);
    }
}

// Hàm khởi tạo sự kiện cho nút tải báo cáo theo tuần
function initBaoCaoTuan() {
    document.getElementById('loadReportButton').addEventListener('click', fetchAndDrawWeeklyChart);
}

let weeklyChart = null;

// Hàm lấy dữ liệu từ API và vẽ biểu đồ
async function fetchAndDrawWeeklyChart() {
    const startDateDisplay = document.getElementById("startDate").value;
    const endDateDisplay = document.getElementById("endDate").value;
    const startDate = convertDisplayToApiDate(startDateDisplay);
    const endDate = convertDisplayToApiDate(endDateDisplay);

    if (!startDate || !endDate) {
        alert("Vui lòng chọn khoảng thời gian.");
        return;
    }

    try {
        const response = await fetch(`/api/baocaotuan?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const data = await response.json();

        const labels = data.map(row => {
            const date = new Date(row.ngay);
            return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        });

        const tongSoNguoiBenh = data.map(row => row.tong_so_nguoi_benh);
        const tongSoLuotKham = data.map(row => row.tong_so_luot_kham);
        const soLuongNhapVien = data.map(row => row.so_luong_nhap_vien);
        const soLuongChuyenVien = data.map(row => row.so_luong_chuyen_vien);
        const soLuongBaoHiem = data.map(row => row.so_luong_bao_hiem);
        const soLuongDichVu = data.map(row => row.so_luong_dich_vu);

        if (weeklyChart) {
            weeklyChart.destroy();
        }

        const ctx = document.getElementById('weeklyReportChart').getContext('2d');
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Tổng số người bệnh', data: tongSoNguoiBenh, backgroundColor: 'rgb(46, 16, 218)' }, // màu hồng cho Tổng số người bệnh
                    { label: 'Tổng số lượt khám', data: tongSoLuotKham, backgroundColor: 'rgb(211, 39, 223)' }, // màu xanh dương cho Tổng số lượt khám
                    { label: 'Số lượng nhập viện', data: soLuongNhapVien, backgroundColor: 'red' }, // màu vàng cho Số lượng nhập viện
                    { label: 'Số lượng chuyển viện', data: soLuongChuyenVien, backgroundColor: 'rgb(26, 215, 136)' }, // màu xanh ngọc cho Số lượng chuyển viện
                    { label: 'Bảo hiểm y tế', data: soLuongBaoHiem, backgroundColor: 'rgb(211, 39, 3)' }, // màu tím cho Bảo hiểm y tế
                    { label: 'Dịch vụ', data: soLuongDichVu, backgroundColor: 'darkorange' }, // màu cam cho Dịch vụ
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        font: { size: 12, weight: 'bold' },
                        color: '#333'
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API:", error);
    }
}

async function loadHoatDongBenhVienTheoTuan() {
    const startDateDisplay = document.getElementById("startDate").value;
    const endDateDisplay = document.getElementById("endDate").value;
    const startDate = convertDisplayToApiDate(startDateDisplay);
    const endDate = convertDisplayToApiDate(endDateDisplay);

    if (!startDate || !endDate) {
        alert("Vui lòng chọn khoảng thời gian.");
        return;
    }

    try {
        const response = await fetch(`/api/baocaotuan?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        const data = await response.json();

        const labels = data.map(row => {
            const date = new Date(row.ngay);
            return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        });

        const tongSoNguoiBenh = data.map(row => row.tong_so_nguoi_benh);
        const tongSoLuotKham = data.map(row => row.tong_so_luot_kham);
        const soLuongNhapVien = data.map(row => row.so_luong_nhap_vien);
        const soLuongChuyenVien = data.map(row => row.so_luong_chuyen_vien);
        const soLuongBaoHiem = data.map(row => row.so_luong_bao_hiem);
        const soLuongDichVu = data.map(row => row.so_luong_dich_vu);

        if (weeklyChart) {
            weeklyChart.destroy();
        }

        const ctx = document.getElementById('thongKeTheoNgayReportChart').getContext('2d');
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Tổng số người bệnh', data: tongSoNguoiBenh, backgroundColor: 'rgb(46, 16, 218)' }, // màu hồng cho Tổng số người bệnh
                    { label: 'Tổng số lượt khám', data: tongSoLuotKham, backgroundColor: 'rgb(211, 39, 223)' }, // màu xanh dương cho Tổng số lượt khám
                    { label: 'Số lượng nhập viện', data: soLuongNhapVien, backgroundColor: 'red' }, // màu vàng cho Số lượng nhập viện
                    { label: 'Số lượng chuyển viện', data: soLuongChuyenVien, backgroundColor: 'rgb(26, 215, 136)' }, // màu xanh ngọc cho Số lượng chuyển viện
                    { label: 'Bảo hiểm y tế', data: soLuongBaoHiem, backgroundColor: 'rgb(211, 39, 3)' }, // màu tím cho Bảo hiểm y tế
                    { label: 'Dịch vụ', data: soLuongDichVu, backgroundColor: 'darkorange' }, // màu cam cho Dịch vụ
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        font: { size: 12, weight: 'bold' },
                        color: '#333'
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API:", error);
    }
}

function convertDisplayToApiDate(displayDate) {
    const [day, month, year] = displayDate.split('/');
    return `${year}-${month}-${day}`;
}

// Hàm loadBaoCaoPhongKham
function loadBaoCaoPhongKham() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaophongkham', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            fetchChiTietPhongKham();
            fetchBaoCaoTheoBSKham();
            initBaoCaoPhongKham(); // Khởi tạo biểu đồ sau khi tải xong
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function initBaoCaoPhongKham() {
    document.getElementById('zButtonBCPhongKham').addEventListener('click', () => {
        // Khởi tạo sự kiện cho button "Lấy Báo Cáo"
        fetchChiTietPhongKham();
        fetchBaoCaoTheoBSKham();
    });
}

async function fetchChiTietPhongKham() {
    const startDate = document.getElementById('startDateBCPhongKham').value;
    const startTime = document.getElementById('startTimeBCPhongKham').value;
    const endDate = document.getElementById('endDateBCPhongKham').value;
    const endTime = document.getElementById('endTimeBCPhongKham').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    const formattedStartDate = convertDisplayToApiDate(startDate);
    const formattedEndDate = convertDisplayToApiDate(endDate);

    // Kết hợp ngày và giờ thành timestamp
    const startTimestamp = `${formattedStartDate} ${startTime}`;
    const endTimestamp = `${formattedEndDate} ${endTime}`;

    try {
        const response = await fetch(`/api/baocaochitietphongkham?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-chitietphongkham');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            if (value === 0 || value === "0") {
                return ''; // Nếu là số 0 hoặc chuỗi "0", trả về trống
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là 0 hoặc "0" thì bỏ qua
            if (
                (!row.tong_so_bn || row.tong_so_bn === "0") &&
                (!row.tong_bn_bhyt || row.tong_bn_bhyt === "0") &&
                (!row.tong_bn_vien_phi || row.tong_bn_vien_phi === "0") &&
                (!row.tong_bn_cap_cuu || row.tong_bn_cap_cuu === "0") &&
                (!row.tong_bn_nam_duoi15tuoi || row.tong_bn_nam_duoi15tuoi === "0") &&
                (!row.tong_bn_nu_duoi15tuoi || row.tong_bn_nu_duoi15tuoi === "0") &&
                (!row.tong_bn_nam_tren60tuoi || row.tong_bn_nam_tren60tuoi === "0") &&
                (!row.tong_bn_nu_tren60tuoi || row.tong_bn_nu_tren60tuoi === "0") &&
                (!row.tong_bn_nhap_vien || row.tong_bn_nhap_vien === "0") &&
                (!row.tong_bn_chuyen_vien || row.tong_bn_chuyen_vien === "0") &&
                (!row.tong_bn_dt_ngoaitru || row.tong_bn_dt_ngoaitru === "0")
            ) {
                return; // Bỏ qua hàng này
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_phong}</td>
                <td class="currency">${formatCurrency(row.tong_so_bn)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_bhyt)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_vien_phi)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_cap_cuu)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_nam_duoi15tuoi)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_nu_duoi15tuoi)}</td>
				<td class="currency">${formatCurrency(row.tong_bn_nam_tren60tuoi)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_nu_tren60tuoi)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_nhap_vien)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_chuyen_vien)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_dt_ngoaitru)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng chi tiết phòng khám:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaochitietphongkham?startDate=${encodeURIComponent(startTimestamp)}&endDate=${encodeURIComponent(endTimestamp)}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-chitietphongkham');
        if (!tbody) {
            console.error('Không tìm thấy table-body2-chitietphongkham');
            return;
        }

        tbody.innerHTML = `
            <td colspan="2">Tổng cộng</td>
            <td class="currency">${formatCurrency(data.tong_so_bn)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_bhyt)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_vien_phi)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_cap_cuu)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_nam_duoi15tuoi)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_nu_duoi15tuoi)}</td>
			<td class="currency">${formatCurrency(data.tong_bn_nam_tren60tuoi)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_nu_tren60tuoi)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_nhap_vien)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_chuyen_vien)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_dt_ngoaitru)}</td>
        `;

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum chi tiết phòng khám:", error);
    }
}

async function fetchBaoCaoTheoBSKham() {
    const startDate = document.getElementById('startDateBCPhongKham').value;
    const startTime = document.getElementById('startTimeBCPhongKham').value;
    const endDate = document.getElementById('endDateBCPhongKham').value;
    const endTime = document.getElementById('endTimeBCPhongKham').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaothongkebskham?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-bacsikham');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            if (value === 0 || value === "0") {
                return ''; // Nếu là số 0 hoặc chuỗi "0", trả về trống
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_bac_si}</td>
                <td class="currency">${formatCurrency(row.tong_so_bn)}</td>
                <td class="currency">${formatCurrency(row.tong_bn_bhyt)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API Thống kê BS Khám:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaothongkebskham?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-bacsikham');
        tbody.innerHTML = `
            <td colspan="2">Tổng cộng</td>
            <td class="currency">${formatCurrency(data.tong_so_bn)}</td>
            <td class="currency">${formatCurrency(data.tong_bn_bhyt)}</td>
        `;

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API Thống kê tổng BS Khám", error);
    }
}

let bsKhamCtx = null;
async function fetchDashBoardBSKham() {
    const startDate = document.getElementById('startDatebsKham_db').value;
    const startTime = document.getElementById('startTimebsKham_db').value;
    const endDate = document.getElementById('endDatebsKham_db').value;
    const endTime = document.getElementById('endTimebsKham_db').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaoPhongKham?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const labels = data.bsKham.map((item, index) => `${index + 1}. ${item.ten_bac_si}`);

        const counts = data.bsKham.map(item => item.tong_so_bn);

        // Determine background colors based on counts
        const backgroundColors = counts.map(value => {
            return value > 65 ? 'red' : 'blue'; // Red for values > 65, blue otherwise
        });

        // Draw the bar chart
        if (bsKhamCtx) {
            bsKhamCtx.destroy(); // Destroy previous instance to avoid duplication
        }

        const ctx = document.getElementById('luotKhamBSReportChart').getContext('2d');
        bsKhamCtx = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số Lượt Khám',
                    data: counts,
                    backgroundColor: backgroundColors // Apply dynamic colors
                }]
            },
            options: {
                layout: {
                    padding: {
                        right: 30 // Điều chỉnh giá trị này cho phù hợp 
                    }
                },
                indexAxis: 'y', // This makes the bar chart horizontal
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: 14 // Adjust font size for X-axis labels
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 16 // Giảm kích thước phông chữ nếu cần
                            },
                            align: 'start', // Căn nhãn bên trái cho rõ hơn
                        }
                    },
                },
                plugins: {
                    legend: {
                        display: true, // Enable legend
                        labels: {
                            generateLabels: (chart) => [
                                {
                                    text: 'Số lượt khám', // Blue legend
                                    fillStyle: 'blue',
                                    strokeStyle: 'blue',
                                    hidden: false,
                                    index: 0
                                },
                                {
                                    text: 'Số lượt khám > 65', // Red legend
                                    fillStyle: 'red',
                                    strokeStyle: 'red',
                                    hidden: false,
                                    index: 1
                                }
                            ]
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'end', // Align the data labels to the right side of each bar
                        font: {
                            size: 18, // Increase font size for data labels
                            weight: 'bold'
                        },
                        formatter: (value) => `${value}`, // Display count value on the right
                        color: '#333'
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API:", error);
    }
}

// Hàm loadBaoCaoDTNoiTru
function loadBaoCaoDieuTriNoiTru() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaodieutrinoitru', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            fetchBaoCaoChiTietDieuTriNoiTru();
            fetchBaoCaochitietdieutringoaitrutrongkhoa();
            initBaoCaoNoiTru();
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function initBaoCaoNoiTru() {
    document.getElementById('zButtonDTNoiTru').addEventListener('click', () => {
        // Khởi tạo sự kiện cho button "Lấy Báo Cáo"        
        fetchBaoCaoChiTietDieuTriNoiTru();
        fetchBaoCaochitietdieutringoaitrutrongkhoa();
    });
}

async function fetchAndDrawBaoCaoNoiTru() {
    const startDate = document.getElementById('startDateDTNoiTru').value;
    const startTime = document.getElementById('startTimeDTNoiTru').value;
    const endDate = document.getElementById('endDateDTNoiTru').value;
    const endTime = document.getElementById('endTimeDTNoiTru').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/doanhthunoitru?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-doanhthunoitru');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            if (value === null || value === undefined || value === 0 || value === "0") {
                return ''; // Nếu là null, undefined, số 0 hoặc chuỗi "0", trả về trống
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc 0 thì bỏ qua
            if (
                (!row.tong_bao_hiem_tra || parseFloat(row.tong_bao_hiem_tra) === "0") &&
                (!row.tong_dich_vu || parseFloat(row.tong_dich_vu) === "0") &&
                (!row.tong_tra_chenh || parseFloat(row.tong_tra_chenh) === "0") &&
                (!row.bh_phi_giuong || parseFloat(row.bh_phi_giuong) === "0") &&
                (!row.dv_phi_giuong || parseFloat(row.dv_phi_giuong) === "0") &&
                (!row.chenh_phi_giuong || parseFloat(row.chenh_phi_giuong) === "0") &&
                (!row.bh_phi_xn || parseFloat(row.bh_phi_xn) === "0") &&
                (!row.dv_phi_xn || parseFloat(row.dv_phi_xn) === "0") &&
                (!row.chenh_phi_xn || parseFloat(row.chenh_phi_xn) === "0") &&
                (!row.bh_phi_cls || parseFloat(row.bh_phi_cls) === "0") &&
                (!row.dv_phi_cls || parseFloat(row.dv_phi_cls) === "0") &&
                (!row.chenh_phi_cls || parseFloat(row.chenh_phi_cls) === "0") &&
                (!row.bh_phi_pttt || parseFloat(row.bh_phi_pttt) === "0") &&
                (!row.dv_phi_pttt || parseFloat(row.dv_phi_pttt) === "0") &&
                (!row.chenh_phi_pttt || parseFloat(row.chenh_phi_pttt) === "0") &&
                (!row.bh_phi_thuoc_vtyt || parseFloat(row.bh_phi_thuoc_vtyt) === "0") &&
                (!row.dv_phi_thuoc_vtyt || parseFloat(row.dv_phi_thuoc_vtyt) === "0") &&
                (!row.chenh_phi_thuoc_vtyt || parseFloat(row.chenh_phi_thuoc_vtyt) === "0") &&
                (!row.phi_vanchuyen || parseFloat(row.phi_vanchuyen) === "0") &&
                (!row.phi_khac || parseFloat(row.phi_khac) === "0")
            ) {
                return; // Bỏ qua hàng này
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.deptname}</td>
                <td class="currency">${formatCurrency(row.tong_bao_hiem_tra)}</td>
                <td class="currency">${formatCurrency(row.tong_dich_vu)}</td>
                <td class="currency">${formatCurrency(row.tong_tra_chenh)}</td>
                <td class="currency">${formatCurrency(row.bh_phi_giuong)}</td>
                <td class="currency">${formatCurrency(row.dv_phi_giuong)}</td>
                <td class="currency">${formatCurrency(row.chenh_phi_giuong)}</td>
                <td class="currency">${formatCurrency(row.bh_phi_xn)}</td>
                <td class="currency">${formatCurrency(row.dv_phi_xn)}</td>
                <td class="currency">${formatCurrency(row.chenh_phi_xn)}</td>
                <td class="currency">${formatCurrency(row.bh_phi_cls)}</td>
                <td class="currency">${formatCurrency(row.dv_phi_cls)}</td>
                <td class="currency">${formatCurrency(row.chenh_phi_cls)}</td>
                <td class="currency">${formatCurrency(row.bh_phi_pttt)}</td>
                <td class="currency">${formatCurrency(row.dv_phi_pttt)}</td>
                <td class="currency">${formatCurrency(row.chenh_phi_pttt)}</td>
                <td class="currency">${formatCurrency(row.bh_phi_thuoc_vtyt)}</td>
                <td class="currency">${formatCurrency(row.dv_phi_thuoc_vtyt)}</td>
                <td class="currency">${formatCurrency(row.chenh_phi_thuoc_vtyt)}</td>
                <td class="currency">${formatCurrency(row.phi_vanchuyen)}</td>
                <td class="currency">${formatCurrency(row.phi_khac)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API doanh thu noi tru:", error);
    }

    try {
        const response = await fetch(`/api/sumdoanhthunoitru?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-doanhthunoitru');
        tbody.innerHTML = `
            <td colspan="2">Tổng cộng</td>
            <td class="currency">${formatCurrency(data.tong_bao_hiem_tra)}</td>
            <td class="currency">${formatCurrency(data.tong_dich_vu)}</td>
            <td class="currency">${formatCurrency(data.tong_tra_chenh)}</td>
            <td class="currency">${formatCurrency(data.bh_phi_giuong)}</td>
            <td class="currency">${formatCurrency(data.dv_phi_giuong)}</td>
            <td class="currency">${formatCurrency(data.chenh_phi_giuong)}</td>
            <td class="currency">${formatCurrency(data.bh_phi_xn)}</td>
            <td class="currency">${formatCurrency(data.dv_phi_xn)}</td>
            <td class="currency">${formatCurrency(data.chenh_phi_xn)}</td>
            <td class="currency">${formatCurrency(data.bh_phi_cls)}</td>
            <td class="currency">${formatCurrency(data.dv_phi_cls)}</td>
            <td class="currency">${formatCurrency(data.chenh_phi_cls)}</td>
            <td class="currency">${formatCurrency(data.bh_phi_pttt)}</td>
            <td class="currency">${formatCurrency(data.dv_phi_pttt)}</td>
            <td class="currency">${formatCurrency(data.chenh_phi_pttt)}</td>
            <td class="currency">${formatCurrency(data.bh_phi_thuoc_vtyt)}</td>
            <td class="currency">${formatCurrency(data.dv_phi_thuoc_vtyt)}</td>
            <td class="currency">${formatCurrency(data.chenh_phi_thuoc_vtyt)}</td>
            <td class="currency">${formatCurrency(data.phi_vanchuyen)}</td>
            <td class="currency">${formatCurrency(data.phi_khac)}</td>
        `;

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng doanh thu noi tru:", error);
    }
}

async function fetchBaoCaoChiTietDieuTriNoiTru() {
    const startDate = document.getElementById('startDateDTNoiTru').value;
    const startTime = document.getElementById('startTimeDTNoiTru').value;
    const endDate = document.getElementById('endDateDTNoiTru').value;
    const endTime = document.getElementById('endTimeDTNoiTru').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/chitietdieutrinoitru?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-chitietdieutrinoitru');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            if (value === null || value === undefined || value === 0 || value === "0") {
                return ''; // Nếu là null, undefined, số 0 hoặc chuỗi "0", trả về trống
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc 0 thì bỏ qua
            if (
                (!row.bn_dauky || parseFloat(row.bn_dauky) === "0") &&
                (!row.bn_vaovien || parseFloat(row.bn_vaovien) === "0") &&
                (!row.bn_vaovien_bhyt || parseFloat(row.bn_vaovien_bhyt) === "0") &&
                (!row.bn_ravien || parseFloat(bn_ravien) === "0") &&
                (!row.bn_chuyenkhoa_den || parseFloat(row.bn_chuyenkhoa_den) === "0") &&
                (!row.bn_chuyenkhoa_di || parseFloat(row.bn_chuyenkhoa_di) === "0") &&
                (!row.bn_chuyenvien || parseFloat(row.bn_chuyenvien) === "0") &&
                (!row.bn_capcuu || parseFloat(row.bn_capcuu) === "0") &&
                (!row.bn_tuvong || parseFloat(row.bn_tuvong) === "0") &&
                (!row.bn_cuoiky || parseFloat(row.bn_cuoiky) === "0")

            ) {
                return; // Bỏ qua hàng này
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa}</td>
                <td class="currency">${formatCurrency(row.bn_dauky)}</td>
                <td class="currency">${formatCurrency(row.bn_vaovien)}</td>
                <td class="currency">${formatCurrency(row.bn_ravien)}</td>
                <td class="currency">${formatCurrency(row.bn_chuyenkhoa_den)}</td>
                <td class="currency">${formatCurrency(row.bn_chuyenkhoa_di)}</td>
                <td class="currency">${formatCurrency(row.bn_chuyenvien)}</td>
                <td class="currency">${formatCurrency(row.bn_vaovien_bhyt)}</td>
                <td class="currency">${formatCurrency(row.bn_capcuu)}</td>
                <td class="currency">${formatCurrency(row.bn_tuvong)}</td>
                <td class="currency">${formatCurrency(row.bn_cuoiky)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API chi tiết điều trị nội trú:", error);
    }

    try {
        const response = await fetch(`/api/sumchitietdieutrinoitru?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-chitietdieutrinoitru');
        tbody.innerHTML = `
            <td colspan="2">Tổng cộng</td>
            <td class="currency">${formatCurrency(data.bn_dauky)}</td>
            <td class="currency">${formatCurrency(data.bn_vaovien)}</td>
            <td class="currency">${formatCurrency(data.bn_ravien)}</td>
            <td class="currency">${formatCurrency(data.bn_chuyenkhoa_den)}</td>
            <td class="currency">${formatCurrency(data.bn_chuyenkhoa_di)}</td>
            <td class="currency">${formatCurrency(data.bn_chuyenvien)}</td>
            <td class="currency">${formatCurrency(data.bn_vaovien_bhyt)}</td>
            <td class="currency">${formatCurrency(data.bn_capcuu)}</td>
            <td class="currency">${formatCurrency(data.bn_tuvong)}</td>
            <td class="currency">${formatCurrency(data.bn_cuoiky)}</td>
        `;

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng chi tiết điều trị nội trú:", error);
    }
}

async function fetchBaoCaochitietdieutringoaitrutrongkhoa() {
    const startDate = document.getElementById('startDateDTNoiTru').value;
    const startTime = document.getElementById('startTimeDTNoiTru').value;
    const endDate = document.getElementById('endDateDTNoiTru').value;
    const endTime = document.getElementById('endTimeDTNoiTru').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/chitietdieutringoaitrutrongkhoa?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-chitietdieutringoaitrutrongkhoa');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            if (value === null || value === undefined || value === 0 || value === "0") {
                return ''; // Nếu là null, undefined, số 0 hoặc chuỗi "0", trả về trống
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc 0 thì bỏ qua
            if (
                (!row.bn_dauky || parseFloat(row.bn_dauky) === "0") &&
                (!row.bn_vaovien || parseFloat(row.bn_vaovien) === "0") &&
                (!row.bn_ravien || parseFloat(bn_ravien) === "0") &&
                (!row.bn_chuyenkhoa_den || parseFloat(row.bn_chuyenkhoa_den) === "0") &&
                (!row.bn_chuyenkhoa_di || parseFloat(row.bn_chuyenkhoa_di) === "0") &&
                (!row.bn_chuyenvien || parseFloat(row.bn_chuyenvien) === "0") &&
                (!row.bn_capcuu || parseFloat(row.bn_capcuu) === "0") &&
                (!row.bn_tuvong || parseFloat(row.bn_tuvong) === "0") &&
                (!row.bn_cuoiky || parseFloat(row.bn_cuoiky) === "0")

            ) {
                return; // Bỏ qua hàng này
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa}</td>
                <td class="currency">${formatCurrency(row.bn_dauky)}</td>
                <td class="currency">${formatCurrency(row.bn_vaovien)}</td>
                <td class="currency">${formatCurrency(row.bn_ravien)}</td>
                <td class="currency">${formatCurrency(row.bn_chuyenkhoa_den)}</td>
                <td class="currency">${formatCurrency(row.bn_chuyenkhoa_di)}</td>
                <td class="currency">${formatCurrency(row.bn_chuyenvien)}</td>
                <td class="currency">${formatCurrency(row.bn_capcuu)}</td>
                <td class="currency">${formatCurrency(row.bn_tuvong)}</td>
                <td class="currency">${formatCurrency(row.bn_cuoiky)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API chi tiết điều trị nội trú:", error);
    }

    try {
        const response = await fetch(`/api/sumchitietdieutringoaitrutrongkhoa?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-chitietdieutringoaitrutrongkhoa');
        tbody.innerHTML = `
            <td colspan="2">Tổng cộng</td>
            <td class="currency">${formatCurrency(data.bn_dauky)}</td>
            <td class="currency">${formatCurrency(data.bn_vaovien)}</td>
            <td class="currency">${formatCurrency(data.bn_ravien)}</td>
            <td class="currency">${formatCurrency(data.bn_chuyenkhoa_den)}</td>
            <td class="currency">${formatCurrency(data.bn_chuyenkhoa_di)}</td>
            <td class="currency">${formatCurrency(data.bn_chuyenvien)}</td>
            <td class="currency">${formatCurrency(data.bn_capcuu)}</td>
            <td class="currency">${formatCurrency(data.bn_tuvong)}</td>
            <td class="currency">${formatCurrency(data.bn_cuoiky)}</td>
        `;

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng chi tiết điều trị ngoại trú trong khoa:", error);
    }
}

// Hàm loadBaoCaoCLS
function loadBaoCaoCLS() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaocls', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            fetchAndDrawBaoCaoCLS();
            fetchAndDrawBaoCaoCLSTheoKhoa();
            initBaoCaoCLS(); // Khởi tạo biểu đồ sau khi tải xong
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function initBaoCaoCLS() {
    // Khởi tạo sự kiện cho button "Lấy Báo Cáo"
    document.getElementById('zButtonBCCanLamSang').addEventListener('click', () => {
        fetchAndDrawBaoCaoCLS();
        fetchAndDrawBaoCaoCLSTheoKhoa();
    });
}

async function fetchAndDrawBaoCaoCLS() {
    const startDate = document.getElementById('startDateBCCanLamSang').value;
    const startTime = document.getElementById('startTimeBCCanLamSang').value;
    const endDate = document.getElementById('endDateBCCanLamSang').value;
    const endTime = document.getElementById('endTimeBCCanLamSang').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaocls?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-cls');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            // Kiểm tra nếu giá trị là null, undefined, hoặc bằng 0
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0 hoặc không hợp lệ
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_cong || parseFloat(row.tong_cong) === 0) &&
                (!row.bh_ngoaitru || parseFloat(row.bh_ngoaitru) === 0) &&
                (!row.dv_ngoaitru || parseFloat(row.dv_ngoaitru) === 0) &&
                (!row.bh_noitru || parseFloat(row.bh_noitru) === 0) &&
                (!row.dv_noitru || parseFloat(row.dv_noitru) === 0) &&
                (!row.noi_soi || parseFloat(row.noi_soi) === 0) &&
                (!row.noi_soi_tmh || parseFloat(row.noi_soi_tmh) === 0) &&
                (!row.noi_soi_tieuhoa || parseFloat(row.noi_soi_tieuhoa) === 0) &&
                (!row.noi_soi_hohap || parseFloat(row.noi_soi_hohap) === 0) &&
                (!row.noi_soi_tucung || parseFloat(row.noi_soi_tucung) === 0) 
            ) {
                return; // Bỏ qua hàng này
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.nhom_cls}</td>
                <td class="currency">${formatCurrency(row.tong_cong)}</td>
                <td class="currency">${formatCurrency(row.bh_ngoaitru)}</td>
                <td class="currency">${formatCurrency(row.dv_ngoaitru)}</td>
                <td class="currency">${formatCurrency(row.bh_noitru)}</td>
                <td class="currency">${formatCurrency(row.dv_noitru)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tmh)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tieuhoa)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_hohap)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tucung)}</td>
                <td class="currency">${formatCurrency(row.noi_soi)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API cls:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaocls?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-cls');
        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_cong || parseFloat(data.tong_cong) === 0) &&
            (!data.bh_ngoaitru || parseFloat(data.bh_ngoaitru) === 0) &&
            (!data.dv_ngoaitru || parseFloat(data.dv_ngoaitru) === 0) &&
            (!data.bh_noitru || parseFloat(data.bh_noitru) === 0) &&
            (!data.dv_noitru || parseFloat(data.dv_noitru) === 0) &&
            (!row.noi_soi || parseFloat(row.noi_soi) === 0) &&
            (!row.noi_soi_tmh || parseFloat(row.noi_soi_tmh) === 0) &&
            (!row.noi_soi_tieuhoa || parseFloat(row.noi_soi_tieuhoa) === 0) &&
            (!row.noi_soi_hohap || parseFloat(row.noi_soi_hohap) === 0) &&
            (!row.noi_soi_tucung || parseFloat(row.noi_soi_tucung) === 0) 
        ) {
            tbody.innerHTML = ''; // Xóa nội dung nếu dòng tổng cộng không có giá trị
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_cong)}</td>
                <td class="currency">${formatCurrency(data.bh_ngoaitru)}</td>
                <td class="currency">${formatCurrency(data.dv_ngoaitru)}</td>
                <td class="currency">${formatCurrency(data.bh_noitru)}</td>
                <td class="currency">${formatCurrency(data.dv_noitru)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tmh)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tieuhoa)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_hohap)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tucung)}</td>
                <td class="currency">${formatCurrency(data.noi_soi)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum CLS:", error);
    }
}

async function fetchAndDrawBaoCaoCLSTheoKhoa() {
    const startDate = document.getElementById('startDateBCCanLamSang').value;
    const startTime = document.getElementById('startTimeBCCanLamSang').value;
    const endDate = document.getElementById('endDateBCCanLamSang').value;
    const endTime = document.getElementById('endTimeBCCanLamSang').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaoclstheokhoa?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-cls-theo-khoa');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu dưới dạng tiền tệ nhưng không có ký hiệu "₫"
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0 hoặc không hợp lệ
            }
            return new Intl.NumberFormat('vi-VN').format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_cong || parseFloat(row.tong_cong) === 0) &&
                (!row.xn_hh || parseFloat(row.xn_hh) === 0) &&
                (!row.xn_sh || parseFloat(row.xn_sh) === 0) &&
                (!row.xn_nt || parseFloat(row.xn_nt) === 0) &&
                (!row.xn_vs || parseFloat(row.xn_vs) === 0) &&
                (!row.xn_khac || parseFloat(row.xn_khac) === 0) &&
                (!row.x_quang_kts || parseFloat(row.x_quang_kts) === 0) &&
                (!row.citi || parseFloat(row.citi) === 0) &&
                (!row.mri || parseFloat(row.mri) === 0) &&
                (!row.sieu_am_mau || parseFloat(row.sieu_am_mau) === 0) &&
                (!row.cdha_khac || parseFloat(row.cdha_khac) === 0) &&
                (!row.noi_soi || parseFloat(row.noi_soi) === 0) &&
                (!row.noi_soi_tmh || parseFloat(row.noi_soi_tmh) === 0) &&
                (!row.noi_soi_tieuhoa || parseFloat(row.noi_soi_tieuhoa) === 0) &&
                (!row.noi_soi_hohap || parseFloat(row.noi_soi_hohap) === 0) &&
                (!row.noi_soi_tucung || parseFloat(row.noi_soi_tucung) === 0) &&
                (!row.dien_tim || parseFloat(row.dien_tim) === 0) &&
                (!row.cnhh || parseFloat(row.cnhh) === 0) &&
                (!row.tdcn || parseFloat(row.tdcn) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa}</td>
                <td class="currency">${formatCurrency(row.tong_cong)}</td>
                <td class="currency">${formatCurrency(row.xn_hh)}</td>
                <td class="currency">${formatCurrency(row.xn_sh)}</td>
                <td class="currency">${formatCurrency(row.xn_nt)}</td>
                <td class="currency">${formatCurrency(row.xn_vs)}</td>
                <td class="currency">${formatCurrency(row.xn_khac)}</td>
                <td class="currency">${formatCurrency(row.x_quang_kts)}</td>
                <td class="currency">${formatCurrency(row.citi)}</td>
                <td class="currency">${formatCurrency(row.mri)}</td>
                <td class="currency">${formatCurrency(row.sieu_am_mau)}</td>
                <td class="currency">${formatCurrency(row.cdha_khac)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tmh)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tieuhoa)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_hohap)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tucung)}</td>
                <td class="currency">${formatCurrency(row.noi_soi)}</td>
                <td class="currency">${formatCurrency(row.dien_tim)}</td>
                <td class="currency">${formatCurrency(row.cnhh)}</td>
                <td class="currency">${formatCurrency(row.tdcn)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API cls theo khoa:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaoclstheokhoa?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table2-cls-theo-khoa');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_cong || parseFloat(data.tong_cong) === 0) &&
            (!data.xn_hh || parseFloat(data.xn_hh) === 0) &&
            (!data.xn_sh || parseFloat(data.xn_sh) === 0) &&
            (!data.xn_nt || parseFloat(data.xn_nt) === 0) &&
            (!data.xn_vs || parseFloat(data.xn_vs) === 0) &&
            (!data.xn_khac || parseFloat(data.xn_khac) === 0) &&
            (!data.x_quang_kts || parseFloat(data.x_quang_kts) === 0) &&
            (!data.citi || parseFloat(data.citi) === 0) &&
            (!data.mri || parseFloat(data.mri) === 0) &&
            (!data.sieu_am_mau || parseFloat(data.sieu_am_mau) === 0) &&
            (!data.cdha_khac || parseFloat(data.cdha_khac) === 0) &&
            (!row.noi_soi || parseFloat(row.noi_soi) === 0) &&
            (!row.noi_soi_tmh || parseFloat(row.noi_soi_tmh) === 0) &&
            (!row.noi_soi_tieuhoa || parseFloat(row.noi_soi_tieuhoa) === 0) &&
            (!row.noi_soi_hohap || parseFloat(row.noi_soi_hohap) === 0) &&
            (!row.noi_soi_tucung || parseFloat(row.noi_soi_tucung) === 0) &&
            (!data.dien_tim || parseFloat(data.dien_tim) === 0) &&
            (!data.cnhh || parseFloat(data.cnhh) === 0) &&
            (!data.tdcn || parseFloat(data.tdcn) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_cong)}</td>
                <td class="currency">${formatCurrency(data.xn_hh)}</td>
                <td class="currency">${formatCurrency(data.xn_sh)}</td>
                <td class="currency">${formatCurrency(data.xn_nt)}</td>
                <td class="currency">${formatCurrency(data.xn_vs)}</td>
                <td class="currency">${formatCurrency(data.xn_khac)}</td>
                <td class="currency">${formatCurrency(data.x_quang_kts)}</td>
                <td class="currency">${formatCurrency(data.citi)}</td>
                <td class="currency">${formatCurrency(data.mri)}</td>
                <td class="currency">${formatCurrency(data.sieu_am_mau)}</td>
                <td class="currency">${formatCurrency(data.cdha_khac)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tmh)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tieuhoa)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_hohap)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tucung)}</td>
                <td class="currency">${formatCurrency(data.noi_soi)}</td>
                <td class="currency">${formatCurrency(data.dien_tim)}</td>
                <td class="currency">${formatCurrency(data.cnhh)}</td>
                <td class="currency">${formatCurrency(data.tdcn)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum CLS:", error);
    }
}

// Hàm loadBaoCaopttt
function loadBaoCaopttt() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaopttt', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            // Khởi tạo biểu đồ sau khi tải xong
            fetchAndDrawBaoCaopttt();
            fetchAndDrawbaocaopttttheobacsi();
            fetchAndDrawbaocaopttttheokhoaphong();
            fetchAndDrawbaocaothuthuattheokhoaphong();
            fetchAndDrawbaocaopttttheobenhnhan();
            initBaoCaopttt();
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function initBaoCaopttt() {
    document.getElementById('zButtonBCPTTT').addEventListener('click', () => {
        // Khởi tạo sự kiện cho button "Lấy Báo Cáo"
        fetchAndDrawBaoCaopttt();
        fetchAndDrawbaocaopttttheobacsi();
        fetchAndDrawbaocaopttttheokhoaphong();
        fetchAndDrawbaocaothuthuattheokhoaphong();
        fetchAndDrawbaocaopttttheobenhnhan();
    });
}

async function fetchAndDrawBaoCaopttt() {
    const startDate = document.getElementById('startDateBCPTTT').value;
    const startTime = document.getElementById('startTimeBCPTTT').value;
    const endDate = document.getElementById('endDateBCPTTT').value;
    const endTime = document.getElementById('endTimeBCPTTT').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaopttt?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-pttt');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_cong || parseFloat(row.tong_cong) === 0) &&
                (!row.bh_ngoaitru || parseFloat(row.bh_ngoaitru) === 0) &&
                (!row.dv_ngoaitru || parseFloat(row.dv_ngoaitru) === 0) &&
                (!row.bh_noitru || parseFloat(row.bh_noitru) === 0) &&
                (!row.dv_noitru || parseFloat(row.dv_noitru) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.description}</td>
                <td class="currency">${formatCurrency(row.tong_cong)}</td>
                <td class="currency">${formatCurrency(row.bh_ngoaitru)}</td>
                <td class="currency">${formatCurrency(row.dv_ngoaitru)}</td>
                <td class="currency">${formatCurrency(row.bh_noitru)}</td>
                <td class="currency">${formatCurrency(row.dv_noitru)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API doanh thu nội trú:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaopttt?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-pttt');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_cong || parseFloat(data.tong_cong) === 0) &&
            (!data.bh_ngoaitru || parseFloat(data.bh_ngoaitru) === 0) &&
            (!data.dv_ngoaitru || parseFloat(data.dv_ngoaitru) === 0) &&
            (!data.bh_noitru || parseFloat(data.bh_noitru) === 0) &&
            (!data.dv_noitru || parseFloat(data.dv_noitru) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_cong)}</td>
                <td class="currency">${formatCurrency(data.bh_ngoaitru)}</td>
                <td class="currency">${formatCurrency(data.dv_ngoaitru)}</td>
                <td class="currency">${formatCurrency(data.bh_noitru)}</td>
                <td class="currency">${formatCurrency(data.dv_noitru)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum PTTT:", error);
    }
}

async function fetchAndDrawbaocaopttttheobacsi() {
    const startDate = document.getElementById('startDateBCPTTT').value;
    const startTime = document.getElementById('startTimeBCPTTT').value;
    const endDate = document.getElementById('endDateBCPTTT').value;
    const endTime = document.getElementById('endTimeBCPTTT').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaopttttheobacsi?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-theobacsi');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_cong || parseFloat(row.tong_cong) === 0) &&
                (!row.pt_loai_db || parseFloat(row.pt_loai_db) === 0) &&
                (!row.pt_loai_1 || parseFloat(row.pt_loai_1) === 0) &&
                (!row.pt_loai_2 || parseFloat(row.pt_loai_2) === 0) &&
                (!row.pt_loai_3 || parseFloat(row.pt_loai_3) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.nguoi_thuc_hien}</td>
                <td class="currency">${formatCurrency(row.tong_cong)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_db)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_1)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_2)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_3)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng PTTT theo bác sĩ:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaopttttheobacsi?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-theobacsi');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_cong || parseFloat(data.tong_cong) === 0) &&
            (!data.pt_loai_db || parseFloat(data.pt_loai_db) === 0) &&
            (!data.pt_loai_1 || parseFloat(data.pt_loai_1) === 0) &&
            (!data.pt_loai_2 || parseFloat(data.pt_loai_2) === 0) &&
            (!data.pt_loai_3 || parseFloat(data.pt_loai_3) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_cong)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_db)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_1)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_2)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_3)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum PTTT theo bác sĩ:", error);
    }
}

// Hàm loadBaoCaoPTTTTheoKhoaPhong
async function fetchAndDrawbaocaopttttheokhoaphong() {
    const startDate = document.getElementById('startDateBCPTTT').value;
    const startTime = document.getElementById('startTimeBCPTTT').value;
    const endDate = document.getElementById('endDateBCPTTT').value;
    const endTime = document.getElementById('endTimeBCPTTT').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaopttttheokhoaphong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-pttt-khoaphong');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_cong || parseFloat(row.tong_cong) === 0) &&
                (!row.pt_loai_db || parseFloat(row.pt_loai_db) === 0) &&
                (!row.pt_loai_1 || parseFloat(row.pt_loai_1) === 0) &&
                (!row.pt_loai_2 || parseFloat(row.pt_loai_2) === 0) &&
                (!row.pt_loai_3 || parseFloat(row.pt_loai_3) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa}</td>
                <td class="currency">${formatCurrency(row.tong_cong)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_db)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_1)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_2)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_3)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng PTTT theo khoa phòng:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaopttttheokhoaphong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-pttt-khoaphong');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_cong || parseFloat(data.tong_cong) === 0) &&
            (!data.pt_loai_db || parseFloat(data.pt_loai_db) === 0) &&
            (!data.pt_loai_1 || parseFloat(data.pt_loai_1) === 0) &&
            (!data.pt_loai_2 || parseFloat(data.pt_loai_2) === 0) &&
            (!data.pt_loai_3 || parseFloat(data.pt_loai_3) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_cong)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_db)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_1)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_2)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_3)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum PTTT theo khoa phòng:", error);
    }
}

// Hàm loadbaocaothuthuattheokhoaphong
async function fetchAndDrawbaocaothuthuattheokhoaphong() {
    const startDate = document.getElementById('startDateBCPTTT').value;
    const startTime = document.getElementById('startTimeBCPTTT').value;
    const endDate = document.getElementById('endDateBCPTTT').value;
    const endTime = document.getElementById('endTimeBCPTTT').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaothuthuattheokhoaphong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-thuthuat-khoaphong');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_cong || parseFloat(row.tong_cong) === 0) &&
                (!row.tt_loai_db || parseFloat(row.tt_loai_db) === 0) &&
                (!row.tt_loai_1 || parseFloat(row.tt_loai_1) === 0) &&
                (!row.tt_loai_2 || parseFloat(row.tt_loai_2) === 0) &&
                (!row.tt_loai_3 || parseFloat(row.tt_loai_3) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa}</td>
                <td class="currency">${formatCurrency(row.tong_cong)}</td>
                <td class="currency">${formatCurrency(row.tt_loai_db)}</td>
                <td class="currency">${formatCurrency(row.tt_loai_1)}</td>
                <td class="currency">${formatCurrency(row.tt_loai_2)}</td>
                <td class="currency">${formatCurrency(row.tt_loai_3)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng Thủ thuật theo khoa phòng:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaothuthuattheokhoaphong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-thuthuat-khoaphong');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_cong || parseFloat(data.tong_cong) === 0) &&
            (!data.tt_loai_db || parseFloat(data.tt_loai_db) === 0) &&
            (!data.tt_loai_1 || parseFloat(data.tt_loai_1) === 0) &&
            (!data.tt_loai_2 || parseFloat(data.tt_loai_2) === 0) &&
            (!data.tt_loai_3 || parseFloat(data.tt_loai_3) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_cong)}</td>
                <td class="currency">${formatCurrency(data.tt_loai_db)}</td>
                <td class="currency">${formatCurrency(data.tt_loai_1)}</td>
                <td class="currency">${formatCurrency(data.tt_loai_2)}</td>
                <td class="currency">${formatCurrency(data.tt_loai_3)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum Thủ thuật theo khoa phòng:", error);
    }
}

// Hàm loadBaoCaoPTTTTheoBenhNhan
async function fetchAndDrawbaocaopttttheobenhnhan() {
    const startDate = document.getElementById('startDateBCPTTT').value;
    const startTime = document.getElementById('startTimeBCPTTT').value;
    const endDate = document.getElementById('endDateBCPTTT').value;
    const endTime = document.getElementById('endTimeBCPTTT').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaothuthuattheobenhnhan?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-pttt-benhnhan');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (                
                (!row.pt_loai_db || parseFloat(row.pt_loai_db) === 0) &&
                (!row.pt_loai_1 || parseFloat(row.pt_loai_1) === 0) &&
                (!row.pt_loai_2 || parseFloat(row.pt_loai_2) === 0) &&
                (!row.pt_loai_3 || parseFloat(row.pt_loai_3) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td>${row.so_hs}</td>                
                <td class="hrl_name">${row.ten_bn}</td>                
                <td class="hrl_name">${row.ma_khoa}</td>                
                <td class="currency">${formatCurrency(row.pt_loai_db)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_1)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_2)}</td>
                <td class="currency">${formatCurrency(row.pt_loai_3)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng PTTT theo bệnh nhân:", error);
    }    
    try {
        const response = await fetch(`/api/sumbaocaopttttheonguoibenh?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-pttt-benhnhan');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.pt_loai_db || parseFloat(data.pt_loai_db) === 0) &&
            (!data.pt_loai_1 || parseFloat(data.pt_loai_1) === 0) &&
            (!data.pt_loai_2 || parseFloat(data.pt_loai_2) === 0) &&
            (!data.pt_loai_3 || parseFloat(data.pt_loai_3) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="4">Tổng cộng</td>                
                <td class="currency">${formatCurrency(data.pt_loai_db)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_1)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_2)}</td>
                <td class="currency">${formatCurrency(data.pt_loai_3)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum Thủ thuật theo bệnh nhân:", error);
    }
}

// Hàm loadBaoCaoChiPhiTheoKhoaPhong
function loadBaoCaoChiPhiTheoKhoaPhong() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaothcpkhoaphong', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            fetchAndDrawBaoCaoTHCPKhoaPhong();
            initBaoCaoTHCPKhoaPhong(); // Khởi tạo biểu đồ sau khi tải xong
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function initBaoCaoTHCPKhoaPhong() {
    // Khởi tạo sự kiện cho button "Lấy Báo Cáo"
    document.getElementById('zButtonBCTHCPKhoaPhong').addEventListener('click', () => {
        fetchAndDrawBaoCaoTHCPKhoaPhong();
    });
}

async function fetchAndDrawBaoCaoTHCPKhoaPhong() {
    const startDate = document.getElementById('startDateBCTHCPKhoaPhong').value;
    const startTime = document.getElementById('startTimeBCTHCPKhoaPhong').value;
    const endDate = document.getElementById('endDateBCTHCPKhoaPhong').value;
    const endTime = document.getElementById('endTimeBCTHCPKhoaPhong').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaothcpkhoaphong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-thcp-khoa-phong');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.tong_chi_phi || parseFloat(row.tong_chi_phi) === 0) &&
                (!row.bao_hiem_tra || parseFloat(row.bao_hiem_tra) === 0) &&
                (!row.dich_vu_tra || parseFloat(row.dich_vu_tra) === 0) &&
                (!row.chenh_lech || parseFloat(row.chenh_lech) === 0) &&
                (!row.phi_kham || parseFloat(row.phi_kham) === 0) &&
                (!row.phi_giuong || parseFloat(row.phi_giuong) === 0) &&
                (!row.xn_hoa_sinh || parseFloat(row.xn_hoa_sinh) === 0) &&
                (!row.xn_vi_sinh || parseFloat(row.xn_vi_sinh) === 0) &&
                (!row.xn_mien_dich || parseFloat(row.xn_mien_dich) === 0) &&
                (!row.xn_gpb || parseFloat(row.xn_gpb) === 0) &&
                (!row.xn_khac || parseFloat(row.xn_khac) === 0) &&
                (!row.dien_tim || parseFloat(row.dien_tim) === 0) &&
                (!row.dien_nao || parseFloat(row.dien_nao) === 0) &&
                (!row.x_quang || parseFloat(row.x_quang) === 0) &&
                (!row.cty || parseFloat(row.cty) === 0) &&
                (!row.mri || parseFloat(row.mri) === 0) &&                
                (!row.noi_soi_tmh || parseFloat(row.noi_soi_tmh) === 0) &&
                (!row.noi_soi_tieuhoa || parseFloat(row.noi_soi_tieuhoa) === 0) &&
                (!row.noi_soi_hohap || parseFloat(row.noi_soi_hohap) === 0) &&
                (!row.noi_soi_tucung || parseFloat(row.noi_soi_tucung) === 0) &&
                (!row.noi_soi || parseFloat(row.noi_soi) === 0) &&
                (!row.sa_2d || parseFloat(row.sa_2d) === 0) &&
                (!row.sa_4d || parseFloat(row.sa_4d) === 0) &&
                (!row.sa_tim || parseFloat(row.sa_tim) === 0) &&
                (!row.thuoc_vattu || parseFloat(row.thuoc_vattu) === 0) &&
                (!row.phau_thuat || parseFloat(row.phau_thuat) === 0) &&
                (!row.thu_thuat || parseFloat(row.thu_thuat) === 0) &&
                (!row.chi_phi_khac || parseFloat(row.chi_phi_khac) === 0)

            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa || ''}</td>
                <td class="currency">${formatCurrency(row.tong_chi_phi)}</td>
                <td class="currency">${formatCurrency(row.bao_hiem_tra)}</td>
                <td class="currency">${formatCurrency(row.dich_vu_tra)}</td>
                <td class="currency">${formatCurrency(row.chenh_lech)}</td>
                <td class="currency">${formatCurrency(row.phi_kham)}</td>
                <td class="currency">${formatCurrency(row.phi_giuong)}</td>
                <td class="currency">${formatCurrency(row.xn_hoa_sinh)}</td>
                <td class="currency">${formatCurrency(row.xn_vi_sinh)}</td>
                <td class="currency">${formatCurrency(row.xn_mien_dich)}</td>
                <td class="currency">${formatCurrency(row.xn_gpb)}</td>
                <td class="currency">${formatCurrency(row.xn_khac)}</td>
                <td class="currency">${formatCurrency(row.dien_tim)}</td>
                <td class="currency">${formatCurrency(row.dien_nao)}</td>
                <td class="currency">${formatCurrency(row.x_quang)}</td>
                <td class="currency">${formatCurrency(row.cty)}</td>
                <td class="currency">${formatCurrency(row.mri)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tmh)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tieuhoa)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_hohap)}</td>
                <td class="currency">${formatCurrency(row.noi_soi_tucung)}</td>
                <td class="currency">${formatCurrency(row.noi_soi)}</td>
                <td class="currency">${formatCurrency(row.sa_2d)}</td>
                <td class="currency">${formatCurrency(row.sa_4d)}</td>
                <td class="currency">${formatCurrency(row.sa_tim)}</td>
                <td class="currency">${formatCurrency(row.phau_thuat)}</td>
                <td class="currency">${formatCurrency(row.thu_thuat)}</td>
                <td class="currency">${formatCurrency(row.thuoc_vattu)}</td>
                <td class="currency">${formatCurrency(row.chi_phi_khac)}</td>															
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API chi phí theo phòng khám:", error);
    }

    try {
        const response = await fetch(`/api/sumbaocaothcpkhoaphong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body2-thcp-khoa-phong');

        // Kiểm tra nếu tất cả giá trị trong dòng tổng cộng đều bằng 0
        if (
            (!data.tong_chi_phi || parseFloat(data.tong_chi_phi) === 0) &&
            (!data.bao_hiem_tra || parseFloat(data.bao_hiem_tra) === 0) &&
            (!data.dich_vu_tra || parseFloat(data.dich_vu_tra) === 0) &&
            (!data.chenh_lech || parseFloat(data.chenh_lech) === 0) &&
            (!data.phi_kham || parseFloat(data.phi_kham) === 0) &&
            (!data.phi_giuong || parseFloat(data.phi_giuong) === 0) &&
            (!data.xn_hoa_sinh || parseFloat(data.xn_hoa_sinh) === 0) &&
            (!data.xn_vi_sinh || parseFloat(data.xn_vi_sinh) === 0) &&
            (!data.xn_mien_dich || parseFloat(data.xn_mien_dich) === 0) &&
            (!data.xn_gpb || parseFloat(data.xn_gpb) === 0) &&
            (!data.xn_khac || parseFloat(data.xn_khac) === 0) &&
            (!data.dien_tim || parseFloat(data.dien_tim) === 0) &&
            (!data.dien_nao || parseFloat(data.dien_nao) === 0) &&
            (!data.x_quang || parseFloat(data.x_quang) === 0) &&
            (!data.cty || parseFloat(data.cty) === 0) &&
            (!data.mri || parseFloat(data.mri) === 0) &&
            (!data.noi_soi_tmh || parseFloat(data.noi_soi_tmh) === 0) &&
            (!data.noi_soi_tieuhoa || parseFloat(data.noi_soi_tieuhoa) === 0) &&
            (!data.noi_soi_hohap || parseFloat(data.noi_soi_hohap) === 0) &&
            (!data.noi_soi_tucung || parseFloat(data.noi_soi_tucung) === 0) &&
            (!data.noi_soi || parseFloat(data.noi_soi) === 0) &&
            (!data.sa_2d || parseFloat(data.sa_2d) === 0) &&
            (!data.sa_4d || parseFloat(data.sa_4d) === 0) &&
            (!data.sa_tim || parseFloat(data.sa_tim) === 0) &&
            (!data.thuoc_vattu || parseFloat(data.thuoc_vattu) === 0) &&
            (!data.phau_thuat || parseFloat(data.phau_thuat) === 0) &&
            (!data.thu_thuat || parseFloat(data.thu_thuat) === 0) &&
            (!data.chi_phi_khac || parseFloat(data.chi_phi_khac) === 0)
        ) {
            tbody.innerHTML = ''; // Không hiển thị dòng tổng cộng nếu tất cả giá trị bằng 0
        } else {
            tbody.innerHTML = `
                <td colspan="2">Tổng cộng</td>
                <td class="currency">${formatCurrency(data.tong_chi_phi)}</td>
                <td class="currency">${formatCurrency(data.bao_hiem_tra)}</td>
                <td class="currency">${formatCurrency(data.dich_vu_tra)}</td>
                <td class="currency">${formatCurrency(data.chenh_lech)}</td>
                <td class="currency">${formatCurrency(data.phi_kham)}</td>
                <td class="currency">${formatCurrency(data.phi_giuong)}</td>
                <td class="currency">${formatCurrency(data.xn_hoa_sinh)}</td>
                <td class="currency">${formatCurrency(data.xn_vi_sinh)}</td>
                <td class="currency">${formatCurrency(data.xn_mien_dich)}</td>
                <td class="currency">${formatCurrency(data.xn_gpb)}</td>
                <td class="currency">${formatCurrency(data.xn_khac)}</td>
                <td class="currency">${formatCurrency(data.dien_tim)}</td>
                <td class="currency">${formatCurrency(data.dien_nao)}</td>
                <td class="currency">${formatCurrency(data.x_quang)}</td>
                <td class="currency">${formatCurrency(data.cty)}</td>
                <td class="currency">${formatCurrency(data.mri)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tmh)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tieuhoa)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_hohap)}</td>
                <td class="currency">${formatCurrency(data.noi_soi_tucung)}</td>
                <td class="currency">${formatCurrency(data.noi_soi)}</td>
                <td class="currency">${formatCurrency(data.sa_2d)}</td>
                <td class="currency">${formatCurrency(data.sa_4d)}</td>
                <td class="currency">${formatCurrency(data.sa_tim)}</td>
                <td class="currency">${formatCurrency(data.phau_thuat)}</td>
                <td class="currency">${formatCurrency(data.thu_thuat)}</td>
                <td class="currency">${formatCurrency(data.thuoc_vattu)}</td>
                <td class="currency">${formatCurrency(data.chi_phi_khac)}</td>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tổng sum chi phí theo phòng khám:", error);
    }
}

// Hàm loadBaoCaoCongSuatGiuong
function loadBaoCaoCongSuatGiuong() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/dm-baocaocongsuatgiuong', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            document.getElementById('content-area').innerHTML = xhr.responseText;
            fetchAndDrawBaoCaoCongSuatGiuong();
            initBaoCaoCongSuatGiuong(); // Khởi tạo biểu đồ sau khi tải xong
        } else if (xhr.readyState === 4) {
            console.error("Lỗi khi tải dữ liệu:", xhr.status, xhr.statusText);
        }
    };
    xhr.send();
}

function initBaoCaoCongSuatGiuong() {
    // Khởi tạo sự kiện cho button "Lấy Báo Cáo"
    document.getElementById('zButtonCongSuatGiuong').addEventListener('click', () => {
        fetchAndDrawBaoCaoCongSuatGiuong();
    });
}

async function fetchAndDrawBaoCaoCongSuatGiuong() {
    const startDate = document.getElementById('startDateCongSuatGiuong').value;
    const startTime = document.getElementById('startTimeCongSuatGiuong').value;
    const endDate = document.getElementById('endDateCongSuatGiuong').value;
    const endTime = document.getElementById('endTimeCongSuatGiuong').value;

    const startDateID = convertDisplayToApiDate(startDate);
    const endDateID = convertDisplayToApiDate(endDate);

    try {
        const response = await fetch(`/api/baocaocongsuatgiuong?startDate=${startDateID} ${startTime}&endDate=${endDateID} ${endTime}`);
        const data = await response.json();

        const tbody = document.getElementById('table-body-cong-suat-giuong');
        tbody.innerHTML = ''; // Clear existing rows if any

        // Hàm để định dạng số liệu
        function formatCurrency(value) {
            if (value === null || value === undefined || parseFloat(value) === 0) {
                return ''; // Trả về chuỗi rỗng nếu giá trị là 0
            }
            return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        }

        data.forEach(row => {
            // Kiểm tra nếu toàn bộ giá trị trong hàng là null, undefined, hoặc bằng 0
            if (
                (!row.phong_thuong || parseFloat(row.phong_thuong) === 0) &&
                (!row.phong_tyc || parseFloat(row.phong_tyc) === 0) &&
                (!row.tong_giuong || parseFloat(row.tong_giuong) === 0) &&
                (!row.so_luong_dang_dieu_tri || parseFloat(row.so_luong_dang_dieu_tri) === 0) &&
                (!row.cong_suat_su_dung_giuong || parseFloat(row.cong_suat_su_dung_giuong) === 0)
            ) {
                return; // Bỏ qua hàng này nếu tất cả giá trị bằng 0
            }

            // Định dạng công suất sử dụng giường với 2 số thập phân
            let congSuatGiuongFormatted = '';
            if (row.cong_suat_su_dung_giuong !== null && row.cong_suat_su_dung_giuong !== undefined && !isNaN(row.cong_suat_su_dung_giuong)) {
                congSuatGiuongFormatted = parseFloat(row.cong_suat_su_dung_giuong).toFixed(2) + '%';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td class="hrl_name">${row.ten_khoa}</td>
                <td class="currency">${formatCurrency(row.phong_thuong)}</td>
                <td class="currency">${formatCurrency(row.phong_tyc)}</td>
                <td class="currency">${formatCurrency(row.tong_giuong)}</td>
                <td class="currency">${formatCurrency(row.so_luong_dang_dieu_tri)}</td>
                <td class="currency">${congSuatGiuongFormatted}</td>                                                    
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu từ API tính công suất giường:", error);
    }
}