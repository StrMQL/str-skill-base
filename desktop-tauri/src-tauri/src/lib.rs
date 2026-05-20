use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;

struct AppState {
    bridge_port: Option<u16>,
    bridge_error: Option<String>,
    bridge_child: Mutex<Option<std::process::Child>>,
}

#[derive(Deserialize)]
struct BridgeResponse {
    ok: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

struct BridgePaths {
    node: PathBuf,
    script: PathBuf,
    cli_lib: Option<PathBuf>,
}

fn dev_bridge_paths() -> BridgePaths {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let desktop_root = manifest.join("..");
    BridgePaths {
        node: PathBuf::from("node"),
        script: desktop_root.join("bridge").join("server.mjs"),
        cli_lib: Some(desktop_root.join("..").join("cli").join("lib")),
    }
}

fn packaged_node_binary(resource_dir: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        resource_dir.join("node").join("node.exe")
    }
    #[cfg(not(windows))]
    {
        resource_dir.join("node").join("bin").join("node")
    }
}

fn is_real_node_binary(path: &Path) -> bool {
    path.exists()
        && path
            .metadata()
            .map(|m| m.len() > 1_000_000)
            .unwrap_or(false)
}

fn resolve_bridge_paths(app: &AppHandle) -> Result<BridgePaths, String> {
    if cfg!(debug_assertions) {
        return Ok(dev_bridge_paths());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir unavailable: {e}"))?;

    // Tauri maps `src-tauri/resources/**` → $RESOURCE/resources/** (also try $RESOURCE root).
    let bases = [resource_dir.join("resources"), resource_dir.clone()];
    let mut last_err = String::from("bridge resources not found");

    for base in &bases {
        let node = packaged_node_binary(base);
        let script = base.join("bridge").join("server.mjs");
        let cli_lib_dir = base.join("cli-lib");
        let cli_lib = cli_lib_dir.exists().then_some(cli_lib_dir);

        if !script.exists() {
            last_err = format!("bridge script not found: {}", script.display());
            continue;
        }
        if !is_real_node_binary(&node) {
            last_err = format!(
                "bundled Node missing or invalid (need portable Node binary): {}",
                node.display()
            );
            continue;
        }

        eprintln!(
            "bridge: using node={} script={}",
            node.display(),
            script.display()
        );
        return Ok(BridgePaths {
            node,
            script,
            cli_lib,
        });
    }

    Err(last_err)
}

fn spawn_bridge(paths: &BridgePaths) -> Result<(u16, std::process::Child), String> {
    if !paths.script.exists() {
        return Err(format!(
            "bridge script not found: {}",
            paths.script.display()
        ));
    }

    let mut cmd = Command::new(&paths.node);
    cmd.arg(&paths.script)
        .env("SKB_BRIDGE_NO_OPEN", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    if let Some(cli_lib) = &paths.cli_lib {
        cmd.env("SKB_CLI_LIB_ROOT", cli_lib);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn bridge ({}): {e}", paths.node.display()))?;

    let stdout = child.stdout.take().ok_or("bridge stdout missing")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|e| format!("failed to read bridge startup line: {e}"))?;

    let port_str = line
        .strip_prefix("BRIDGE_READY port=")
        .ok_or_else(|| format!("unexpected bridge output: {line}"))?
        .trim();

    let port: u16 = port_str
        .parse()
        .map_err(|e| format!("invalid bridge port '{port_str}': {e}"))?;

    Ok((port, child))
}

fn normalize_args(value: serde_json::Value) -> Vec<serde_json::Value> {
    match value {
        serde_json::Value::Array(items) => items,
        serde_json::Value::Null => vec![],
        other => vec![other],
    }
}

fn bridge_unavailable_message(state: &AppState) -> String {
    state.bridge_error.clone().unwrap_or_else(|| {
        "本地服务未启动，请重新安装或从 Releases 下载最新版 Skill Base Desktop".to_string()
    })
}

async fn bridge_call(
    state: &AppState,
    channel: &str,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let port = state
        .bridge_port
        .ok_or_else(|| bridge_unavailable_message(state))?;

    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{port}/invoke");
    let resp = client
        .post(url)
        .json(&serde_json::json!({ "channel": channel, "args": args }))
        .send()
        .await
        .map_err(|e| format!("bridge request failed: {e}"))?;

    let body: BridgeResponse = resp
        .json()
        .await
        .map_err(|e| format!("invalid bridge response: {e}"))?;

    if body.ok {
        Ok(body.result.unwrap_or(serde_json::Value::Null))
    } else {
        Err(body.error.unwrap_or_else(|| "bridge error".to_string()))
    }
}

fn expand_tilde(raw: &str) -> String {
    if let Some(rest) = raw.strip_prefix('~') {
        if let Some(home) = dirs_home() {
            let trimmed = rest.trim_start_matches(['/', '\\']);
            return format!("{home}/{trimmed}");
        }
    }
    raw.to_string()
}

fn dirs_home() -> Option<String> {
    std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())
}

async fn pick_folder_dialog(
    app: &AppHandle,
    title: &str,
    default: Option<String>,
) -> Option<String> {
    let (tx, rx) = oneshot::channel();
    let mut builder = app.dialog().file().set_title(title);
    if let Some(dir) = default.filter(|d| !d.is_empty()) {
        builder = builder.set_directory(dir);
    }
    builder.pick_folder(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    rx.await.ok().flatten()
}

async fn handle_pick_root(app: &AppHandle, state: &AppState) -> Result<serde_json::Value, String> {
    let default = bridge_call(state, "project:getRoot", vec![])
        .await
        .ok()
        .and_then(|v| v.as_str().map(str::to_string));

    let picked = pick_folder_dialog(app, "选择项目目录", default).await;

    let Some(path_str) = picked else {
        return Ok(serde_json::Value::Null);
    };

    bridge_call(
        state,
        "project:setRoot",
        vec![serde_json::Value::String(path_str.clone())],
    )
    .await?;
    Ok(serde_json::Value::String(path_str))
}

async fn handle_pick_install_dir(
    app: &AppHandle,
    state: &AppState,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let default = match args.first().and_then(|v| v.as_str().map(str::to_string)) {
        Some(path) => Some(path),
        None => bridge_call(state, "project:getRoot", vec![])
            .await
            .ok()
            .and_then(|v| v.as_str().map(str::to_string)),
    };

    let picked = pick_folder_dialog(app, "选择安装目录", default).await;
    Ok(match picked {
        Some(path) => serde_json::Value::String(path),
        None => serde_json::Value::Null,
    })
}

async fn handle_reveal_path(
    app: &AppHandle,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let raw = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or_else(|| "路径不能为空".to_string())?
        .trim();

    if raw.is_empty() {
        return Err("路径不能为空".to_string());
    }

    let expanded = expand_tilde(raw);
    let resolved = std::path::PathBuf::from(&expanded);
    if !resolved.exists() {
        return Err("路径不存在".to_string());
    }

    app.opener()
        .reveal_item_in_dir(resolved.to_string_lossy().to_string())
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "ok": true }))
}

