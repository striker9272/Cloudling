//! Desktop integration for Cloudling (Windows, Linux, macOS).
//!
//! This is the quarantine crate for the small amount of unavoidable Windows FFI
//! `unsafe` needed by the Windows tray icon, console-window handling, and
//! registry autostart. The rest of the workspace keeps the upstream
//! `unsafe_code = "forbid"`; only this crate permits `unsafe`, and every block
//! carries a `// SAFETY:` note. The Linux path uses no `unsafe` at all.
//!
//! The `tray` role runs the server + built-in web UI in the background and shows
//! a tray icon with a menu (Open / Start at login / Uninstall / Quit). The
//! `uninstall` role removes the optional autostart entry and, after
//! confirmation, the per-user data directories.
//!
//! The crate is decoupled from the rest of Cloudling: the caller passes a `serve`
//! closure (which starts the HTTP server) and the list of `data_dirs` to remove
//! on uninstall. Platform glue is gated by `cfg`:
//! - **Windows** — `tray-icon`/`windows-sys`: hidden-console relaunch, win32
//!   message-loop tray, `HKCU\...\Run` autostart.
//! - **Linux** — `ksni` (pure-Rust StatusNotifierItem over D-Bus, no gtk): SNI
//!   tray, `~/.config/autostart` autostart, `xdg-open` for the browser. Keeps
//!   the static musl binary dependency-free.
//! - **macOS** — `tray-icon` again (Cocoa/objc2, not gtk), driven by a minimal
//!   `NSApplication` run loop on the main thread; `~/Library/LaunchAgents`
//!   autostart, `open` for the browser. The bootstrap uses no `unsafe`.
//! - **Other (FreeBSD, …)** — the public API exists but returns a clear
//!   "not available on this platform" error, so the workspace still builds.

/// Run the desktop tray: start `serve` in the background and show the tray icon
/// + menu. `bind` builds the browser URL for the "Open" item. Implemented on
/// Windows, Linux, and macOS; a no-op error elsewhere.
#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub fn run_tray<F>(_bind: String, _serve: F) -> Result<(), Box<dyn std::error::Error>>
where
    F: FnOnce() -> Result<(), String> + Send + 'static,
{
    Err("`cloudling tray` is only available on Windows, Linux, and macOS".into())
}

/// Remove the autostart entry and (after confirmation, unless `assume_yes`) each
/// of the per-user `data_dirs`. Implemented on Windows, Linux, and macOS.
#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub fn run_uninstall(
    _data_dirs: Vec<std::path::PathBuf>,
    _assume_yes: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    Err("`cloudling uninstall` is only available on Windows, Linux, and macOS".into())
}

/// Whether the executable was started by a bare double-click (its own fresh
/// console) rather than from an existing terminal. Always false off Windows.
#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub fn launched_by_double_click() -> bool {
    false
}

#[cfg(windows)]
pub use imp::{launched_by_double_click, run_tray, run_uninstall};

#[cfg(target_os = "linux")]
pub use linux_imp::{launched_by_double_click, run_tray, run_uninstall};

#[cfg(target_os = "macos")]
pub use macos_imp::{launched_by_double_click, run_tray, run_uninstall};

/// Procedurally rendered Cloudling tray icon, shared by the Windows, Linux, and
/// macOS trays so the mark is identical and no asset file needs shipping/embedding.
/// Windows/Linux use the full coloured tile (`cloud_icon_rgba`); macOS uses a
/// monochrome silhouette (`cloud_template_rgba`) it renders as an NSImage template
/// so the menu bar tints it for light/dark themes.
#[cfg(any(windows, target_os = "linux", target_os = "macos"))]
mod icon {
    /// A dark rounded tile (the UI background `--bg` #0d0d0f) with the in-app
    /// cloud mark on top (union of four circles on a 40x28 viewBox, color
    /// `--load` #e9ebef), anti-aliased via 4x4 supersampling onto a 32x32 canvas.
    /// The dark tile keeps the light cloud readable on any panel/taskbar theme.
    /// Returns `(width, height, rgba)` with 8-bit RGBA pixels.
    #[cfg(any(windows, target_os = "linux"))]
    pub(crate) fn cloud_icon_rgba() -> (u32, u32, Vec<u8>) {
        const SIZE: usize = 32;
        const SS: usize = 4; // supersamples per axis
        const N: u32 = (SS * SS) as u32;

        // Cloud circles in the UI viewBox (40 wide x 28 tall): center + left +
        // right + top lobe (see static/index.html `.cloud`).
        let circles = [
            (20.0_f32, 14.0_f32, 6.0_f32),
            (14.0, 15.0, 5.0),
            (26.0, 15.0, 5.0),
            (20.0, 11.0, 5.0),
        ];
        let (vb_w, vb_h) = (40.0_f32, 28.0_f32);
        // Cloud fills ~85% of the tile width, centered, leaving a small margin.
        let scale = (SIZE as f32 * 0.85) / vb_w;
        let off_x = (SIZE as f32 - vb_w * scale) / 2.0;
        let off_y = (SIZE as f32 - vb_h * scale) / 2.0;
        let tile_radius = 6.0_f32;

        let mut rgba = vec![0u8; SIZE * SIZE * 4];
        for py in 0..SIZE {
            for px in 0..SIZE {
                let mut tile_hits = 0u32;
                let mut cloud_hits = 0u32;
                for sy in 0..SS {
                    for sx in 0..SS {
                        let fx = px as f32 + (sx as f32 + 0.5) / SS as f32;
                        let fy = py as f32 + (sy as f32 + 0.5) / SS as f32;
                        if in_rounded_square(fx, fy, SIZE as f32, tile_radius) {
                            tile_hits += 1;
                        }
                        let vx = (fx - off_x) / scale;
                        let vy = (fy - off_y) / scale;
                        if circles.iter().any(|&(cx, cy, r)| {
                            let dx = vx - cx;
                            let dy = vy - cy;
                            dx * dx + dy * dy <= r * r
                        }) {
                            cloud_hits += 1;
                        }
                    }
                }
                if tile_hits == 0 {
                    continue; // outside the rounded tile: transparent
                }
                // Base = dark tile; blend the light cloud over it by coverage.
                let cc = cloud_hits as f32 / N as f32;
                let lerp = |dark: f32, light: f32| (dark * (1.0 - cc) + light * cc) as u8;
                let idx = (py * SIZE + px) * 4;
                rgba[idx] = lerp(0x0d as f32, 0xe9 as f32);
                rgba[idx + 1] = lerp(0x0d as f32, 0xeb as f32);
                rgba[idx + 2] = lerp(0x0f as f32, 0xef as f32);
                // Tile edge is anti-aliased via its coverage; the cloud is fully
                // inside the tile, so alpha follows the tile coverage.
                rgba[idx + 3] = (tile_hits * 255 / N) as u8;
            }
        }
        (SIZE as u32, SIZE as u32, rgba)
    }

