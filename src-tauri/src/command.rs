use crate::{CodeQuality, Configuration};
use serde::Serialize;
use tauri::{Emitter, LogicalPosition, Result};
use tokio::process::Command;

#[derive(Clone, Debug, Serialize)]
struct PetAction {
    animation: String,
    message: Option<String>,
}

#[tauri::command]
pub(crate) fn get_cursor_pos(window: tauri::Window) -> Result<LogicalPosition<f64>> {
    let scale_factor = window.scale_factor()?;
    window
        .cursor_position()
        .map(|pp| pp.to_logical(scale_factor))
}

#[tauri::command]
pub(crate) fn ignore_cursor_events(window: tauri::Window, ignore: bool) -> Result<()> {
    window.set_ignore_cursor_events(ignore)
}

#[tauri::command]
pub(crate) async fn execute_clippy(window: tauri::Window) -> Result<()> {
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
