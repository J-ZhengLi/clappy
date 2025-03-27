mod response;

use response::{CodeQuality, Configuration};
use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, LogicalPosition, Manager, Result,
};
use tokio::process::Command;

#[derive(Clone, Debug, Serialize)]
struct PetAction {
    animation: String,
    message: Option<String>,
}

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

#[tauri::command]
fn get_cursor_pos(window: tauri::Window) -> Result<LogicalPosition<f64>> {
    let scale_factor = window.scale_factor()?;
    window
        .cursor_position()
        .map(|pp| pp.to_logical(scale_factor))
}

#[tauri::command]
fn ignore_cursor_events(window: tauri::Window, ignore: bool) -> Result<()> {
    window.set_ignore_cursor_events(ignore)
}

#[tauri::command]
async fn execute_clippy(window: tauri::Window) -> Result<()> {
    let output = Command::new("cargo")
        .arg("clippy")
        .args(["--message-format", "json-render-diagnostics"])
        .output()
        .await?;
    // `--message-format json-render-diagnostics` put irrelevant rustc diagnostics to `stdout`,
    // and put the actual rendered messages to `stderr` which is what we need.
    let res_str = &*String::from_utf8_lossy(&output.stderr);
    eprintln!("{res_str}");
    // process result, emit different animation and message
    let (quality, message) = Configuration::load().respond_to_clippy_output(res_str);
    let animation = match quality {
        CodeQuality::Perfect => "clap",
        CodeQuality::Mediocre => "disappointed",
        CodeQuality::Bad => "angry",
    };
    window.emit(
        "pet-action",
        PetAction {
            animation: animation.into(),
            message,
        },
    )?;

    Ok(())
}