    /// Whether point (x, y) lies inside a `size`x`size` square with rounded
    /// corners of the given `radius` (rounded-rectangle signed-distance test).
    #[cfg(any(windows, target_os = "linux"))]
    fn in_rounded_square(x: f32, y: f32, size: f32, radius: f32) -> bool {
        if x < 0.0 || x > size || y < 0.0 || y > size {
            return false;
        }
        // Distance outside the corner-deflated inner rectangle, per axis.
        let dx = (radius - x).max(x - (size - radius)).max(0.0);
        let dy = (radius - y).max(y - (size - radius)).max(0.0);
        dx * dx + dy * dy <= radius * radius
    }

    /// The cloud mark as a macOS *template* image: just the cloud silhouette in
    /// the alpha channel (RGB left black), so AppKit tints it to match the menu
    /// bar (dark on a light bar, light on a dark bar) when set as a template.
    /// No dark tile — a template wants a clean mask, not a coloured tile. Same
    /// circle geometry as `cloud_icon_rgba`, anti-aliased via 4x4 supersampling.
    #[cfg(target_os = "macos")]
    pub(crate) fn cloud_template_rgba() -> (u32, u32, Vec<u8>) {
        const SIZE: usize = 32;
        const SS: usize = 4; // supersamples per axis
        const N: u32 = (SS * SS) as u32;

        let circles = [
            (20.0_f32, 14.0_f32, 6.0_f32),
            (14.0, 15.0, 5.0),
            (26.0, 15.0, 5.0),
            (20.0, 11.0, 5.0),
        ];
        let (vb_w, vb_h) = (40.0_f32, 28.0_f32);
        // Slightly larger than the tiled icon since there is no surrounding tile.
        let scale = (SIZE as f32 * 0.92) / vb_w;
        let off_x = (SIZE as f32 - vb_w * scale) / 2.0;
        let off_y = (SIZE as f32 - vb_h * scale) / 2.0;

        let mut rgba = vec![0u8; SIZE * SIZE * 4];
        for py in 0..SIZE {
            for px in 0..SIZE {
                let mut cloud_hits = 0u32;
                for sy in 0..SS {
                    for sx in 0..SS {
                        let fx = px as f32 + (sx as f32 + 0.5) / SS as f32;
                        let fy = py as f32 + (sy as f32 + 0.5) / SS as f32;
                        let vx = (fx - off_x) / scale;
                        let vy = (fy - off_y) / scale;
                        if circles.iter().any(|&(cx, cy, r)| {
                            let dx = vx - cx;
                            let dy = vy - cy;
                            dx * dx + dy * dy <= r * r
                        }) {
                            cloud_hits += 1;
                        }
                    }
                }
                // RGB stays black; alpha carries the anti-aliased silhouette.
                let idx = (py * SIZE + px) * 4;
                rgba[idx + 3] = (cloud_hits * 255 / N) as u8;
            }
        }
        (SIZE as u32, SIZE as u32, rgba)
    }
}

