use tauri::State;
use crate::db::AppDb;
use crate::models::*;

// ── Customers ──────────────────────────────────────────

#[tauri::command]
pub fn get_customers(db: State<'_, AppDb>) -> Result<Vec<Customer>, String> {
    db.get_customers().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_customer(
    db: State<'_, AppDb>,
    name: String,
    company: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    tax_id: Option<String>,
) -> Result<i64, String> {
    let c = Customer {
        id: None,
        name,
        company,
        phone,
        email,
        address,
        tax_id,
        created_at: None,
    };
    db.create_customer(&c).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_customer(
    db: State<'_, AppDb>,
    id: i64,
    name: String,
    company: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    tax_id: Option<String>,
) -> Result<(), String> {
    let c = Customer {
        id: Some(id),
        name,
        company,
        phone,
        email,
        address,
        tax_id,
        created_at: None,
    };
    db.update_customer(&c).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_customer(db: State<'_, AppDb>, id: i64) -> Result<(), String> {
    db.delete_customer(id).map_err(|e| e.to_string())
}

// ── Products ───────────────────────────────────────────

#[tauri::command]
pub fn get_products(db: State<'_, AppDb>) -> Result<Vec<Product>, String> {
    db.get_products().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_product(
    db: State<'_, AppDb>,
    name: String,
    description: Option<String>,
    unit_price: f64,
    tax_percent: f64,
) -> Result<i64, String> {
    let p = Product {
        id: None,
        name,
        description,
        unit_price,
        tax_percent,
    };
    db.create_product(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_product(
    db: State<'_, AppDb>,
    id: i64,
    name: String,
    description: Option<String>,
    unit_price: f64,
    tax_percent: f64,
) -> Result<(), String> {
    let p = Product {
        id: Some(id),
        name,
        description,
        unit_price,
        tax_percent,
    };
    db.update_product(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_product(db: State<'_, AppDb>, id: i64) -> Result<(), String> {
    db.delete_product(id).map_err(|e| e.to_string())
}

// ── Invoices ───────────────────────────────────────────

#[tauri::command]
pub fn get_invoices(db: State<'_, AppDb>) -> Result<Vec<Invoice>, String> {
    db.get_invoices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_invoice_detail(db: State<'_, AppDb>, id: i64) -> Result<Invoice, String> {
    db.get_invoice_detail(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_invoice(
    db: State<'_, AppDb>,
    customer_id: i64,
    status: String,
    issue_date: String,
    due_date: String,
    notes: Option<String>,
    discount: f64,
    items: Vec<InvoiceItem>,
) -> Result<i64, String> {
    let inv = Invoice {
        id: None,
        invoice_number: None,
        customer_id,
        customer_name: None,
        status,
        issue_date,
        due_date,
        notes,
        subtotal: 0.0,
        tax: 0.0,
        discount,
        total: 0.0,
        created_at: None,
        items: None,
    };
    db.create_invoice(&inv, &items).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_invoice_status(
    db: State<'_, AppDb>,
    id: i64,
    status: String,
) -> Result<(), String> {
    db.update_invoice_status(id, &status)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_invoice(db: State<'_, AppDb>, id: i64) -> Result<(), String> {
    db.delete_invoice(id).map_err(|e| e.to_string())
}

// ── Dashboard ──────────────────────────────────────────

#[tauri::command]
pub fn get_dashboard_stats(db: State<'_, AppDb>) -> Result<DashboardStats, String> {
    db.get_dashboard_stats().map_err(|e| e.to_string())
}

// ── Settings ───────────────────────────────────────────

#[tauri::command]
pub fn get_settings(db: State<'_, AppDb>) -> Result<Settings, String> {
    db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(
    db: State<'_, AppDb>,
    business_name: String,
    business_address: Option<String>,
    business_phone: Option<String>,
    business_email: Option<String>,
    currency_symbol: String,
    tax_label: String,
) -> Result<(), String> {
    let s = Settings {
        business_name,
        business_address,
        business_phone,
        business_email,
        currency_symbol,
        tax_label,
    };
    db.update_settings(&s).map_err(|e| e.to_string())
}

// ── PDF Export ──────────────────────────────────────────

#[tauri::command]
pub fn export_invoice_pdf(
    db: State<'_, AppDb>,
    invoice_id: i64,
    file_path: String,
) -> Result<String, String> {
    let invoice = db.get_invoice_detail(invoice_id).map_err(|e| e.to_string())?;
    let settings = db.get_settings().map_err(|e| e.to_string())?;
    crate::pdf::generate_invoice_pdf(&invoice, &settings, &file_path)
}
