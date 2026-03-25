// tray.rs — Native Windows system tray icon and menu
// Profile checkmarks, cognitive load in tooltip, left-click opens cockpit

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, CheckMenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager, Runtime,
};
use crate::profiles;

pub fn setup_tray<R: Runtime>(app: &mut App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let profile_names = profiles::list_profiles();

    let mut menu_builder = MenuBuilder::new(app);

    // Header (disabled label)
    let header = MenuItemBuilder::new("AEGIS — Cognitive Resource OS")
        .id("header")
        .enabled(false)
        .build(app)?;
    menu_builder = menu_builder.item(&header);

    // Separator
    menu_builder = menu_builder.separator();

    // Profile items
    for name in &profile_names {
        let is_idle = name == "idle";
        let item = CheckMenuItemBuilder::new(name.to_uppercase())
            .id(format!("profile_{}", name))
            .checked(is_idle)
            .build(app)?;
        menu_builder = menu_builder.item(&item);
    }

    menu_builder = menu_builder.separator();

    // Open cockpit
    let cockpit_item = MenuItemBuilder::new("Open Cockpit")
        .id("open_cockpit")
        .build(app)?;
    menu_builder = menu_builder.item(&cockpit_item);

    // Quit
    let quit_item = MenuItemBuilder::new("Quit AEGIS")
        .id("quit")
        .build(app)?;
    menu_builder = menu_builder.item(&quit_item);

    let menu = menu_builder.build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("AEGIS — idle")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("cockpit") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "open_cockpit" => {
                    if let Some(window) = app.get_webview_window("cockpit") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                id if id.starts_with("profile_") => {
                    let profile_name = id.trim_start_matches("profile_");
                    let app_clone = app.clone();
                    let profile_name_owned = profile_name.to_string();
                    tauri::async_runtime::spawn(async move {
                        if let Ok(profile) = profiles::load_profile(&profile_name_owned) {
                            let _ = profiles::apply_profile(&profile);
                            let _ = app_clone.emit("profile_changed", &profile_name_owned);
                            log::info!("Profile switched via tray: {}", profile_name_owned);
                        }
                    });
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
