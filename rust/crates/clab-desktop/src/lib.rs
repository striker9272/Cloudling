//! Windows desktop integration for Claw Lab.
//!
//! This is the quarantine crate for the small amount of unavoidable Windows FFI
//! `unsafe` needed by the tray icon, console-window hiding, and registry
//! autostart. The rest of the workspace keeps the upstream
//! `unsafe_code = "forbid"`; only this crate permits `unsafe`, and every block
//! carries a `// SAFETY:` note.
//!
//! The `tray` role runs the server + built-in web UI in the background, hides
//! the console window, and shows a tray icon with a right-click menu (Open /
//! Start at login / Uninstall / Quit). The `uninstall` role removes the optional
//! autostart entry and, after confirmation, the per-user data directory.
//!
//! The crate is decoupled from the rest of Claw Lab: the caller passes a `serve`
//! closure (which starts the HTTP server) and the `data_dir` to manage, so this
//! crate depends on nothing but `tray-icon`/`windows-sys` (Windows only). The
//! public API exists on every platform — off Windows it returns a clear
//! "Windows-only" error — so the workspace still builds on Linux/macOS.

/// Run the desktop tray: start `serve` in the background, hide the console, and
/// show the tray icon + menu. `bind` is used to build the browser URL for the
/// "Open" item; `data_dir` is what the "Uninstall" item removes. Windows-only.
#[cfg(not(windows))]
pub fn run_tray<F>(
    _bind: String,
    _data_dir: std::path::PathBuf,
    _serve: F,
) -> Result<(), Box<dyn std::error::Error>>
where
    F: FnOnce() + Send + 'static,
{
    Err("`clab tray` is only available on Windows".into())
}

/// Remove the autostart entry and (after confirmation, unless `assume_yes`) the
/// per-user `data_dir`. Windows-only.
#[cfg(not(windows))]
pub fn run_uninstall(
    _data_dir: std::path::PathBuf,
    _assume_yes: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    Err("`clab uninstall` is only available on Windows".into())
}

/// Whether the executable was started by a bare double-click (its own fresh
/// console) rather than from an existing terminal. Always false off Windows.
#[cfg(not(windows))]
pub fn launched_by_double_click() -> bool {
    false
}

#[cfg(windows)]
pub use imp::{launched_by_double_click, run_tray, run_uninstall};

#[cfg(windows)]
mod imp {
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::path::PathBuf;
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

    pub fn run_tray<F>(
        bind: String,
        data_dir: PathBuf,
        serve: F,
    ) -> Result<(), Box<dyn std::error::Error>>
    where
        F: FnOnce() + Send + 'static,
    {
        // A console-subsystem binary briefly shows a console window even when
        // double-clicked; hide it immediately so only the tray icon remains.
        hide_console_window();

        let open_url = browser_url(&bind);

        // Run the HTTP server on a background thread. The tray icon and the
        // win32 message loop must own the foreground thread — a hard requirement
        // of tray-icon on Windows.
        thread::Builder::new()
            .name("clab-serve".into())
            .spawn(serve)?;

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
                        let _ = run_uninstall(data_dir.clone(), true);
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
        data_dir: PathBuf,
        assume_yes: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
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
    pub fn launched_by_double_click() -> bool {
        let mut buf = [0u32; 2];
        // SAFETY: `buf` is a valid, writable array of `buf.len()` u32s; the call
        // only fills up to that many and returns the process count.
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
