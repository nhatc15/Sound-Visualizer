# Sound Visualizer

Ứng dụng Windows trực quan hoá **âm thanh máy đang phát** (Spotify, YouTube, game, bất kỳ nguồn nào) với 16 hiệu ứng neon.

## Chạy

```bash
npm install
npm start
```

App tự bắt âm thanh ngay khi mở — không cần bấm gì, không có hộp thoại xin quyền.

## Gửi cho người khác dùng

```bash
npm run build            # tạo cả 2 file dưới đây trong dist/
```

| File | Dành cho |
|---|---|
| `Sound Visualizer 1.0.0 Setup.exe` | Người dùng thường. Cài đặt bình thường, tự tạo shortcut Desktop + Start Menu, gỡ được qua Settings → Apps. |
| `Sound Visualizer 1.0.0 Portable.exe` | Chạy thẳng, không cài. Tiện để cắm USB hoặc thử nhanh. |

Cài theo từng user (`%LOCALAPPDATA%`), **không cần quyền admin**.

**Lần đầu mở, Windows sẽ hiện cảnh báo SmartScreen** ("Windows protected your PC") vì file chưa được ký số. Bấm *More info → Run anyway*. Muốn hết cảnh báo phải mua code-signing certificate (~vài triệu/năm) — không bắt buộc để app chạy.

Icon nằm ở `build/icon.ico` (7 kích thước 16–256px). Muốn đổi thì thay file đó rồi build lại.

## Điều khiển

| Thao tác | Phím / Nút |
|---|---|
| Đổi hiệu ứng | `←` `→` hoặc nút ◀ ▶ |
| Nhảy tới hiệu ứng 1–9 | phím số `1`–`9` |
| Toàn màn hình (cả khi đang ở overlay) | `F11` |
| Bật/tắt overlay nổi | `Ctrl+O` hoặc nút **Overlay** |
| Thoát overlay **từ bất kỳ đâu** (toàn cục) | `Alt+Shift+O` |
| Ẩn/hiện app (toàn cục) | `Alt+Shift+V` |
| Tự đổi hiệu ứng mỗi 20s | checkbox **Tự đổi** |
| Đổi số hiệu ứng hiện cùng lúc | `G` hoặc dropdown bên phải nút ▶ |

**Chế độ overlay**: không viền, nền trong suốt, luôn nổi trên cùng. Kéo bất kỳ đâu để di chuyển.

Thanh nút nằm ở **góc trên bên phải**: đổi hiệu ứng, toàn màn hình, nút **Cửa sổ** (về cửa sổ thường) và đóng. Thanh này **tự hiện 5 giây khi mới vào overlay** rồi mờ đi — rê chuột vào overlay là hiện lại.

Nếu lỡ mất dấu thanh đó: `Alt+Shift+O` thoát overlay từ bất kỳ đâu, kể cả khi bạn đang làm việc ở app khác. Phím này là toàn cục nên không cần overlay đang được focus — `Ctrl+O` chỉ chạy khi cửa sổ overlay đang nhận bàn phím, mà một widget luôn-nổi-trên-cùng thì thường không.

**Toàn màn hình**: `F11`, hoặc nút ⛶ trên thanh overlay để đi thẳng một bước không qua cửa sổ thường. Thanh tiêu đề ẩn hẳn, còn **thanh điều khiển dưới đáy trôi lên trên hình và tự ẩn sau 2,5 giây** — động chuột là nó hiện lại, và nó ở nguyên đó khi con trỏ đang trên thanh. Nút toàn màn hình đổi chữ theo trạng thái: *Toàn màn hình* ↔ *Thoát toàn màn hình*.

## Xem nhiều hiệu ứng cùng lúc

Dropdown thứ hai ở thanh dưới chọn số ô: **1 / 2 / 4 / 6 / 9 hiệu ứng**. Mỗi ô một hiệu ứng khác nhau, tất cả chạy thật cùng lúc trên cùng luồng âm thanh, có nhãn tên ở góc.

**Chọn hiệu ứng cho từng ô**: bấm thẳng vào ô trên màn hình, hoặc dùng dropdown `Ô 1..N`. Ô đang chỉnh có viền tím; viền **tự mờ dần rồi tắt sau 3 giây** để không che hình, và hiện lại ngay khi bạn chọn ô hoặc đổi hiệu ứng. Dropdown hiệu ứng và `←` `→` chỉ tác động lên ô đó, nên bạn ghép được bộ tuỳ ý.

