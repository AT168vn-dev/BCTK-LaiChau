let zActionThem = false;
let zActionSua = false;

function zSuKienClickTable() {

    // Vô hiệu hóa các ô text
    document.getElementById('zMaNSD').disabled = true;
    document.getElementById('zTenNSD').disabled = true;
    document.getElementById('zMatKhau').disabled = true;
    document.getElementById('zCCHN').disabled = true;
    document.getElementById('zMaKhoa').disabled = true;
    document.getElementById('zSoDT').disabled = true;
    document.getElementById('showThongBao').textContent = ` `;

    // Vô hiệu hóa các nút
    document.getElementById('zButton_Them').disabled = false;
    document.getElementById('zButton_Sua').disabled = false;
    document.getElementById('zButton_Xoa').disabled = false;
    document.getElementById('zButton_Luu').disabled = true;
    document.getElementById('zButton_Huy').disabled = true;

    // Làm mờ các nút
    document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
    document.getElementById('zButton_Luu').style.opacity = '0.6';
    document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
    document.getElementById('zButton_Huy').style.opacity = '0.6';

    // Làm sáng các nút
    document.getElementById('zButton_Them').style.backgroundColor = 'blue';
    document.getElementById('zButton_Them').style.opacity = '1';
    document.getElementById('zButton_Sua').style.backgroundColor = 'blue';
    document.getElementById('zButton_Sua').style.opacity = '1';
    document.getElementById('zButton_Xoa').style.backgroundColor = 'blue';
    document.getElementById('zButton_Xoa').style.opacity = '1';
}

function zSuKienLoadTableTimKiem() {

    // Xóa trắng text
    document.getElementById('zMaNSD').value = '';
    document.getElementById('zTenNSD').value = '';
    document.getElementById('zMatKhau').value = '';
    document.getElementById('zCCHN').value = '';
    document.getElementById('zMaKhoa').value = '';
    document.getElementById('zSoDT').value = '';
    document.getElementById('showThongBao').textContent = ` `;

    // Vô hiểu hóa các text
    document.getElementById('zMaNSD').disabled = true;
    document.getElementById('zTenNSD').disabled = true;
    document.getElementById('zMatKhau').disabled = true;
    document.getElementById('zCCHN').disabled = true;
    document.getElementById('zMaKhoa').disabled = true;
    document.getElementById('zSoDT').disabled = true;

    // Làm sáng các nút
    document.getElementById('zButton_Them').style.backgroundColor = 'blue';
    document.getElementById('zButton_Them').style.opacity = '1';
    document.getElementById('zButton_Sua').style.backgroundColor = 'blue';
    document.getElementById('zButton_Sua').style.opacity = '1';
    document.getElementById('zButton_Xoa').style.backgroundColor = 'blue';
    document.getElementById('zButton_Xoa').style.opacity = '1';

    // Làm mờ các nút
    document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
    document.getElementById('zButton_Luu').style.opacity = '0.6';
    document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
    document.getElementById('zButton_Huy').style.opacity = '0.6';

    // Vô hiệu hóa các nút
    document.getElementById('zButton_Them').disabled = false;
    document.getElementById('zButton_Sua').disabled = false;
    document.getElementById('zButton_Xoa').disabled = false;
    document.getElementById('zButton_Luu').disabled = true;
    document.getElementById('zButton_Huy').disabled = true;
}

