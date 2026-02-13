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
    pub status: String,
    pub issue_date: String,
    pub due_date: String,
    pub notes: Option<String>,
    pub subtotal: f64,
    pub tax: f64,
    pub discount: f64,
    pub total: f64,
    pub created_at: Option<String>,
    pub items: Option<Vec<InvoiceItem>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_revenue: f64,
    pub outstanding_amount: f64,
    pub total_invoices: i64,
    pub paid_invoices: i64,
    pub overdue_invoices: i64,
    pub draft_invoices: i64,
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
}
