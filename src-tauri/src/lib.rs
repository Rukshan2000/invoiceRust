mod commands;
mod db;
mod models;
mod pdf;

use tauri::Manager;
use db::AppDb;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Serialize, Deserialize};

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct SessionUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
}

pub struct AuthState {
    pub user: Mutex<Option<SessionUser>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AuthState {
            user: Mutex::new(None),
        })
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
            commands::check_auth_initialized,
            commands::register,
            commands::login,
            commands::logout,
            commands::get_current_session,
            commands::get_users,
            commands::get_user_permissions,
            commands::update_user_permissions,
            commands::get_audit_logs,
            commands::upload_logo,
            commands::upload_signature,
            commands::upload_qr_code,
            commands::get_categories,
            commands::create_category,
            commands::delete_category,
            commands::get_accounts,
            commands::create_account,
            commands::get_transactions,
            commands::create_transaction,
            commands::get_employees,
            commands::create_employee,
            commands::update_employee,
            commands::create_payroll,
            commands::create_bulk_payroll,
            commands::get_payroll_summary,
            commands::get_payroll_detail,
            commands::export_payslip_pdf,
            commands::get_cash_flow_report,
            commands::get_category_report,
            commands::export_data_csv,
            commands::export_data_xlsx,
            commands::check_activation_status,
            commands::activate_with_key,
            commands::verify_offline_activation,
            commands::get_custom_templates,
            commands::get_custom_template,
            commands::create_custom_template,
            commands::update_custom_template,
            commands::delete_custom_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