function zSuKienButtonThem() {
    zActionThem = true;
    zActionSua = false;

    // Xóa trắng các trường input
    document.getElementById('zMaNSD').value = '';
    document.getElementById('zTenNSD').value = '';
    document.getElementById('zMatKhau').value = '';
    document.getElementById('zCCHN').value = '';
    document.getElementById('zMaKhoa').value = '';
    document.getElementById('zSoDT').value = '';
    document.getElementById('showThongBao').textContent = ` `;

    // Kích hoạt các trường input
    document.getElementById('zMaNSD').disabled = false;
    document.getElementById('zTenNSD').disabled = false;
    document.getElementById('zMatKhau').disabled = false;
    document.getElementById('zCCHN').disabled = false;
    document.getElementById('zMaKhoa').disabled = false;
    document.getElementById('zSoDT').disabled = false;

    // vô hiệu hóa các button
    document.getElementById('zButton_Them').disabled = true;
    document.getElementById('zButton_Sua').disabled = true;
    document.getElementById('zButton_Xoa').disabled = true;
    document.getElementById('zButton_Luu').disabled = false;
    document.getElementById('zButton_Huy').disabled = false;

    // Làm mờ các nút
    document.getElementById('zButton_Them').style.backgroundColor = 'gray';
    document.getElementById('zButton_Them').style.opacity = '0.6';
    document.getElementById('zButton_Sua').style.backgroundColor = 'gray';
    document.getElementById('zButton_Sua').style.opacity = '0.6';
    document.getElementById('zButton_Xoa').style.backgroundColor = 'gray';
    document.getElementById('zButton_Xoa').style.opacity = '0.6';

    // Làm sáng các nút
    document.getElementById('zButton_Luu').style.backgroundColor = 'blue';
    document.getElementById('zButton_Luu').style.opacity = '1';
    document.getElementById('zButton_Huy').style.backgroundColor = 'blue';
    document.getElementById('zButton_Huy').style.opacity = '1';

    // Gọi API để tải danh sách khoa và hiển thị trong dropdown zMaKhoa


    // Đặt focus vào trường Mã NSD
    document.getElementById('zMaNSD').focus();
    loadThongTinComboboxKhoa();
}

function zSuKienButtonSua() {
    zActionThem = false;
    zActionSua = true;

    //2. Vô hiểu hóa các text
    document.getElementById('zMaNSD').disabled = true;
    document.getElementById('zTenNSD').disabled = false;
    document.getElementById('zMatKhau').disabled = false;
    document.getElementById('zCCHN').disabled = false;
    document.getElementById('zMaKhoa').disabled = false;
    document.getElementById('zSoDT').disabled = false;

    //3. Vô hiệu hóa các nút
    document.getElementById('zButton_Them').disabled = true;
    document.getElementById('zButton_Sua').disabled = true;
    document.getElementById('zButton_Xoa').disabled = true;

    //4. Làm mờ các nút
    document.getElementById('zButton_Them').style.backgroundColor = 'gray';
    document.getElementById('zButton_Them').style.opacity = '0.6';
    document.getElementById('zButton_Sua').style.backgroundColor = 'gray';
    document.getElementById('zButton_Sua').style.opacity = '0.6';
    document.getElementById('zButton_Xoa').style.backgroundColor = 'gray';
    document.getElementById('zButton_Xoa').style.opacity = '0.6';

    //5. Làm sáng các nút zButton_Luu, zButton_Huy
    document.getElementById('zButton_Luu').disabled = false;
    document.getElementById('zButton_Luu').style.backgroundColor = 'blue';
    document.getElementById('zButton_Luu').style.opacity = '1';

    document.getElementById('zButton_Huy').disabled = false;
    document.getElementById('zButton_Huy').style.backgroundColor = 'blue';
    document.getElementById('zButton_Huy').style.opacity = '1';

    //6. Forcus    
    const zBienTenNSD = document.getElementById('zTenNSD');
    zBienTenNSD.focus(); // Đưa con trỏ vào ô input
    zBienTenNSD.select(); // Bôi đen toàn bộ văn bản trong ô inp
}

