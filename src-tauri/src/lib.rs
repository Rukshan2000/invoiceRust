mod commands;
mod db;
mod models;
mod pdf;

use tauri::Manager;
use db::AppDb;
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Store DB in app data dir
            let app_dir: PathBuf = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("antigravity.db");

            let database = AppDb::new(db_path.to_str().unwrap())
                .expect("Failed to initialize database");

            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_customers,
            commands::create_customer,
            commands::update_customer,
            commands::delete_customer,
            commands::get_products,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::get_invoices,
            commands::get_invoice_detail,
            commands::create_invoice,
            commands::update_invoice_status,
            commands::delete_invoice,
            commands::get_dashboard_stats,
            commands::get_settings,
            commands::update_settings,
            commands::export_invoice_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
