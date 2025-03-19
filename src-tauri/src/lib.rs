use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Manager, Result,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            enable_click_through(app)?;
            setup_tray_icon(app)?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn enable_click_through(app: &mut App) -> Result<()> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    window.set_ignore_cursor_events(true)?;
    Ok(())
}

fn setup_tray_icon(app: &mut App) -> Result<()> {
    let menu = Menu::with_items(
        app,
        &[&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?],
    )?;
    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|handle, event| match event.id.as_ref() {
            "quit" => handle.exit(0),
            _ => (),
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}