function zSuKienButtonXoa() {

    const zMaNSD = document.getElementById('zMaNSD').value;

    if (!zMaNSD) {
        document.getElementById('showThongBao').textContent = `Bạn chưa người sử dụng cần xóa! `;
        return;
    }

    const modal = document.getElementById('confirmDeleteModal');
    modal.style.display = 'flex';

    // Xử lý khi nhấn nút "Yes"
    document.getElementById('confirmDeleteYes').onclick = function () {
        modal.style.display = 'none'; // Đóng modal sau khi xác nhận

        zButton_XoaNSD_Database(zMaNSD);

        //Xóa trắng text
        document.getElementById('zMaNSD').value = '';
        document.getElementById('zTenNSD').value = '';
        document.getElementById('zMatKhau').value = '';
        document.getElementById('zCCHN').value = '';
        document.getElementById('zMaKhoa').value = '';
        document.getElementById('zSoDT').value = '';

        //2. Vô hiểu hóa các text
        document.getElementById('zMaNSD').disabled = true;
        document.getElementById('zTenNSD').disabled = true;
        document.getElementById('zMatKhau').disabled = true;
        document.getElementById('zCCHN').disabled = true;
        document.getElementById('zMaKhoa').disabled = true;
        document.getElementById('zSoDT').disabled = true;

        //3. Vô hiệu hóa các nút
        document.getElementById('zButton_Them').disabled = false;
        document.getElementById('zButton_Sua').disabled = true;
        document.getElementById('zButton_Xoa').disabled = true;
        document.getElementById('zButton_Luu').disabled = true;
        document.getElementById('zButton_Huy').disabled = true;

        //4. Làm mờ các nút

        document.getElementById('zButton_Sua').style.backgroundColor = 'gray';
        document.getElementById('zButton_Sua').style.opacity = '0.6';
        document.getElementById('zButton_Xoa').style.backgroundColor = 'gray';
        document.getElementById('zButton_Xoa').style.opacity = '0.6';
        document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
        document.getElementById('zButton_Luu').style.opacity = '0.6';
        document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
        document.getElementById('zButton_Huy').style.opacity = '0.6';

        //5. Làm sáng các nút zButton_Luu, zButton_Huy
        document.getElementById('zButton_Them').disabled = false;
        document.getElementById('zButton_Them').style.backgroundColor = 'blue';
        document.getElementById('zButton_Them').style.opacity = '1';
    };

    // Xử lý khi nhấn nút "No"
    document.getElementById('confirmDeleteNo').onclick = function () {
        modal.style.display = 'none'; // Đóng modal khi người dùng hủy bỏ
    };

}

function zButton_XoaNSD_Database(zMaNSD) {
    fetch(`/dm-nguoisudung/delete/${zMaNSD}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                zXoaTrangNSD();
                document.getElementById('showThongBao').textContent = `Bạn đã xóa thành công!`;
                document.getElementById('showThongBao').style.color = '#28a745';
                fetch('/dm-nguoisudung-reload')
                    .then(response => response.json())
                    .then(users => {
                        const tableBody = document.getElementById('table-body');
                        tableBody.innerHTML = ''; // Clear the table

                        // Populate the table with new data
                        users.forEach(user => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                                <td>${user.ma_nsd || ''}</td>
                                                <td>${user.ho_ten || ''}</td>
                                                <td>${user.ma_khoa || ''}</td>
                                                <td>${user.chungchi_hanhnghe || ''}</td>
                                                <td>${user.sodt || ''}</td>
                                            `;
                            row.addEventListener('click', () => {
                                document.getElementById('zMaNSD').value = user.ma_nsd || '';
                                document.getElementById('zTenNSD').value = user.ho_ten || '';
                                document.getElementById('zMatKhau').value = user.mat_khau || '';
                                document.getElementById('zCCHN').value = user.chungchi_hanhnghe || '';
                                document.getElementById('zMaKhoa').value = user.ma_khoa || '';
                                document.getElementById('zSoDT').value = user.sodt || '';

                                zSuKienClickTable();
                            });

                            tableBody.appendChild(row);
                        });
                    })
                    .catch(error => console.error('Error fetching user list:', error));
            } else {
                document.getElementById('showThongBao').textContent = `Lỗi khi xóa tài khoản: ${data.message}`;
                document.getElementById('showThongBao').style.color = 'red';
            }
        })
        .catch(error => {
            document.getElementById('showThongBao').textContent = `Lỗi không thể xóa tài khoản! `;
            document.getElementById('showThongBao').style.color = 'red';
        });
}

