'use strict';

/**
 * Vietnamese strings. Keys are shared with every other locale file; `i18n.js`
 * falls back to this table when another locale is missing one, so this file is
 * the one that must stay complete.
 */
export const vi = {
  'titlebar.minimize': 'Thu nhỏ',
  'titlebar.close': 'Đóng',

  'splash.tagline': 'Hiệu ứng theo âm thanh hệ thống, theo thời gian thực',

  'language.title': 'Ngôn ngữ',
  'language.subtitle': 'Chọn ngôn ngữ hiển thị. Đổi lại bất cứ lúc nào trong Cài đặt.',

  'home.subtitle': '16 hiệu ứng neon chạy theo đúng thứ máy bạn đang phát.',
  'home.start': 'Bắt đầu',
  'home.settings': 'Cài đặt',
  'home.quit': 'Thoát',
  'home.hint': 'Đang xem hiệu ứng? Bấm <kbd>Esc</kbd> để về đây bất cứ lúc nào.',

  'settings.title': 'Cài đặt',
  'settings.done': 'Xong',
  'settings.back': 'Quay lại (Esc)',
  'settings.reset': 'Đặt lại mặc định',

  'error.title': 'Không bắt được âm thanh',
  'error.retry': 'Thử lại',
  'error.denied':
    'Bạn đã từ chối quyền chia sẻ. Bấm "Thử lại" và chấp nhận để app đọc được âm thanh hệ thống.',
  'error.noStream':
    'Không nhận được luồng âm thanh hệ thống. Kiểm tra thiết bị phát mặc định trong Windows rồi thử lại.',
  'error.generic': 'Lỗi khi khởi tạo âm thanh: {message}',
  'silence.hint': 'Chưa có âm thanh nào đang phát',

  'controls.home': 'Về trang chủ',
  'controls.homeTitle': 'Về trang chủ (Esc)',
  'controls.prev': 'Hiệu ứng trước',
  'controls.prevTitle': 'Hiệu ứng trước (←)',
  'controls.next': 'Hiệu ứng sau',
  'controls.nextTitle': 'Hiệu ứng sau (→)',
  'controls.presetSelect': 'Chọn hiệu ứng',
  'controls.layoutSelect': 'Số hiệu ứng hiển thị cùng lúc',
  'controls.layoutSelectTitle': 'Số hiệu ứng hiển thị cùng lúc (G)',
  'controls.cellSelect': 'Chọn ô để đổi hiệu ứng',
  'controls.cellSelectTitle': 'Ô đang chỉnh — hoặc bấm thẳng vào ô trên màn hình',
  'controls.cell': 'Ô {n}',
  'controls.auto': 'Tự đổi',
  'controls.settings': 'Cài đặt',
  'controls.overlay': 'Overlay',
  'controls.overlayTitle': 'Chế độ overlay nổi (Ctrl+O)',
  'controls.fullscreen': 'Toàn màn hình',
  'controls.fullscreenTitle': 'Toàn màn hình (F11)',
  'controls.exitFullscreen': 'Thoát toàn màn hình',
  'controls.exitFullscreenTitle': 'Thoát toàn màn hình (F11)',

  'overlay.prev': 'Hiệu ứng trước',
  'overlay.next': 'Hiệu ứng sau',
  'overlay.fullscreen': 'Toàn màn hình (F11)',
  'overlay.window': 'Cửa sổ',
  'overlay.windowTitle': 'Về cửa sổ thường (Ctrl+O hoặc Alt+Shift+O)',
  'overlay.close': 'Đóng',

  'layout.single': '1 hiệu ứng',
  'layout.duo': '2 hiệu ứng',
  'layout.quad': '4 hiệu ứng',
  'layout.six': '6 hiệu ứng',
  'layout.nine': '9 hiệu ứng',

  'settings.group.language': 'Ngôn ngữ',
  'settings.group.display': 'Hiển thị',
  'settings.group.audio': 'Âm thanh',
  'settings.group.startup': 'Khởi động',

  'settings.language.label': 'Ngôn ngữ hiển thị',
  'settings.language.hint': 'Áp dụng ngay, không cần mở lại app.',
  'settings.layout.label': 'Bố cục lưới',
  'settings.layout.hint': 'Số hiệu ứng vẽ cùng lúc.',
  'settings.autoCycle.label': 'Tự đổi hiệu ứng',
  'settings.autoCycle.hint': 'Luân phiên sang hiệu ứng kế tiếp sau mỗi chu kỳ.',
  'settings.autoCycleSeconds.label': 'Chu kỳ tự đổi',
  'settings.sensitivity.label': 'Độ nhạy',
  'settings.sensitivity.hint': 'Tăng khi nhạc nhỏ mà hiệu ứng vẫn lẹt đẹt.',
  'settings.smoothing.label': 'Độ mượt',
  'settings.smoothing.hint': 'Cao thì êm nhưng chậm phản ứng, thấp thì nảy và giật.',
  'settings.showSplash.label': 'Hiện màn hình chào',
  'settings.startInVisualizer.label': 'Mở thẳng vào hiệu ứng',
  'settings.startInVisualizer.hint': 'Bỏ qua trang chủ khi mở app.',
  'settings.unit.seconds': 'giây',
};