#[cfg(windows)]
mod imp {
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::thread;
    use std::time::Duration;
    use tray_icon::{
        menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
        Icon, TrayIconBuilder,
    };
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::System::Console::{GetConsoleProcessList, GetConsoleWindow};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, GetMessageW, MessageBoxW, ShowWindow, TranslateMessage, IDYES,
        MB_ICONWARNING, MB_YESNO, MSG, SW_HIDE,
    };

    /// `CreateProcess` flag: the process gets a console but no console *window*.
    /// Crucially, child processes it spawns (git for context, the PowerShell/bash
    /// tool, etc.) inherit this window-less console instead of allocating their
    /// own — so they don't flash console windows on every model turn. Defined
    /// locally to avoid pulling the `Win32_System_Threading` feature for it.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// Set in the environment of the relaunched, window-less tray process so it
    /// runs the tray directly instead of relaunching itself again.
    const DETACHED_ENV: &str = "CLOUDLING_TRAY_DETACHED";

    /// Per-user autostart registry key and value name. `HKCU\...\Run` runs at
    /// logon without admin rights; removing the value disables autostart.
    const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    const RUN_VALUE: &str = "Cloudling";

    pub fn run_tray<F>(bind: String, serve: F) -> Result<(), Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<(), String> + Send + 'static,
    {
        // A console-subsystem binary gets a console window when double-clicked,
        // launched from autostart, or run as `cloudling tray` in a terminal. On
        // Windows 11 that console is hosted by Windows Terminal (a separate
        // process), so ShowWindow(SW_HIDE) only minimizes a window we don't own.
        // The robust fix: relaunch ourselves with CREATE_NO_WINDOW — a console
        // with no window — then let this process exit, which closes the
        // originating console/terminal window. The window-less console is also
        // inherited by every child process we later spawn (git, the shell tool),
        // so none of them flash their own console window. The relaunched child
        // carries DETACHED_ENV so it runs the tray directly instead of
        // relaunching again.
        if std::env::var_os(DETACHED_ENV).is_none() {
            relaunch_windowless_tray(&bind)?;
            return Ok(());
        }

        // Window-less child: there is no console window; harmless no-op safety net.
        hide_console_window();

        let open_url = browser_url(&bind);

        // Run the HTTP server on a background thread. The tray icon and the
        // win32 message loop must own the foreground thread — a hard requirement
        // of tray-icon on Windows. The message loop keeps the tray alive
        // independently of the server, so a server error just gets logged here.
        thread::Builder::new()
            .name("cloudling-serve".into())
            .spawn(move || {
                if let Err(error) = serve() {
                    eprintln!("cloudling tray: server stopped with error: {error}");
                }
            })?;

        // Build the tray menu. Item ids are compared against menu events below.
        let menu = Menu::new();
        let open_item = MenuItem::new("Open Cloudling", true, None);
        let autostart_item = CheckMenuItem::new("Start at login", true, autostart_enabled(), None);
        let uninstall_item = MenuItem::new("Uninstall\u{2026}", true, None);
        let quit_item = MenuItem::new("Quit", true, None);
        menu.append(&open_item)?;
        menu.append(&PredefinedMenuItem::separator())?;
        menu.append(&autostart_item)?;
        menu.append(&PredefinedMenuItem::separator())?;
        menu.append(&uninstall_item)?;
        menu.append(&quit_item)?;

        let _tray = TrayIconBuilder::new()
            .with_tooltip("Cloudling")
            .with_icon(load_icon())
            .with_menu(Box::new(menu))
            .build()?;

        let menu_channel = MenuEvent::receiver();
        let open_id = open_item.id().clone();
        let autostart_id = autostart_item.id().clone();
        let uninstall_id = uninstall_item.id().clone();
        let quit_id = quit_item.id().clone();

        // Win32 message pump. tray-icon delivers menu clicks through its hidden
        // window's proc during DispatchMessageW; we drain the menu channel after
        // each dispatch and act on it.
        loop {
            let mut msg: MSG = unsafe {
                // SAFETY: MSG is a plain C struct; a zeroed value is a valid
                // initial state that GetMessageW fully overwrites before use.
                std::mem::zeroed()
            };
            // SAFETY: `msg` is a valid, properly-aligned MSG pointer; a null
            // window handle means "any window on this thread", which is what we
            // want for the tray's hidden window.
            let ret = unsafe { GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) };
            if ret <= 0 {
                // 0 == WM_QUIT, -1 == error: either way, stop pumping.
                break;
            }
            // SAFETY: `msg` was just populated by a successful GetMessageW call.
            unsafe {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            while let Ok(event) = menu_channel.try_recv() {
                if event.id == open_id {
                    open_in_browser(&open_url);
                } else if event.id == autostart_id {
                    // CheckMenuItem has already toggled its own state; mirror it
                    // into the registry.
                    set_autostart(autostart_item.is_checked());
                } else if event.id == uninstall_id {
                    if confirm_gui() {
                        // This process runs the server, which holds the dialogs
                        // DB open — Windows refuses to delete locked files. Hand
                        // off to a detached `uninstall --yes` process and exit so
                        // the lock releases; the child retries until it can
                        // remove the data directories.
                        let _ = spawn_uninstall_detached();
                        std::process::exit(0);
                    }
                } else if event.id == quit_id {
                    // Exit the whole process; the background server thread is
                    // torn down with it. Graceful shutdown is a later refinement.
                    std::process::exit(0);
                }
            }
        }
        Ok(())
    }

    pub fn run_uninstall(
        data_dirs: Vec<PathBuf>,
        assume_yes: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !assume_yes && !confirm_cli(&data_dirs) {
            eprintln!("Aborted. Nothing was removed.");
            return Ok(());
        }

        // Always clear the autostart entry so a removed install does not try to
        // launch a deleted binary at next logon.
        set_autostart(false);

        for dir in &data_dirs {
            if dir.exists() {
                remove_dir_all_retry(dir)?;
                println!("Removed {}", dir.display());
            }
        }
        Ok(())
    }

    /// Remove a directory tree, retrying briefly. When invoked from the tray's
    /// detached uninstaller the parent tray process is still exiting, so the
    /// dialogs DB may stay locked for a moment; retry until the lock releases.
    fn remove_dir_all_retry(dir: &Path) -> std::io::Result<()> {
        let mut last = Ok(());
        for _ in 0..20 {
            match std::fs::remove_dir_all(dir) {
                Ok(()) => return Ok(()),
                Err(error) => last = Err(error),
            }
            if !dir.exists() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(150));
        }
        last
    }

    /// Relaunch this executable as a window-less `cloudling tray` process whose
    /// console (and thus its child processes' console) has no window.
    ///
    /// The relaunched process runs from the user's home directory rather than
    /// wherever the `.exe` happens to sit (e.g. Desktop). The agent creates a
    /// project-local `.claw` config dir relative to its working directory; from
    /// home that coincides with the per-user config dir (`%USERPROFILE%\.claw`,
    /// which uninstall removes) instead of littering one next to the executable.
    fn relaunch_windowless_tray(bind: &str) -> std::io::Result<()> {
        let exe = std::env::current_exe()?;
        let mut command = Command::new(exe);
        command
            .arg("tray")
            .arg("--bind")
            .arg(bind)
            .env(DETACHED_ENV, "1")
            .creation_flags(CREATE_NO_WINDOW);
        if let Some(home) = std::env::var_os("USERPROFILE") {
            command.current_dir(home);
        }
        command.spawn()?;
        Ok(())
    }

    /// Launch a window-less `cloudling uninstall --yes` process that deletes the data
    /// directories once this process has released its file locks.
    fn spawn_uninstall_detached() -> std::io::Result<()> {
        let exe = std::env::current_exe()?;
        Command::new(exe)
            .arg("uninstall")
            .arg("--yes")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()?;
        Ok(())
    }

    /// True when `cloudling` owns its console alone — i.e. a fresh console created for
    /// a double-clicked executable. When launched from a shell, that shell is
    /// also attached to the console, so the count is >= 2 and we keep the REPL.
    pub fn launched_by_double_click() -> bool {
        let mut buf = [0u32; 2];
        // SAFETY: `buf` is a valid, writable array of `buf.len()` u32s; the call
        // only fills up to that many and returns the process count.
        let count = unsafe { GetConsoleProcessList(buf.as_mut_ptr(), buf.len() as u32) };
        count == 1
    }

    /// Interactive CLI confirmation for `cloudling uninstall` (no `--yes`). The tray
    /// path uses [`confirm_gui`] instead.
    fn confirm_cli(dirs: &[PathBuf]) -> bool {
        eprintln!("This permanently deletes Cloudling data: conversations, keys, settings.");
        for dir in dirs {
            eprintln!("  {}", dir.display());
        }
        eprint!("Type 'yes' to confirm: ");
        if std::io::stderr().flush().is_err() {
            return false;
        }
        let mut line = String::new();
        if std::io::stdin().read_line(&mut line).is_err() {
            return false;
        }
        line.trim() == "yes"
    }

    /// GUI confirmation dialog for the tray "Uninstall" item. Returns true only
    /// if the user explicitly clicks Yes.
    fn confirm_gui() -> bool {
        let text = wide(
            "This permanently deletes Cloudling data:\nconversations, keys, and settings.\n\nThis cannot be undone. Continue?",
        );
        let caption = wide("Cloudling \u{2014} Uninstall");
        // SAFETY: both pointers reference null-terminated UTF-16 buffers that
        // outlive the call; a null owner handle yields a standalone dialog.
        let result = unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                text.as_ptr(),
                caption.as_ptr(),
                MB_YESNO | MB_ICONWARNING,
            )
        };
        result == IDYES
    }

    fn hide_console_window() {
        // SAFETY: GetConsoleWindow returns this process's console window (or
        // null if none); ShowWindow tolerates any valid HWND and we guard null.
        unsafe {
            let hwnd: HWND = GetConsoleWindow();
            if !hwnd.is_null() {
                let _ = ShowWindow(hwnd, SW_HIDE);
            }
        }
    }

    fn autostart_enabled() -> bool {
        Command::new("reg")
            .args(["query", RUN_KEY, "/v", RUN_VALUE])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false)
    }

    fn set_autostart(enable: bool) {
        if enable {
            if let Ok(exe) = std::env::current_exe() {
                let data = format!("\"{}\" tray", exe.display());
                let _ = Command::new("reg")
                    .args([
                        "add", RUN_KEY, "/v", RUN_VALUE, "/t", "REG_SZ", "/d", &data, "/f",
                    ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status();
            }
        } else {
            let _ = Command::new("reg")
                .args(["delete", RUN_KEY, "/v", RUN_VALUE, "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
    }

    /// Build a clickable `http://host:port/` URL from the server bind address,
    /// rewriting wildcard hosts to localhost so the browser can reach it.
    fn browser_url(bind: &str) -> String {
        let (host, port) = bind.rsplit_once(':').unwrap_or(("127.0.0.1", "4097"));
        let host = match host {
            "0.0.0.0" | "::" | "[::]" | "" => "127.0.0.1",
            other => other,
        };
        format!("http://{host}:{port}/")
    }

    fn open_in_browser(url: &str) {
        // `cmd /C start "" <url>` opens the default browser; CREATE_NO_WINDOW
        // suppresses the transient cmd console window.
        let _ = Command::new("cmd")
            .args(["/C", "start", "", url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Tray icon as tray-icon's RGBA `Icon`, rendered by the shared procedural
    /// generator (`crate::icon`) so Windows and Linux show the identical mark.
    fn load_icon() -> Icon {
        let (w, h, rgba) = crate::icon::cloud_icon_rgba();
        Icon::from_rgba(rgba, w, h).expect("cloud icon dimensions are valid")
    }
}

#[cfg(target_os = "linux")]
mod linux_imp {
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::thread;
    use std::time::Duration;

    use ksni::blocking::TrayMethods;
    use ksni::{Icon, Tray};

    /// Autostart desktop-entry path: `$XDG_CONFIG_HOME/autostart/cloudling.desktop`
    /// (falls back to `~/.config/autostart/...`). Writing it makes the desktop
    /// launch `cloudling tray` at login; removing it disables autostart. No hardcoded
    /// home path — derived from the environment so the build stays portable.
    fn autostart_path() -> Option<PathBuf> {
        let config_home = std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .filter(|p| !p.as_os_str().is_empty())
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
        Some(config_home.join("autostart").join("cloudling.desktop"))
    }

    fn autostart_enabled() -> bool {
        autostart_path().map(|p| p.exists()).unwrap_or(false)
    }

    fn set_autostart(enable: bool) {
        let Some(path) = autostart_path() else {
            return;
        };
        if enable {
            let exe = std::env::current_exe()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|_| "cloudling".to_string());
            let entry = format!(
                "[Desktop Entry]\nType=Application\nName=Cloudling\nExec={exe} tray\nTerminal=false\nX-GNOME-Autostart-enabled=true\n"
            );
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(&path, entry);
        } else {
            let _ = std::fs::remove_file(&path);
        }
    }

    /// Build a `http://host:port/` URL from the bind address, rewriting wildcard
    /// hosts to localhost so the browser can reach it. Mirrors the Windows helper.
    fn browser_url(bind: &str) -> String {
        let (host, port) = bind.rsplit_once(':').unwrap_or(("127.0.0.1", "4097"));
        let host = match host {
            "0.0.0.0" | "::" | "[::]" | "" => "127.0.0.1",
            other => other,
        };
        format!("http://{host}:{port}/")
    }

    fn open_in_browser(url: &str) {
        let _ = Command::new("xdg-open").arg(url).spawn();
    }

    /// The shared procedural icon as a ksni `Icon` (ARGB32, network byte order).
    /// The generator emits RGBA; `rotate_right(1)` reorders each pixel to ARGB.
    fn tray_icon() -> Icon {
        let (width, height, mut data) = crate::icon::cloud_icon_rgba();
        for pixel in data.chunks_exact_mut(4) {
            pixel.rotate_right(1);
        }
        Icon {
            width: width as i32,
            height: height as i32,
            data,
        }
    }

    struct ClawTray {
        url: String,
        autostart: bool,
        /// Set when the background server stops with an error (e.g. the port is
        /// already in use). Surfaced as a disabled menu item so the icon stays
        /// visible and explains itself instead of silently vanishing.
        error: Option<String>,
    }

    impl Tray for ClawTray {
        fn id(&self) -> String {
            "cloudling".into()
        }
        fn title(&self) -> String {
            "Cloudling".into()
        }
        fn icon_pixmap(&self) -> Vec<Icon> {
            vec![tray_icon()]
        }
        /// Left-click opens the UI in the browser.
        fn activate(&mut self, _x: i32, _y: i32) {
            open_in_browser(&self.url);
        }
        fn menu(&self) -> Vec<ksni::MenuItem<Self>> {
            use ksni::menu::*;
            let mut items: Vec<ksni::MenuItem<Self>> = Vec::new();
            // When the server has stopped with an error, show it (disabled) at
            // the top so the still-present icon explains why the UI is down.
            if let Some(error) = &self.error {
                let mut shown = error.clone();
                if shown.chars().count() > 80 {
                    shown = shown.chars().take(77).collect::<String>() + "\u{2026}";
                }
                items.push(
                    StandardItem {
                        label: format!("\u{26a0} Server stopped: {shown}"),
                        enabled: false,
                        ..Default::default()
                    }
                    .into(),
                );
                items.push(MenuItem::Separator);
            }
            items.extend([
                StandardItem {
                    label: "Open Cloudling".into(),
                    activate: Box::new(|this: &mut Self| open_in_browser(&this.url)),
                    ..Default::default()
                }
                .into(),
                MenuItem::Separator,
                CheckmarkItem {
                    label: "Start at login".into(),
                    checked: self.autostart,
                    activate: Box::new(|this: &mut Self| {
                        this.autostart = !this.autostart;
                        set_autostart(this.autostart);
                    }),
                    ..Default::default()
                }
                .into(),
                MenuItem::Separator,
                StandardItem {
                    label: "Uninstall\u{2026}".into(),
                    activate: Box::new(|_this: &mut Self| {
                        // Hand off to a detached `cloudling uninstall --yes` so this
                        // process (holding the dialogs DB) can exit and release
                        // its locks first, then quit.
                        let _ = spawn_uninstall_detached();
                        std::process::exit(0);
                    }),
                    ..Default::default()
                }
                .into(),
                StandardItem {
                    label: "Quit".into(),
                    activate: Box::new(|_this: &mut Self| std::process::exit(0)),
                    ..Default::default()
                }
                .into(),
            ]);
            items
        }
    }

    pub fn run_tray<F>(bind: String, serve: F) -> Result<(), Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<(), String> + Send + 'static,
    {
        let url = browser_url(&bind);

        // Single-instance: if a Cloudling server already answers `/health` on this
        // port, a copy is already running. Starting a second one would fail to
        // bind (EADDRINUSE) and used to make the new icon vanish; instead just
        // open the browser at the running instance and exit cleanly.
        if health_ok(&bind) {
            open_in_browser(&url);
            return Ok(());
        }

        // Show the tray icon. `spawn` runs the SNI service on its own background
        // thread and returns a handle we keep alive for the process lifetime.
        //
        // `assume_sni_available(true)` is what makes autostart-at-login work: at
        // login the desktop launches `cloudling tray` very early, often before the
        // StatusNotifierWatcher (e.g. GNOME's AppIndicator extension) is on the
        // session bus. Without this flag `spawn` hard-errors when no watcher is
        // present yet, we fall into the "running without an icon" branch below,
        // and the icon never appears (the server runs, so the process is alive
        // but trayless — exactly the post-reboot symptom). With the flag, ksni
        // sets the item up anyway and registers it once the watcher comes online,
        // so the icon shows up after the panel finishes loading. (ksni >= 0.3.3.)
        //
        // A genuinely tray-less desktop (no StatusNotifier host at all) still just
        // logs and carries on, so the server runs and the browser still opens.
        let tray = ClawTray {
            url: url.clone(),
            autostart: autostart_enabled(),
            error: None,
        };
        let tray_handle = match tray.assume_sni_available(true).spawn() {
            Ok(handle) => Some(handle),
            Err(error) => {
                eprintln!("cloudling tray: system tray unavailable ({error}); running without an icon");
                None
            }
        };

        // Run the HTTP server on a background thread (it used to run on this, the
        // main, thread). That lets the main thread keep the tray alive even when
        // the server stops — a bind error no longer silently kills the icon. The
        // server's outcome comes back over a channel.
        let (tx, rx) = std::sync::mpsc::channel();
        thread::Builder::new()
            .name("cloudling-serve".into())
            .spawn(move || {
                let _ = tx.send(serve());
            })?;

        // Open the UI once the server is actually accepting connections rather
        // than after a fixed delay (more robust on a cold start). If the server
        // never comes up, the poll times out and we simply don't open a browser.
        let open_bind = bind.clone();
        let open_url = url.clone();
        thread::Builder::new()
            .name("cloudling-open-browser".into())
            .spawn(move || {
                if wait_for_health(&open_bind, Duration::from_secs(15)) {
                    open_in_browser(&open_url);
                }
            })?;

        // Wait for the server to finish. While it runs this just blocks; the tray
        // lives on its own thread and `Quit` exits the process directly. If the
        // server stops with an error, surface it on the still-present tray icon
        // and keep the process alive so the user sees it and quits deliberately.
        match rx.recv() {
            Ok(Ok(())) => {}
            Ok(Err(error)) => {
                eprintln!("cloudling tray: server stopped with error: {error}");
                if let Some(handle) = &tray_handle {
                    let _ = handle.update(move |tray: &mut ClawTray| {
                        tray.error = Some(error);
                    });
                    // Keep the icon (and process) alive; the user quits via menu.
                    loop {
                        thread::park();
                    }
                }
            }
            Err(_) => {}
        }
        drop(tray_handle);
        Ok(())
    }

    /// Whether a Cloudling server already answers `GET /health` with `200` on this
    /// bind's port. Used for single-instance detection and browser-open
    /// readiness. Dependency-free (raw TCP + a minimal HTTP request) so the
    /// static musl binary needs no HTTP-client crate; the loopback address means
    /// no DNS is involved (sidesteps musl's resolver entirely).
    fn health_ok(bind: &str) -> bool {
        use std::io::{Read, Write};
        use std::net::{SocketAddr, TcpStream};

        let port = bind.rsplit_once(':').map(|(_, p)| p).unwrap_or("4097");
        let Ok(addr) = format!("127.0.0.1:{port}").parse::<SocketAddr>() else {
            return false;
        };
        let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) else {
            return false;
        };
        let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
        let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
        let request =
            format!("GET /health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
        if stream.write_all(request.as_bytes()).is_err() {
            return false;
        }
        let mut buf = [0u8; 64];
        let Ok(read) = stream.read(&mut buf) else {
            return false;
        };
        // Status line is e.g. "HTTP/1.0 200 OK" / "HTTP/1.1 200 OK".
        let head = String::from_utf8_lossy(&buf[..read]);
        head.starts_with("HTTP/1.") && head.contains(" 200")
    }

    /// Poll [`health_ok`] until it succeeds or `timeout` elapses.
    fn wait_for_health(bind: &str, timeout: Duration) -> bool {
        let start = std::time::Instant::now();
        loop {
            if health_ok(bind) {
                return true;
            }
            if start.elapsed() >= timeout {
                return false;
            }
            thread::sleep(Duration::from_millis(200));
        }
    }

    pub fn run_uninstall(
        data_dirs: Vec<PathBuf>,
        assume_yes: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !assume_yes && !confirm_cli(&data_dirs) {
            eprintln!("Aborted. Nothing was removed.");
            return Ok(());
        }
        // Always clear the autostart entry so a removed install does not try to
        // launch a deleted binary at next login.
        set_autostart(false);
        for dir in &data_dirs {
            if dir.exists() {
                remove_dir_all_retry(dir)?;
                println!("Removed {}", dir.display());
            }
        }
        Ok(())
    }

    /// Always false on Linux: the AppImage / autostart entry launches `cloudling tray`
    /// explicitly, so there is no double-click-vs-terminal console heuristic.
    pub fn launched_by_double_click() -> bool {
        false
    }

    /// Launch a detached `cloudling uninstall --yes` that deletes the data directories
    /// once this process releases its file locks.
    fn spawn_uninstall_detached() -> std::io::Result<()> {
        let exe = std::env::current_exe()?;
        Command::new(exe).arg("uninstall").arg("--yes").spawn()?;
        Ok(())
    }

    /// Remove a directory tree, retrying briefly while the just-exiting tray
    /// process releases the dialogs-DB lock.
    fn remove_dir_all_retry(dir: &Path) -> std::io::Result<()> {
        let mut last = Ok(());
        for _ in 0..20 {
            match std::fs::remove_dir_all(dir) {
                Ok(()) => return Ok(()),
                Err(error) => last = Err(error),
            }
            if !dir.exists() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(150));
        }
        last
    }

    /// Interactive CLI confirmation for `cloudling uninstall` (no `--yes`).
    fn confirm_cli(dirs: &[PathBuf]) -> bool {
        use std::io::Write;
        eprintln!("This permanently deletes Cloudling data: conversations, keys, settings.");
        for dir in dirs {
            eprintln!("  {}", dir.display());
        }
        eprint!("Type 'yes' to confirm: ");
        if std::io::stderr().flush().is_err() {
            return false;
        }
        let mut line = String::new();
        if std::io::stdin().read_line(&mut line).is_err() {
            return false;
        }
        line.trim() == "yes"
    }
}

#[cfg(target_os = "macos")]
mod macos_imp {
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::thread;
    use std::time::Duration;

    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
    use tray_icon::{
        menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
        Icon, TrayIconBuilder,
    };

    /// LaunchAgent label / plist filename. Writing
    /// `~/Library/LaunchAgents/<LABEL>.plist` makes the desktop launch
    /// `cloudling tray` at login; removing it disables autostart. Mirrors the Linux
    /// `cloudling.desktop` autostart entry. No hardcoded home — derived from `HOME`.
    const AUTOSTART_LABEL: &str = "cloudling";

    pub fn run_tray<F>(bind: String, serve: F) -> Result<(), Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<(), String> + Send + 'static,
    {
        let url = browser_url(&bind);

        // Single-instance: if a Cloudling server already answers `/health` on this
        // port, a copy is running. Just open the browser at it and exit cleanly
        // instead of failing to bind a second one. Mirrors the Linux tray.
        if health_ok(&bind) {
            open_in_browser(&url);
            return Ok(());
        }

        // The Cocoa event loop must own the main thread (a hard tray-icon
        // requirement on macOS), so the HTTP server runs on a background thread.
        // A server error is logged here (like the Windows path); the tray stays
        // alive on the main thread regardless.
        thread::Builder::new()
            .name("cloudling-serve".into())
            .spawn(move || {
                if let Err(error) = serve() {
                    eprintln!("cloudling tray: server stopped with error: {error}");
                }
            })?;

        // Open the UI once the server is actually accepting connections rather
        // than after a fixed delay (more robust on a cold start). If it never
        // comes up, the poll times out and no browser opens.
        let open_bind = bind.clone();
        let open_url = url.clone();
        thread::Builder::new()
            .name("cloudling-open-browser".into())
            .spawn(move || {
                if wait_for_health(&open_bind, Duration::from_secs(15)) {
                    open_in_browser(&open_url);
                }
            })?;

        // Bootstrap a minimal NSApplication on the main thread. `Accessory` keeps
        // the app out of the Dock (menu-bar only), which is what a tray app wants.
        // `sharedApplication`, `setActivationPolicy`, and `run` are all safe in
        // objc2-app-kit 0.3, so this branch needs no `unsafe` at all (like Linux).
        let mtm =
            MainThreadMarker::new().ok_or("cloudling tray: must run on the main thread on macOS")?;
        let app = NSApplication::sharedApplication(mtm);
        app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);

        // Build the tray menu — same items as the Windows/Linux trays.
        let menu = Menu::new();
        let open_item = MenuItem::new("Open Cloudling", true, None);
        let autostart_item = CheckMenuItem::new("Start at login", true, autostart_enabled(), None);
        let uninstall_item = MenuItem::new("Uninstall\u{2026}", true, None);
        let quit_item = MenuItem::new("Quit", true, None);
        menu.append(&open_item)?;
        menu.append(&PredefinedMenuItem::separator())?;
        menu.append(&autostart_item)?;
        menu.append(&PredefinedMenuItem::separator())?;
        menu.append(&uninstall_item)?;
        menu.append(&quit_item)?;

        // The status item is added to the menu bar on build. Kept alive for the
        // process lifetime (the variables below outlive `app.run()`, which never
        // returns). The icon is set as a template so the menu bar tints it.
        let _tray = TrayIconBuilder::new()
            .with_tooltip("Cloudling")
            .with_icon(load_icon())
            .with_icon_as_template(true)
            .with_menu(Box::new(menu))
            .build()?;

        // On macOS tray-icon delivers menu clicks through a global handler that
        // fires on the main thread while the Cocoa loop runs; we can't poll the
        // event channel here because `app.run()` blocks. So we act inside the
        // handler. It captures only `Send` data (menu ids + the URL). The
        // autostart action flips the actual plist state (self-correcting), so the
        // visible checkmark relies on muda's native auto-toggle — same assumption
        // as the Windows tray ("CheckMenuItem has already toggled its own state").
        let open_id = open_item.id().clone();
        let autostart_id = autostart_item.id().clone();
        let uninstall_id = uninstall_item.id().clone();
        let quit_id = quit_item.id().clone();
        let menu_url = url.clone();
        MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
            if event.id == open_id {
                open_in_browser(&menu_url);
            } else if event.id == autostart_id {
                set_autostart(!autostart_enabled());
            } else if event.id == uninstall_id {
                // Hand off to a detached `cloudling uninstall --yes` so this process
                // (holding the dialogs DB) can exit and release its locks first.
                let _ = spawn_uninstall_detached();
                std::process::exit(0);
            } else if event.id == quit_id {
                std::process::exit(0);
            }
        }));

        // Run the Cocoa event loop on the main thread. Does not return until the
        // process exits (Quit / Uninstall call `process::exit`).
        app.run();
        Ok(())
    }

    pub fn run_uninstall(
        data_dirs: Vec<PathBuf>,
        assume_yes: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !assume_yes && !confirm_cli(&data_dirs) {
            eprintln!("Aborted. Nothing was removed.");
            return Ok(());
        }
        // Always clear the autostart entry so a removed install does not try to
        // launch a deleted binary at next login.
        set_autostart(false);
        for dir in &data_dirs {
            if dir.exists() {
                remove_dir_all_retry(dir)?;
                println!("Removed {}", dir.display());
            }
        }
        Ok(())
    }

    /// Always false on macOS: the `.app` bundle / LaunchAgent launches `cloudling tray`
    /// explicitly, so there is no double-click-vs-terminal console heuristic.
    pub fn launched_by_double_click() -> bool {
        false
    }

    /// Autostart LaunchAgent plist path: `~/Library/LaunchAgents/<LABEL>.plist`.
    /// Derived from `HOME` so the build stays portable (no hardcoded home).
    fn autostart_path() -> Option<PathBuf> {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|p| !p.as_os_str().is_empty())?;
        Some(
            home.join("Library")
                .join("LaunchAgents")
                .join(format!("{AUTOSTART_LABEL}.plist")),
        )
    }

    fn autostart_enabled() -> bool {
        autostart_path().map(|p| p.exists()).unwrap_or(false)
    }

    fn set_autostart(enable: bool) {
        let Some(path) = autostart_path() else {
            return;
        };
        if enable {
            let exe = std::env::current_exe()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|_| "cloudling".to_string());
            // Minimal LaunchAgent: run `cloudling tray` at login for this GUI session.
            let plist = format!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
                 <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTD/PropertyList-1.0.dtd\">\n\
                 <plist version=\"1.0\">\n\
                 <dict>\n\
                 \t<key>Label</key>\n\
                 \t<string>{AUTOSTART_LABEL}</string>\n\
                 \t<key>ProgramArguments</key>\n\
                 \t<array>\n\
                 \t\t<string>{exe}</string>\n\
                 \t\t<string>tray</string>\n\
                 \t</array>\n\
                 \t<key>RunAtLoad</key>\n\
                 \t<true/>\n\
                 \t<key>LimitLoadToSessionType</key>\n\
                 \t<string>Aqua</string>\n\
                 </dict>\n\
                 </plist>\n"
            );
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(&path, plist);
        } else {
            let _ = std::fs::remove_file(&path);
        }
    }

    /// Build a `http://host:port/` URL from the bind address, rewriting wildcard
    /// hosts to localhost so the browser can reach it. Mirrors the other trays.
    fn browser_url(bind: &str) -> String {
        let (host, port) = bind.rsplit_once(':').unwrap_or(("127.0.0.1", "4097"));
        let host = match host {
            "0.0.0.0" | "::" | "[::]" | "" => "127.0.0.1",
            other => other,
        };
        format!("http://{host}:{port}/")
    }

    fn open_in_browser(url: &str) {
        let _ = Command::new("open").arg(url).spawn();
    }

    /// The shared procedural cloud as a tray-icon `Icon`, rendered as a macOS
    /// template silhouette (see `crate::icon::cloud_template_rgba`). Paired with
    /// `with_icon_as_template(true)` so the menu bar tints it for light/dark.
    fn load_icon() -> Icon {
        let (w, h, rgba) = crate::icon::cloud_template_rgba();
        Icon::from_rgba(rgba, w, h).expect("cloud icon dimensions are valid")
    }

    /// Launch a detached `cloudling uninstall --yes` that deletes the data directories
    /// once this process releases its file locks.
    fn spawn_uninstall_detached() -> std::io::Result<()> {
        let exe = std::env::current_exe()?;
        Command::new(exe).arg("uninstall").arg("--yes").spawn()?;
        Ok(())
    }

    /// Remove a directory tree, retrying briefly while the just-exiting tray
    /// process releases the dialogs-DB lock.
    fn remove_dir_all_retry(dir: &Path) -> std::io::Result<()> {
        let mut last = Ok(());
        for _ in 0..20 {
            match std::fs::remove_dir_all(dir) {
                Ok(()) => return Ok(()),
                Err(error) => last = Err(error),
            }
            if !dir.exists() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(150));
        }
        last
    }

    /// Interactive CLI confirmation for `cloudling uninstall` (no `--yes`).
    fn confirm_cli(dirs: &[PathBuf]) -> bool {
        use std::io::Write;
        eprintln!("This permanently deletes Cloudling data: conversations, keys, settings.");
        for dir in dirs {
            eprintln!("  {}", dir.display());
        }
        eprint!("Type 'yes' to confirm: ");
        if std::io::stderr().flush().is_err() {
            return false;
        }
        let mut line = String::new();
        if std::io::stdin().read_line(&mut line).is_err() {
            return false;
        }
        line.trim() == "yes"
    }

    /// Whether a Cloudling server already answers `GET /health` with `200` on this
    /// bind's port. Used for single-instance detection and browser-open readiness.
    /// Dependency-free (raw TCP + a minimal HTTP request) over loopback, so no
    /// HTTP-client crate and no DNS. Mirrors the Linux tray's helper.
    fn health_ok(bind: &str) -> bool {
        use std::io::{Read, Write};
        use std::net::{SocketAddr, TcpStream};

        let port = bind.rsplit_once(':').map(|(_, p)| p).unwrap_or("4097");
        let Ok(addr) = format!("127.0.0.1:{port}").parse::<SocketAddr>() else {
            return false;
        };
        let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) else {
            return false;
        };
        let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
        let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
        let request =
            format!("GET /health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
        if stream.write_all(request.as_bytes()).is_err() {
            return false;
        }
        let mut buf = [0u8; 64];
        let Ok(read) = stream.read(&mut buf) else {
            return false;
        };
        let head = String::from_utf8_lossy(&buf[..read]);
        head.starts_with("HTTP/1.") && head.contains(" 200")
    }

    /// Poll [`health_ok`] until it succeeds or `timeout` elapses.
    fn wait_for_health(bind: &str, timeout: Duration) -> bool {
        let start = std::time::Instant::now();
        loop {
            if health_ok(bind) {
                return true;
            }
            if start.elapsed() >= timeout {
                return false;
            }
            thread::sleep(Duration::from_millis(200));
        }
    }
}