Phím `G` xoay vòng các kiểu lưới — tiện khi ở overlay vì lúc đó không có dropdown. Bật **Tự đổi** thì mọi ô cùng dịch sang hiệu ứng kế tiếp mỗi 20 giây.

Chế độ lưới hoạt động cả ở cửa sổ thường, toàn màn hình lẫn overlay trong suốt.

## 16 hiệu ứng

| # | Tên | # | Tên | # | Tên |
|---|---|---|---|---|---|
| 1 | Neon Wave | 6 | Envelope | 11 | Sine Ribbon |
| 2 | Block EQ | 7 | Slider Mixer | 12 | Dual Mirror |
| 3 | Dotted Mirror | 8 | Outline Bars | 13 | Smooth Hills |
| 4 | Flow Lines | 9 | Gradient Peaks | 14 | Spike Wave |
| 5 | Thin Bars | 10 | Dot Matrix | 15 | Layered Spectrum |
| | | | | 16 | Tacet Mark |

Hiệu ứng 16 (**Tacet Mark**) đi ngược phần còn lại: nền giấy trắng, hình mực đen phẳng. Nó tô nền riêng cho ô của mình nên trong chế độ lưới không ảnh hưởng các ô khác.

## Cách hoạt động

Windows không cho app đọc thẳng âm thanh hệ thống. App dùng **WASAPI loopback** qua Electron: main process trả lời `getDisplayMedia()` bằng `audio: 'loopback'`, cho ra `MediaStream` chứa đúng những gì loa đang phát. Luồng video đi kèm (Electron bắt buộc) bị huỷ ngay, không có màn hình nào bị ghi lại.

Luồng âm thanh đi qua `AnalyserNode` (FFT 4096), rồi được ánh xạ sang các dải **log-spaced** — nếu dùng thẳng bin FFT tuyến tính thì toàn bộ năng lượng sẽ dồn về mép trái và các preset trông chết cứng.

## Cấu trúc

```
src/
  main/
    main.js              # vòng đời app, IPC, phím tắt toàn cục
    window-manager.js    # cửa sổ thường <-> overlay (dựng lại window)
    loopback-audio.js    # handler trả về stream loopback
  preload/preload.js     # cầu IPC (contextIsolation)
  renderer/
    app.js               # điều phối: audio -> phân tích -> vẽ
    audio/
      audio-engine.js       # lấy stream, AnalyserNode
      spectrum-analyzer.js  # dải log, smoothing, trigger, lịch sử biên độ
    visuals/
      registry.js           # 16 preset + các kiểu lưới
      canvas-renderer.js    # canvas, DPR, vẽ lưới nhiều ô
      draw-utils.js         # palette, gradient, glow
      *-presets.js          # cài đặt từng nhóm hiệu ứng
    ui/controls.js       # nút, dropdown, phím tắt
```

## Lưu ý

- App **không** phát lại âm thanh, chỉ đọc. `AnalyserNode` cố ý không nối vào `destination` để tránh vòng lặp phản hồi.
- Nếu không có gì đang phát, app hiện "Chưa có âm thanh nào đang phát" — không phải lỗi.

## Tự phục hồi luồng âm thanh

Windows có thể cắt luồng loopback mà không báo gì: đổi thiết bị phát mặc định, hoặc dừng nhạc đủ lâu để endpoint ngủ. Khi đó luồng vẫn báo `live` nhưng không còn mẫu nào chảy về, nên trước đây app đứng im cho tới khi mở lại.

App tự dựng lại luồng ở ba trường hợp:

| Dấu hiệu | Phản ứng |
|---|---|
| Sự kiện `devicechange` (đổi/cắm/rút thiết bị phát) | Dựng lại sau 0,7s — gộp chùm sự kiện thành một lần |
| Track báo `ended` hoặc `muted` | Dựng lại ngay |
| Im lặng tuyệt đối (mọi bin FFT = 0) quá 8 giây | Dựng lại, rồi nghỉ 30 giây trước khi thử tiếp |

Trường hợp thứ ba không phân biệt được "luồng chết" với "máy đang im thật" — nhìn từ `AnalyserNode` cả hai giống hệt nhau. Nên nó cố ý chậm và có thời gian nghỉ: nếu máy đang im thật, việc dựng lại thừa không gây ra hiệu ứng gì người dùng thấy được (app không phát âm thanh, không xin quyền).

Tần số lấy mẫu có thể khác nhau giữa các thiết bị phát, nên bản đồ dải log được tính lại sau mỗi lần dựng.