async fn handle_open_login(app: &AppHandle, state: &AppState) -> Result<serde_json::Value, String> {
    let config = bridge_call(state, "config:get", vec![]).await?;
    let base_url = config
        .get("baseUrl")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim_end_matches('/');

    let url = format!("{base_url}/login?from=cli");
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::Value::Null)
}

async fn handle_open_web_page(
    app: &AppHandle,
    state: &AppState,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let payload = args.first().cloned().unwrap_or(serde_json::Value::Null);
    let result = bridge_call(state, "skills:openWebPage", vec![payload]).await?;
    if let Some(url) = result.get("url").and_then(|v| v.as_str()) {
        app.opener()
            .open_url(url.to_string(), None::<&str>)
            .map_err(|e| e.to_string())?;
    }
    Ok(result)
}

#[tauri::command]
async fn skb_invoke(
    app: AppHandle,
    state: State<'_, AppState>,
    channel: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = normalize_args(args);
    match channel.as_str() {
        "project:pickRoot" => handle_pick_root(&app, &state).await,
        "project:pickInstallDir" => handle_pick_install_dir(&app, &state, args).await,
        "shell:revealPath" => handle_reveal_path(&app, args).await,
        "auth:openLogin" => handle_open_login(&app, &state).await,
        "skills:openWebPage" => handle_open_web_page(&app, &state, args).await,
        other => bridge_call(&state, other, args).await,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = match resolve_bridge_paths(app.handle()).and_then(|paths| {
                spawn_bridge(&paths).map(|(port, child)| (port, child))
            }) {
                Ok((port, child)) => {
                    eprintln!("bridge ready on port {port}");
                    AppState {
                        bridge_port: Some(port),
                        bridge_error: None,
                        bridge_child: Mutex::new(Some(child)),
                    }
                }
                Err(e) => {
                    eprintln!("bridge failed to start: {e}");
                    AppState {
                        bridge_port: None,
                        bridge_error: Some(e),
                        bridge_child: Mutex::new(None),
                    }
                }
            };
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![skb_invoke])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if let Ok(mut guard) = state.bridge_child.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
