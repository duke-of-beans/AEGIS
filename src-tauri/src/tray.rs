// tray.rs — Ambient-first tray menu
// TRAY-01: live CPU/RAM stats in tooltip, updated every 2s by metrics poller.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager, Runtime,
};
use crate::profiles;

pub type OverrideState = Arc<Mutex<String>>;

pub struct CockpitState {
    pub visible: bool,
    pub last_toggle: Instant,
}
pub type CockpitVisible = Arc<Mutex<CockpitState>>;

pub fn setup_tray<R: Runtime>(app: &mut App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let profile_names = profiles::list_profiles();
    let override_state: OverrideState = Arc::new(Mutex::new(String::new()));
    let cockpit_visible: CockpitVisible = Arc::new(Mutex::new(CockpitState {
        visible: false,
        last_toggle: Instant::now() - Duration::from_secs(1),
    }));

    let menu = build_menu(app, &profile_names, "")?;

    let tray: TrayIcon<R> = TrayIconBuilder::with_id("tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("AEGIS — starting")
        .on_tray_icon_event({
            let _override_state = override_state.clone();
            let cockpit_visible = cockpit_visible.clone();
            move |tray, event| {
                if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("cockpit") {
                        let mut state = cockpit_visible.lock().unwrap();
                        if state.last_toggle.elapsed() < Duration::from_millis(500) { return; }
                        state.last_toggle = Instant::now();
                        if state.visible { let _ = window.hide(); state.visible = false; }
                        else { let _ = window.show(); let _ = window.set_focus(); state.visible = true; }
                    }
                }
            }
        })
        .on_menu_event({
            let override_state = override_state.clone();
            move |app, event| {
                let id = event.id().as_ref();
                match id {
                    "open_cockpit" => {
                        if let Some(window) = app.get_webview_window("cockpit") {
                            let _ = window.show(); let _ = window.set_focus();
                            if let Some(vis) = app.try_state::<CockpitVisible>() {
                                let mut s = vis.lock().unwrap();
                                s.visible = true; s.last_toggle = Instant::now();
                            }
                        }
                    }
                    "quit" => { app.exit(0); }
                    "release_override" => {
                        { let mut st = override_state.lock().unwrap(); *st = String::new(); }
                        let app_clone = app.clone(); let ov_clone = override_state.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Ok(profile) = profiles::load_profile("idle") { let _ = profiles::apply_profile(&profile); }
                            let _ = app_clone.emit("profile_changed", "");
                            rebuild_tray_menu(&app_clone, &ov_clone, "");
                        });
                    }
                    id if id.starts_with("profile_") => {
                        let profile_name = id.trim_start_matches("profile_").to_string();
                        { let mut st = override_state.lock().unwrap(); *st = profile_name.clone(); }
                        let app_clone = app.clone(); let ov_clone = override_state.clone(); let pname = profile_name.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Ok(profile) = profiles::load_profile(&pname) {
                                let _ = profiles::apply_profile(&profile);
                                let _ = app_clone.emit("profile_changed", &pname);
                                rebuild_tray_menu(&app_clone, &ov_clone, &pname);
                            }
                        });
                    }
                    _ => {}
                }
            }
        })
        .build(app)?;

    app.manage(TrayState(Arc::new(Mutex::new(Some(tray)))));
    app.manage(override_state);
    app.manage(cockpit_visible);
    Ok(())
}

pub struct TrayState<R: Runtime>(pub Arc<Mutex<Option<TrayIcon<R>>>>);

fn rebuild_tray_menu<R: Runtime, M: Manager<R>>(manager: &M, _override_state: &OverrideState, active_override: &str) {
    let profile_names = profiles::list_profiles();
    if let Ok(new_menu) = build_menu(manager, &profile_names, active_override) {
        if let Some(tray) = manager.try_state::<TrayState<R>>() {
            let guard = tray.0.lock().unwrap();
            if let Some(ref t) = *guard {
                let _ = t.set_menu(Some(new_menu));
                let tooltip = if active_override.is_empty() { "AEGIS — ambient".to_string() }
                              else { format!("AEGIS — override: {}", active_override) };
                let _ = t.set_tooltip(Some(&tooltip));
            }
        }
    }
}

fn build_menu<R: Runtime>(app: &impl Manager<R>, profile_names: &[String], active_override: &str) -> Result<tauri::menu::Menu<R>, Box<dyn std::error::Error>> {
    let is_override = !active_override.is_empty();
    let mut menu_builder = MenuBuilder::new(app);

    let header_label = if is_override { format!("OVERRIDE: {}", active_override.to_uppercase()) }
                       else { "AEGIS — Cognitive Resource OS".to_string() };
    let header = MenuItemBuilder::new(&header_label).id("header").enabled(false).build(app)?;
    menu_builder = menu_builder.item(&header);
    menu_builder = menu_builder.separator();

    let ambient_label = if is_override { "  Ambient mode paused" } else { "● Ambient — auto-managing" };
    let ambient_item = MenuItemBuilder::new(ambient_label).id("ambient_status").enabled(false).build(app)?;
    menu_builder = menu_builder.item(&ambient_item);
    menu_builder = menu_builder.separator();

    let mut sub_builder = SubmenuBuilder::new(app, "Manual Override");
    for name in profile_names {
        let is_active = is_override && name == active_override;
        let label = if is_active { format!("● {}", name) } else { format!("  {}", name) };
        let item = MenuItemBuilder::new(&label).id(format!("profile_{}", name)).build(app)?;
        sub_builder = sub_builder.item(&item);
    }
    if is_override {
        sub_builder = sub_builder.separator();
        let release = MenuItemBuilder::new("Release Override").id("release_override").build(app)?;
        sub_builder = sub_builder.item(&release);
    }
    let submenu = sub_builder.build()?;
    menu_builder = menu_builder.item(&submenu);
    menu_builder = menu_builder.separator();

    let cockpit_item = MenuItemBuilder::new("Open Cockpit").id("open_cockpit").build(app)?;
    menu_builder = menu_builder.item(&cockpit_item);
    let quit_item = MenuItemBuilder::new("Quit AEGIS").id("quit").build(app)?;
    menu_builder = menu_builder.item(&quit_item);

    Ok(menu_builder.build()?)
}

// ── TRAY-01: Update tooltip with live CPU/RAM stats ───────────────────────────
// Called every 2s by metrics.rs polling loop.
pub fn update_tray_metrics<R: Runtime, M: Manager<R>>(manager: &M, cpu_pct: f32, mem_pct: f32) {
    let tooltip = format!("AEGIS — CPU: {:.0}% | RAM: {:.0}%", cpu_pct, mem_pct);
    if let Some(tray) = manager.try_state::<TrayState<R>>() {
        let guard = tray.0.lock().unwrap();
        if let Some(ref t) = *guard {
            let _ = t.set_tooltip(Some(&tooltip));
        }
    }
}
