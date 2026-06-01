use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct AppState {
    bridge_port: Option<u16>,
    bridge_error: Option<String>,
    bridge_child: Mutex<Option<std::process::Child>>,
    log_path: PathBuf,
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

#[cfg(windows)]
fn runtime_node_binary(app: &AppHandle, source: &Path) -> Result<PathBuf, String> {
    let size = source
        .metadata()
        .map_err(|e| format!("failed to stat bundled Node {}: {e}", source.display()))?
        .len();
    let cache_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("skill-base-desktop-cache"))
        .join("runtime-node");
    std::fs::create_dir_all(&cache_dir).map_err(|e| {
        format!(
            "failed to create runtime Node dir {}: {e}",
            cache_dir.display()
        )
    })?;

    let runtime_node = cache_dir.join(format!("node-{size}.exe"));
    if !is_real_node_binary(&runtime_node) {
        std::fs::copy(source, &runtime_node).map_err(|e| {
            format!(
                "failed to copy runtime Node {} -> {}: {e}",
                source.display(),
                runtime_node.display()
            )
        })?;
    }
    Ok(runtime_node)
}

#[cfg(not(windows))]
fn runtime_node_binary(_app: &AppHandle, source: &Path) -> Result<PathBuf, String> {
    Ok(source.to_path_buf())
}

fn resolve_bridge_paths(app: &AppHandle, log_path: &Path) -> Result<BridgePaths, String> {
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
    append_desktop_log(
        log_path,
        &format!(
            "resolving bridge resources resource_dir={}",
            resource_dir.display()
        ),
    );

    for base in &bases {
        let bundled_node = packaged_node_binary(base);
        let script = base.join("bridge").join("server.mjs");
        let cli_lib_dir = base.join("cli-lib");
        let cli_lib = cli_lib_dir.exists().then_some(cli_lib_dir);

        if !script.exists() {
            last_err = format!("bridge script not found: {}", script.display());
            append_desktop_log(log_path, &last_err);
            continue;
        }
        if !is_real_node_binary(&bundled_node) {
            last_err = format!(
                "bundled Node missing or invalid (need portable Node binary): {}",
                bundled_node.display()
            );
            append_desktop_log(log_path, &last_err);
            continue;
        }
        let node = runtime_node_binary(app, &bundled_node)?;

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

fn desktop_log_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_log_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("skill-base-desktop"))
        .join("desktop.log")
}

fn append_desktop_log(log_path: &Path, message: &str) {
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let _ = writeln!(file, "[{ts}] {message}");
    }
}

fn spawn_bridge(
    paths: &BridgePaths,
    log_path: &Path,
) -> Result<(u16, std::process::Child), String> {
    if !paths.script.exists() {
        return Err(format!(
            "bridge script not found: {}",
            paths.script.display()
        ));
    }

    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create log dir {}: {e}", parent.display()))?;
    }
    let stderr_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| format!("failed to open log {}: {e}", log_path.display()))?;

    let mut cmd = Command::new(&paths.node);
    cmd.arg(&paths.script)
        .env("SKB_BRIDGE_NO_OPEN", "1")
        .env("SKB_DESKTOP_LOG", log_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::from(stderr_log));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(cli_lib) = &paths.cli_lib {
        cmd.env("SKB_CLI_LIB_ROOT", cli_lib);
    }

    append_desktop_log(
        log_path,
        &format!(
            "starting bridge node={} script={}",
            paths.node.display(),
            paths.script.display()
        ),
    );

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

    append_desktop_log(log_path, &format!("bridge ready port={port}"));
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

fn bridge_response_snippet(body: &str) -> String {
    const MAX_LEN: usize = 500;
    let one_line = body.replace(['\r', '\n'], " ");
    if one_line.chars().count() <= MAX_LEN {
        return one_line;
    }
    let prefix: String = one_line.chars().take(MAX_LEN).collect();
    format!("{prefix}...")
}

fn format_invalid_bridge_response_error(
    channel: &str,
    status: u16,
    body: &str,
    decode_error: &str,
) -> String {
    format!(
        "channel={channel} status={status}: {decode_error}; body={}",
        bridge_response_snippet(body)
    )
}

fn bridge_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("failed to create bridge HTTP client: {e}"))
}

