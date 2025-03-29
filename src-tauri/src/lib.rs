mod response;
mod command;

use response::{CodeQuality, Configuration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Manager, Result,
};
use command::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            setup_tray_icon(app)?;
            setup_main_window(app)?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|_app, args, cwd| {
            // TODO: pase additional `args` to clippy, execute clippy on `cwd`
            println!("args: {args:#?}, cwd: {cwd}");
        }))
        .invoke_handler(tauri::generate_handler![
            get_cursor_pos,
            ignore_cursor_events,
            execute_clippy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_main_window(app: &mut App) -> Result<()> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    window.set_ignore_cursor_events(true)?;

    // enable debug window
    #[cfg(debug_assertions)]
    window.open_devtools();
    Ok(())
}

fn setup_tray_icon(app: &mut App) -> Result<()> {
    let menu = Menu::with_items(
        app,
        &[&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?],
    )?;
    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|handle, event| {
            if event.id.as_ref() == "quit" {
                handle.exit(0)
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}
