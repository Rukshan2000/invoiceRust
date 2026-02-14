use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Customer {
    pub id: Option<i64>,
    pub name: String,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub tax_id: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub unit_price: f64,
    pub tax_percent: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvoiceItem {
    pub id: Option<i64>,
    pub invoice_id: Option<i64>,
    pub product_name: String,
    pub description: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
    pub tax_percent: f64,
    pub line_total: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Invoice {
    pub id: Option<i64>,
    pub invoice_number: Option<String>,
    pub customer_id: i64,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub status: String,
    pub issue_date: String,
    pub due_date: String,
    pub notes: Option<String>,
    pub subtotal: f64,
    pub tax: f64,
    pub discount: f64,
    pub discount_percent: f64,
    pub advance: f64,
    pub total: f64,
    pub created_at: Option<String>,
    pub items: Option<Vec<InvoiceItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: Option<i64>,
    pub name: String,
    pub category_type: String, // "Income" or "Expense"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: Option<i64>,
    pub name: String,
    pub account_type: String, // "Bank", "Cash", "Credit"
    pub balance: f64,
    pub currency: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub id: Option<i64>,
    pub account_id: i64,
    pub category_id: Option<i64>,
    pub amount: f64,
    pub transaction_type: String, // "Income" or "Expense"
    pub description: Option<String>,
    pub date: String,
    pub reference_id: Option<String>, // e.g., Invoice ID
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Employee {
    pub id: Option<i64>,
    pub name: String,
    pub role: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub salary: f64,
    pub allowances: f64,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PayrollRecord {
    pub id: Option<i64>,
    pub employee_id: i64,
    pub employee_name: Option<String>,
    pub employee_role: Option<String>,
    pub base_salary: f64,
    pub overtime_pay: f64,
    pub bonuses: f64,
    pub allowances: f64,
    pub gross_salary: f64,
    pub tax: f64,
    pub late_penalties: f64,
    pub absences: f64,
    pub other_deductions: f64,
    pub total_deductions: f64,
    pub net_pay: f64,
    pub pay_period_start: String,
    pub pay_period_end: String,
    pub payment_date: String,
    pub status: String, // "Paid", "Pending"
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_revenue: f64,
    pub total_expenses: f64,
    pub net_profit: f64,
    pub cash_in_hand: f64,
    pub bank_balance: f64,
    pub outstanding_amount: f64,
    pub total_invoices: i64,
    pub recent_invoices: Vec<Invoice>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub business_name: String,
    pub business_address: Option<String>,
    pub business_phone: Option<String>,
    pub business_email: Option<String>,
    pub currency_symbol: String,
    pub tax_label: String,
    pub logo_path: Option<String>,
    pub default_footer: Option<String>,
    pub template_type: String, // "Basic", "Professional", "Modern", "ClearStyle"
    pub signature_path: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account_name: Option<String>,
    pub bank_account_no: Option<String>,
    pub bank_branch: Option<String>,
    pub business_tagline: Option<String>,
    pub qr_code_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: Option<i64>,
    pub username: String,
    pub password_hash: String,
    pub role: String, // "Admin" or "User"
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CashFlowEntry {
    pub month: String,
    pub income: f64,
    pub expense: f64,
    pub net: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryReportEntry {
    pub category_name: String,
    pub category_type: String,
    pub total_amount: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: Option<i64>,
    pub user_id: Option<i64>,
    pub username: Option<String>, // Join for UI
    pub action: String,
    pub module: String,
    pub record_id: Option<String>,
    pub description: String,
    pub timestamp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivationInfo {
    pub activation_key: String,
    pub machine_id: String,
    pub activated_at: Option<String>,
    pub is_active: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivationStatus {
    pub is_activated: bool,
    pub activation_key: Option<String>,
    pub machine_id: Option<String>,
    pub activated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomTemplate {
    pub id: Option<i64>,
    pub name: String,
    pub header_bg_color: String,
    pub header_text_color: String,
    pub accent_color: String,
    pub font_family: String,
    pub show_logo: bool,
    pub show_business_address: bool,
    pub show_business_phone: bool,
    pub show_business_email: bool,
    pub layout_style: String,       // "classic", "modern", "minimal", "bold"
    pub header_position: String,     // "left", "center", "right"
    pub table_style: String,         // "striped", "bordered", "minimal", "clean"
    pub show_tax_column: bool,
    pub show_description_column: bool,
    pub footer_text: Option<String>,
    pub border_style: String,        // "solid", "dashed", "none"
    pub border_color: String,
    pub created_at: Option<String>,
}