async fn bridge_call(
    state: &AppState,
    channel: &str,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let port = state
        .bridge_port
        .ok_or_else(|| bridge_unavailable_message(state))?;

    let client = bridge_http_client()?;
    let url = format!("http://127.0.0.1:{port}/invoke");
    let resp = client
        .post(url)
        .json(&serde_json::json!({ "channel": channel, "args": args }))
        .send()
        .await
        .map_err(|e| {
            append_desktop_log(
                &state.log_path,
                &format!("bridge request failed channel={channel}: {e}"),
            );
            format!("bridge request failed: {e}")
        })?;

    let status = resp.status().as_u16();
    let text = resp.text().await.map_err(|e| {
        append_desktop_log(
            &state.log_path,
            &format!("failed to read bridge response channel={channel} status={status}: {e}"),
        );
        format!("failed to read bridge response: {e}")
    })?;

    let body: BridgeResponse = serde_json::from_str(&text).map_err(|e| {
        let detail = format_invalid_bridge_response_error(channel, status, &text, &e.to_string());
        append_desktop_log(
            &state.log_path,
            &format!("invalid bridge response {detail}"),
        );
        format!("invalid bridge response: {detail}")
    })?;

    if body.ok {
        Ok(body.result.unwrap_or(serde_json::Value::Null))
    } else {
        let error = body.error.unwrap_or_else(|| "bridge error".to_string());
        append_desktop_log(
            &state.log_path,
            &format!("bridge handler failed channel={channel}: {error}"),
        );
        Err(error)
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
            let log_path = desktop_log_path(app.handle());
            append_desktop_log(&log_path, "desktop starting");
            let state = match resolve_bridge_paths(app.handle(), &log_path).and_then(|paths| {
                spawn_bridge(&paths, &log_path).map(|(port, child)| (port, child))
            }) {
                Ok((port, child)) => {
                    eprintln!("bridge ready on port {port}");
                    AppState {
                        bridge_port: Some(port),
                        bridge_error: None,
                        bridge_child: Mutex::new(Some(child)),
                        log_path,
                    }
                }
                Err(e) => {
                    eprintln!("bridge failed to start: {e}");
                    append_desktop_log(&log_path, &format!("bridge failed to start: {e}"));
                    AppState {
                        bridge_port: None,
                        bridge_error: Some(e),
                        bridge_child: Mutex::new(None),
                        log_path,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn invalid_bridge_response_error_includes_status_and_body_snippet() {
        let message = format_invalid_bridge_response_error(
            "skills:getInstalled",
            502,
            "<html><body>bad gateway from proxy</body></html>",
            "expected value at line 1 column 1",
        );

        assert!(message.contains("channel=skills:getInstalled"));
        assert!(message.contains("status=502"));
        assert!(message.contains("<html><body>bad gateway"));
    }

    #[test]
    fn bridge_response_snippet_truncates_utf8_without_panicking() {
        let body = "错".repeat(600);

        let snippet = bridge_response_snippet(&body);

        assert!(snippet.ends_with("..."));
        assert!(snippet.chars().count() <= 503);
    }

    fn spawn_one_shot_http_server(response: &'static str) -> (u16, mpsc::Receiver<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = mpsc::channel();

        std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let _ = tx.send(());
                let mut buffer = [0_u8; 1024];
                let _ = stream.read(&mut buffer);
                let _ = stream.write_all(response.as_bytes());
            }
        });

        (port, rx)
    }

    #[tokio::test]
    async fn bridge_call_does_not_send_loopback_ipc_through_http_proxy() {
        let target_response = concat!(
            "HTTP/1.1 200 OK\r\n",
            "Content-Type: application/json\r\n",
            "Connection: close\r\n",
            "\r\n",
            "{\"ok\":true,\"result\":\"local\"}"
        );
        let proxy_response = concat!(
            "HTTP/1.1 504 Gateway Timeout\r\n",
            "Content-Type: text/html\r\n",
            "Connection: close\r\n",
            "\r\n",
            "<html>proxy</html>"
        );
        let (target_port, target_hit) = spawn_one_shot_http_server(target_response);
        let (proxy_port, proxy_hit) = spawn_one_shot_http_server(proxy_response);

        let old_http_proxy = std::env::var_os("HTTP_PROXY");
        let old_http_proxy_lower = std::env::var_os("http_proxy");
        let old_no_proxy = std::env::var_os("NO_PROXY");
        let old_no_proxy_lower = std::env::var_os("no_proxy");

        std::env::set_var("HTTP_PROXY", format!("http://127.0.0.1:{proxy_port}"));
        std::env::set_var("http_proxy", format!("http://127.0.0.1:{proxy_port}"));
        std::env::remove_var("NO_PROXY");
        std::env::remove_var("no_proxy");

        let state = AppState {
            bridge_port: Some(target_port),
            bridge_error: None,
            bridge_child: Mutex::new(None),
            log_path: std::env::temp_dir().join("skill-base-bridge-proxy-test.log"),
        };

        let result = bridge_call(&state, "config:get", vec![]).await;

        restore_env_var("HTTP_PROXY", old_http_proxy);
        restore_env_var("http_proxy", old_http_proxy_lower);
        restore_env_var("NO_PROXY", old_no_proxy);
        restore_env_var("no_proxy", old_no_proxy_lower);

        assert_eq!(
            result.unwrap(),
            serde_json::Value::String("local".to_string())
        );
        assert!(target_hit.recv_timeout(Duration::from_secs(1)).is_ok());
        assert!(proxy_hit.recv_timeout(Duration::from_millis(100)).is_err());
    }

    fn restore_env_var(key: &str, value: Option<std::ffi::OsString>) {
        match value {
            Some(value) => std::env::set_var(key, value),
            None => std::env::remove_var(key),
        }
    }
}