function zSuKienButtonLuu() {
    const zMaNSD = document.getElementById('zMaNSD').value.trim();
    const zTenNSD = document.getElementById('zTenNSD').value.trim();
    const zMatKhau = document.getElementById('zMatKhau').value.trim();
    const zCCHN = document.getElementById('zCCHN').value.trim();
    const zMaKhoa = document.getElementById('zMaKhoa').value.split(' - ')[0].trim();
    const zSoDT = document.getElementById('zSoDT').value.trim();

    // Check for required fields
    if (!zMaNSD) {
        document.getElementById('showThongBao').textContent = `Mã người sử dụng không được để trống!`;
        document.getElementById('showThongBao').style.color = 'red';
        document.getElementById('zMaNSD').focus();
        return;
    }

    if (!zTenNSD) {
        document.getElementById('showThongBao').textContent = `Tên người sử dụng không được để trống!`;
        document.getElementById('showThongBao').style.color = 'red';
        document.getElementById('zTenNSD').focus();
        return;
    }

    if (!zMaKhoa) {
        document.getElementById('showThongBao').textContent = `Bạn chưa chọn khoa phòng!`;
        document.getElementById('showThongBao').style.color = 'red';
        document.getElementById('zMaKhoa').focus();
        return;
    }

    // Check if adding a new user
    if (zActionThem) {
        // Step 1: Check if `zMaNSD` already exists in the database
        fetch(`/dm-nguoisudung/check/${zMaNSD}`)
            .then(response => response.json())
            .then(data => {
                if (data.exists) {
                    // User already exists
                    document.getElementById('showThongBao').textContent = `Tài khoản đã tồn tại! Vui lòng chọn lại mã NSD khác.`;
                    document.getElementById('showThongBao').style.color = 'red';
                    document.getElementById('zMaNSD').focus();
                } else {
                    // Step 2: Add new user to the database
                    fetch('/dm-nguoisudung/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ma_nsd: zMaNSD,
                            ho_ten: zTenNSD,
                            mat_khau: zMatKhau,
                            cchn: zCCHN,
                            ma_khoa: zMaKhoa,
                            sodt: zSoDT,
                        })
                    })
                        .then(response => response.json())
                        .then(result => {
                            if (result.success) {
                                document.getElementById('showThongBao').textContent = 'Thêm người sử dụng thành công!';
                                document.getElementById('showThongBao').style.color = 'green';
                                zLoadAllThanhCong();

                                // Step 3: Fetch and refresh the user list
                                fetch('/dm-nguoisudung-reload')
                                    .then(response => response.json())
                                    .then(users => {
                                        const tableBody = document.getElementById('table-body');
                                        tableBody.innerHTML = ''; // Clear the table

                                        // Populate the table with new data
                                        users.forEach(user => {
                                            const row = document.createElement('tr');
                                            row.innerHTML = `
                                                <td>${user.ma_nsd || ''}</td>
                                                <td>${user.ho_ten || ''}</td>
                                                <td>${user.ma_khoa || ''}</td>
                                                <td>${user.chungchi_hanhnghe || ''}</td>
                                                <td>${user.sodt || ''}</td>
                                            `;
                                            row.addEventListener('click', () => {
                                                document.getElementById('zMaNSD').value = user.ma_nsd || '';
                                                document.getElementById('zTenNSD').value = user.ho_ten || '';
                                                document.getElementById('zMatKhau').value = user.mat_khau || '';
                                                document.getElementById('zCCHN').value = user.chungchi_hanhnghe || '';
                                                document.getElementById('zMaKhoa').value = user.ma_khoa || '';
                                                document.getElementById('zSoDT').value = user.sodt || '';

                                                zSuKienClickTable();
                                            });

                                            tableBody.appendChild(row);
                                        });
                                    })
                                    .catch(error => console.error('Error fetching user list:', error));
                            } else {
                                document.getElementById('showThongBao').textContent = result.message;
                                document.getElementById('showThongBao').style.color = 'red';
                            }
                        })
                        .catch(error => {
                            document.getElementById('showThongBao').textContent = 'Lỗi khi kết nối với server!';
                            document.getElementById('showThongBao').style.color = 'red';
                        });
                }
            })
            .catch(error => {
                console.error('Error checking user existence:', error);
                document.getElementById('showThongBao').textContent = 'Lỗi khi kiểm tra tài khoản!';
                document.getElementById('showThongBao').style.color = 'red';
            });
    }

    if (zActionSua) {
        fetch(`/dm-nguoisudung/update/${zMaNSD}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ho_ten: zTenNSD,
                sodt: zSoDT,
                mat_khau: zMatKhau,
                ma_khoa: zMaKhoa,
                cchn: zCCHN,
            })
        })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    document.getElementById('showThongBao').textContent = 'Cập nhật người sử dụng thành công!';
                    document.getElementById('showThongBao').style.color = 'green';
                    zLoadAllThanhCong();

                    fetch('/dm-nguoisudung-reload')
                        .then(response => response.json())
                        .then(users => {
                            const tableBody = document.getElementById('table-body');
                            tableBody.innerHTML = ''; // Clear the table

                            // Populate the table with new data
                            users.forEach(user => {
                                const row = document.createElement('tr');
                                row.innerHTML = `
                                                <td>${user.ma_nsd || ''}</td>
                                                <td>${user.ho_ten || ''}</td>
                                                <td>${user.ma_khoa || ''}</td>
                                                <td>${user.chungchi_hanhnghe || ''}</td>
                                                <td>${user.sodt || ''}</td>
                                            `;
                                row.addEventListener('click', () => {
                                    document.getElementById('zMaNSD').value = user.ma_nsd || '';
                                    document.getElementById('zTenNSD').value = user.ho_ten || '';
                                    document.getElementById('zMatKhau').value = user.mat_khau || '';
                                    document.getElementById('zCCHN').value = user.chungchi_hanhnghe || '';
                                    document.getElementById('zMaKhoa').value = user.ma_khoa || '';
                                    document.getElementById('zSoDT').value = user.sodt || '';

                                    zSuKienClickTable();
                                });

                                tableBody.appendChild(row);
                            });
                        })
                        .catch(error => console.error('Error fetching user list:', error));
                } else {
                    document.getElementById('showThongBao').textContent = 'Lỗi khi cập nhật người sử dụng!';
                    document.getElementById('showThongBao').style.color = 'red';
                }
            })
            .catch(error => {
                document.getElementById('showThongBao').textContent = 'Lỗi khi kết nối với server!';
                document.getElementById('showThongBao').style.color = 'red';
            });
    }
}

function hamVietHoaChuDauTien(str) {
    return str.toLowerCase().replace(/\b\w/g, function (char) {
        return char.toUpperCase();
    });
}

function zSuKienButtonHuy() {
    if (zActionThem) {
        //1. Xóa trắng text
        document.getElementById('zMaNSD').value = '';
        document.getElementById('zTenNSD').value = '';
        document.getElementById('zMatKhau').value = '';
        document.getElementById('zCCHN').value = '';
        document.getElementById('zMaKhoa').value = '';
        document.getElementById('zSoDT').value = '';
        document.getElementById('showThongBao').textContent = ` `;

        //2. Vô hiểu hóa các text
        document.getElementById('zMaNSD').disabled = true;
        document.getElementById('zTenNSD').disabled = true;
        document.getElementById('zMatKhau').disabled = true;
        document.getElementById('zCCHN').disabled = true;
        document.getElementById('zMaKhoa').disabled = true;
        document.getElementById('zSoDT').disabled = true;

        //3. Vô hiệu hóa các nút
        document.getElementById('zButton_Them').disabled = false;
        document.getElementById('zButton_Sua').disabled = true;
        document.getElementById('zButton_Xoa').disabled = true;
        document.getElementById('zButton_Luu').disabled = true;
        document.getElementById('zButton_Huy').disabled = true;

        // Làm sáng nút Thêm và vô hiệu hóa các nút khác
        document.getElementById('zButton_Them').disabled = false;
        document.getElementById('zButton_Them').style.backgroundColor = 'blue';
        document.getElementById('zButton_Them').style.opacity = '1';

        // Làm mờ các nút Button
        document.getElementById('zButton_Sua').disabled = true;
        document.getElementById('zButton_Sua').style.backgroundColor = 'gray';
        document.getElementById('zButton_Sua').style.opacity = '0.6';

        document.getElementById('zButton_Xoa').disabled = true;
        document.getElementById('zButton_Xoa').style.backgroundColor = 'gray';
        document.getElementById('zButton_Xoa').style.opacity = '0.6';

        document.getElementById('zButton_Luu').disabled = true;
        document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
        document.getElementById('zButton_Luu').style.opacity = '0.6';

        document.getElementById('zButton_Huy').disabled = true;
        document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
        document.getElementById('zButton_Huy').style.opacity = '0.6';

        zActionThem = false;

    } else if (zActionSua) {
        // Làm mờ các nút
        document.getElementById('zButton_Luu').disabled = true;
        document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
        document.getElementById('zButton_Luu').style.opacity = '0.6';

        document.getElementById('zButton_Huy').disabled = true;
        document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
        document.getElementById('zButton_Huy').style.opacity = '0.6';

        //Làm sáng các nút 
        document.getElementById('zButton_Them').disabled = false;
        document.getElementById('zButton_Them').style.backgroundColor = 'blue';
        document.getElementById('zButton_Them').style.opacity = '1';

        document.getElementById('zButton_Sua').disabled = false;
        document.getElementById('zButton_Sua').style.backgroundColor = 'blue';
        document.getElementById('zButton_Sua').style.opacity = '1';

        document.getElementById('zButton_Xoa').disabled = false;
        document.getElementById('zButton_Xoa').style.backgroundColor = 'blue';
        document.getElementById('zButton_Xoa').style.opacity = '1';

        // Vô hiểu hóa các text
        document.getElementById('zMaNSD').disabled = true;
        document.getElementById('zTenNSD').disabled = true;
        document.getElementById('zMatKhau').disabled = true;
        document.getElementById('zCCHN').disabled = true;
        document.getElementById('zMaKhoa').disabled = true;
        document.getElementById('zSoDT').disabled = true;

        const zMaNSD = document.getElementById('zMaNSD').value;

        if (zMaNSD) {
            // Fetch data for this specific folder from the server
            fetch(`/get-nguoisudung/${zMaNSD}`)
                .then(response => response.json())
                .then(data => {
                    if (data) {
                        // Reset the zdmlvb_ten based on fetched data
                        document.getElementById('zTenNSD').value = data.ho_ten;
                        document.getElementById('zMatKhau').value = data.mat_khau;
                        document.getElementById('zCCHN').value = data.chungchi_hanhnghe;
                        document.getElementById('zMaKhoa').value = data.ma_khoa;
                        document.getElementById('zSoDT').value = data.sodt;
                        document.getElementById('showThongBao').textContent = ` `;
                    } else {
                        console.error('Không có dữ liệu');
                    }
                })
                .catch(error => console.error('Lỗi kết nối CSDL:', error));
        }

        zActionSua = false;
    }
}

//Tìm kiếm mã theo khoa combobox
function loadThongTinComboboxKhoa() {
    fetch('/dm-khoa')
        .then(response => response.json())  // Chuyển đổi phản hồi thành JSON
        .then(result => {

            if (result.success) {  // Kiểm tra nếu `success` là true
                const dataList = document.createElement('datalist');
                dataList.id = 'load-khoa';  // Đặt ID cho datalist

                // Truy cập đúng vào `result.data` là mảng
                result.data.forEach(row => {
                    const option = document.createElement('option');
                    option.value = row.sd_id + ' - ' + row.sd_name;  // Đặt giá trị mã khoa và tên khoa
                    dataList.appendChild(option);  // Thêm option vào datalist
                });

                // Gắn datalist vào body hoặc phần tử nào đó
                document.body.appendChild(dataList);
            } else {
                console.error('Không thành công khi tải danh sách khoa');
            }
        })
        .catch(error => {
            console.error('Lỗi khi tải danh sách khoa:', error);
            document.getElementById('showThongBao').textContent = 'Lỗi khi tải danh sách khoa!';
        });
}

function zLoadAllThanhCong() {
    // Làm mờ các nút
    document.getElementById('zButton_Luu').disabled = true;
    document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
    document.getElementById('zButton_Luu').style.opacity = '0.6';

    document.getElementById('zButton_Huy').disabled = true;
    document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
    document.getElementById('zButton_Huy').style.opacity = '0.6';

    //Làm sáng các nút 
    document.getElementById('zButton_Them').disabled = false;
    document.getElementById('zButton_Them').style.backgroundColor = 'blue';
    document.getElementById('zButton_Them').style.opacity = '1';

    document.getElementById('zButton_Sua').disabled = false;
    document.getElementById('zButton_Sua').style.backgroundColor = 'blue';
    document.getElementById('zButton_Sua').style.opacity = '1';

    document.getElementById('zButton_Xoa').disabled = false;
    document.getElementById('zButton_Xoa').style.backgroundColor = 'blue';
    document.getElementById('zButton_Xoa').style.opacity = '1';

    // Vô hiểu hóa các text
    document.getElementById('zMaNSD').disabled = true;
    document.getElementById('zTenNSD').disabled = true;
    document.getElementById('zMatKhau').disabled = true;
    document.getElementById('zCCHN').disabled = true;
    document.getElementById('zMaKhoa').disabled = true;
    document.getElementById('zSoDT').disabled = true;

    document.getElementById('tim-kiem-nsd').value = '';
}

function zXoaTrangNSD() {
    document.getElementById('zMaNSD').value = '';
    document.getElementById('zTenNSD').value = '';
    document.getElementById('zMatKhau').value = '';
    document.getElementById('zCCHN').value = '';
    document.getElementById('zMaKhoa').value = '';
    document.getElementById('zSoDT').value = '';
    document.getElementById('showThongBao').textContent = ` `;
    document.getElementById('tim-kiem-nsd').value = '';

    //2. Vô hiểu hóa các text
    document.getElementById('zMaNSD').disabled = true;
    document.getElementById('zTenNSD').disabled = true;
    document.getElementById('zMatKhau').disabled = true;
    document.getElementById('zCCHN').disabled = true;
    document.getElementById('zMaKhoa').disabled = true;
    document.getElementById('zSoDT').disabled = true;

    //3. Vô hiệu hóa các nút
    document.getElementById('zButton_Them').disabled = false;
    document.getElementById('zButton_Sua').disabled = true;
    document.getElementById('zButton_Xoa').disabled = true;
    document.getElementById('zButton_Luu').disabled = true;
    document.getElementById('zButton_Huy').disabled = true;

    // Làm sáng nút Thêm và vô hiệu hóa các nút khác
    document.getElementById('zButton_Them').disabled = false;
    document.getElementById('zButton_Them').style.backgroundColor = 'blue';
    document.getElementById('zButton_Them').style.opacity = '1';

    // Làm mờ các nút Button
    document.getElementById('zButton_Sua').disabled = true;
    document.getElementById('zButton_Sua').style.backgroundColor = 'gray';
    document.getElementById('zButton_Sua').style.opacity = '0.6';

    document.getElementById('zButton_Xoa').disabled = true;
    document.getElementById('zButton_Xoa').style.backgroundColor = 'gray';
    document.getElementById('zButton_Xoa').style.opacity = '0.6';

    document.getElementById('zButton_Luu').disabled = true;
    document.getElementById('zButton_Luu').style.backgroundColor = 'gray';
    document.getElementById('zButton_Luu').style.opacity = '0.6';

    document.getElementById('zButton_Huy').disabled = true;
    document.getElementById('zButton_Huy').style.backgroundColor = 'gray';
    document.getElementById('zButton_Huy').style.opacity = '0.6';
}