//! Windows desktop integration for `clab`.
//!
//! The same `clab.exe` plays several roles. The `tray` role runs the server +
//! built-in web UI in the background, hides the console window, and shows a tray
//! icon with a right-click menu (Open / Start at login / Uninstall / Quit). A
//! bare double-click on the executable also lands here (see
//! [`launched_by_double_click`]); running `clab` from a terminal keeps the
//! interactive REPL. The `uninstall` role removes the optional autostart entry
//! and, after confirmation, the per-user data directory.
//!
//! Only the runtime behaviour is Windows-specific. The public functions exist on
//! every platform so the CLI parser/dispatch compile everywhere — on non-Windows
//! they return a clear "Windows-only" error. All real logic and all Windows-only
//! dependencies live behind `#[cfg(windows)]`, so the Linux/macOS build pulls
//! nothing extra and is unchanged.

use crate::AllowedToolSet;
use runtime::PermissionMode;

#[cfg(not(windows))]
pub(crate) fn run_tray(
    _bind: String,
    _model: String,
    _allowed_tools: Option<AllowedToolSet>,
    _permission_mode: PermissionMode,
) -> Result<(), Box<dyn std::error::Error>> {
    Err("`clab tray` is only available on Windows".into())
}

#[cfg(not(windows))]
pub(crate) fn run_uninstall(_assume_yes: bool) -> Result<(), Box<dyn std::error::Error>> {
    Err("`clab uninstall` is only available on Windows".into())
}

/// Whether `clab` was started by a bare double-click (its own fresh console)
/// rather than from an existing terminal. Always false off Windows.
#[cfg(not(windows))]
pub(crate) fn launched_by_double_click() -> bool {
    false
}

#[cfg(windows)]
pub(crate) use imp::{launched_by_double_click, run_tray, run_uninstall};

#[cfg(windows)]
mod imp {
    use super::{AllowedToolSet, PermissionMode};
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    use std::thread;
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

    /// `CreateProcess` flag: do not create a console window for the child.
    /// Defined locally to avoid pulling the `Win32_System_Threading` feature for
    /// one constant.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// Per-user autostart registry key and value name. `HKCU\...\Run` runs at
    /// logon without admin rights; removing the value disables autostart.
    const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    const RUN_VALUE: &str = "ClawLab";

    pub(crate) fn run_tray(
        bind: String,
        model: String,
        allowed_tools: Option<AllowedToolSet>,
        permission_mode: PermissionMode,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // A console-subsystem binary briefly shows a console window even when
        // double-clicked; hide it immediately so only the tray icon remains.
        hide_console_window();

        let open_url = browser_url(&bind);

        // Run the HTTP server (engine + built-in UI) on a background thread. The
        // tray icon and the win32 message loop must own the foreground thread —
        // a hard requirement of tray-icon on Windows.
        let server_bind = bind.clone();
        thread::Builder::new()
            .name("clab-serve".into())
            .spawn(move || {
                if let Err(error) = crate::openai_server::serve_blocking(
                    server_bind,
                    model,
                    allowed_tools,
                    permission_mode,
                    true, // the tray always serves the built-in UI
                ) {
                    eprintln!("clab tray: server stopped with error: {error}");
                }
            })?;

        // Build the tray menu. Item ids are compared against menu events below.
        let menu = Menu::new();
        let open_item = MenuItem::new("Open Claw Lab", true, None);
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
            .with_tooltip("Claw Lab")
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
            let mut msg: MSG = unsafe { std::mem::zeroed() };
            let ret = unsafe { GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) };
            if ret <= 0 {
                // 0 == WM_QUIT, -1 == error: either way, stop pumping.
                break;
            }
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
                        let _ = run_uninstall(true);
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

    pub(crate) fn run_uninstall(assume_yes: bool) -> Result<(), Box<dyn std::error::Error>> {
        let data_dir = runtime::default_config_home();

        if !assume_yes && !confirm_cli(&data_dir.display().to_string())? {
            eprintln!("Aborted. Nothing was removed.");
            return Ok(());
        }

        // Always clear the autostart entry so a removed install does not try to
        // launch a deleted binary at next logon.
        set_autostart(false);

        if data_dir.exists() {
            std::fs::remove_dir_all(&data_dir)?;
            println!("Removed {}", data_dir.display());
        } else {
            println!("Nothing to remove at {}", data_dir.display());
        }
        Ok(())
    }

    /// True when `clab` owns its console alone — i.e. a fresh console created for
    /// a double-clicked executable. When launched from a shell, that shell is
    /// also attached to the console, so the count is >= 2 and we keep the REPL.
    pub(crate) fn launched_by_double_click() -> bool {
        let mut buf = [0u32; 2];
        let count = unsafe { GetConsoleProcessList(buf.as_mut_ptr(), buf.len() as u32) };
        count == 1
    }

    /// Interactive CLI confirmation for `clab uninstall` (no `--yes`). The tray
    /// path uses [`confirm_gui`] instead.
    fn confirm_cli(dir: &str) -> Result<bool, Box<dyn std::error::Error>> {
        eprintln!("This permanently deletes Claw Lab data: conversations, keys, settings.");
        eprintln!("Directory: {dir}");
        eprint!("Type 'yes' to confirm: ");
        std::io::stderr().flush()?;
        let mut line = String::new();
        std::io::stdin().read_line(&mut line)?;
        Ok(line.trim() == "yes")
    }

    /// GUI confirmation dialog for the tray "Uninstall" item. Returns true only
    /// if the user explicitly clicks Yes.
    fn confirm_gui() -> bool {
        let text = wide(
            "This permanently deletes Claw Lab data:\nconversations, keys, and settings.\n\nThis cannot be undone. Continue?",
        );
        let caption = wide("Claw Lab \u{2014} Uninstall");
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

    /// Tray icon: the Claw Lab cloud glyph rendered procedurally (no asset file
    /// to ship or embed). A 32x32 brand-blue cloud silhouette on transparency.
    fn load_icon() -> Icon {
        const SIZE: i32 = 32;
        // Cloud = union of three lobes plus a flat base. Coordinates tuned for a
        // recognizable silhouette at small sizes.
        let lobes = [(11_i32, 20_i32, 6_i32), (16, 14, 8), (22, 19, 7)];
        let base = (5_i32, 18_i32, 27_i32, 26_i32); // x0, y0, x1, y1

        let mut rgba = vec![0u8; (SIZE * SIZE * 4) as usize];
        for y in 0..SIZE {
            for x in 0..SIZE {
                let in_lobe = lobes.iter().any(|&(cx, cy, r)| {
                    let dx = x - cx;
                    let dy = y - cy;
                    dx * dx + dy * dy <= r * r
                });
                let in_base = x >= base.0 && x <= base.2 && y >= base.1 && y <= base.3;
                if in_lobe || in_base {
                    let idx = ((y * SIZE + x) * 4) as usize;
                    rgba[idx] = 0x3a; // R
                    rgba[idx + 1] = 0x8d; // G
                    rgba[idx + 2] = 0xde; // B
                    rgba[idx + 3] = 0xff; // A
                }
            }
        }
        Icon::from_rgba(rgba, SIZE as u32, SIZE as u32).expect("cloud icon dimensions are valid")
    }
}
