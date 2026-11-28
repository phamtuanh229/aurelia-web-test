/* =====================================================================
   CÀI ĐẶT CỦA AURELIA DRESS UP  (file này là nơi DUY NHẤT cần sửa khi đổi thông tin)
   Chỉ sửa phần nằm giữa hai dấu nháy ' '. Đừng xoá dấu nháy hay dấu phẩy.
   ===================================================================== */
window.AURELIA_CONFIG = {
  tenCuaHang: 'Aurelia Dress Up',

  // ---- Liên hệ ----
  hotline: '0888691022',                       // cũng là số Zalo
  diaChi: 'Ngõ 74 Nguyễn Văn Tuyết, Phường Đống Đa, Hà Nội',
  chiDuong: 'Đi vào ngõ khoảng 20m, rẽ trái ở ngã rẽ đầu tiên',
  gioMoCua: '',                                // ví dụ '9:00 - 21:00 hằng ngày'
  mapLink: 'https://maps.app.goo.gl/g6nAidRnfJN35itUA',
  facebook: 'https://www.facebook.com/profile.php?id=61567888372095',
  messenger: 'https://m.me/61567888372095',

  // ---- Nơi lấy dữ liệu: MỘT file Google Sheets ----
  // sheetId = đoạn mã dài nằm giữa /d/ và /edit trong link Google Sheets.
  // Để trống = web dùng dữ liệu mẫu trong thư mục data/.
  sheetId: '',

  // Tên các tab trong file Google Sheets. Tab nào chưa có thì để trống '' (web dùng dữ liệu mẫu).
  tab: {
    sanPham: 'SanPham',     // danh sách váy, áo dài...
    phuKien: 'PhuKien',     // phụ kiện
    anh: '',                // ảnh từng mã (Mã | Link ảnh)
    lich: 'Lich',           // lịch đã có người thuê
    feedback: ''            // phản hồi của khách
  },

  // Mã váy lấy ảnh làm ô danh mục ở trang chủ (đổi mã là đổi ảnh)
  anhMenu: { 'vay-dai': 'VD0003', 'vay-ngan': 'VN0009', 'ao-dai-yem': 'AD0006', 'ao-khoac': 'AK0004', 'trang-suc': 'KT0009' },

  anHang: [],

  // Số đo 3 vòng ước tính theo size chữ (dùng khi váy chưa ghi số đo). Dạng [min, max] cm.
  // CỬA HÀNG HÃY KIỂM TRA LẠI BẢNG NÀY CHO ĐÚNG VỚI VÁY CỦA MÌNH.
  bangSize: {}
};
