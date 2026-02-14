use tauri::{State, Manager};
use crate::db::AppDb;
use crate::models::*;
use crate::AuthState;
use crate::SessionUser;

// ── Helpers ─────────────────────────────────────────────

fn check_permission(auth: &State<'_, AuthState>, permission: &str) -> Result<(), String> {
    let user = auth.user.lock().unwrap();
    if let Some(u) = &*user {
        if u.role == "Admin" || u.permissions.contains(&permission.to_string()) {
            return Ok(());
        }
    }
    Err("Permission denied".to_string())
}

fn get_current_user_id(auth: &State<'_, AuthState>) -> Option<i64> {
    auth.user.lock().unwrap().as_ref().map(|u| u.id)
}

// ── Customers ──────────────────────────────────────────

#[tauri::command]
pub fn get_customers(db: State<'_, AppDb>) -> Result<Vec<Customer>, String> {
    // No specific permission required to view customers for now, or add 'view_customers'
    db.get_customers().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_customer(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    name: String,
    company: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    tax_id: Option<String>,
) -> Result<i64, String> {
    check_permission(&auth, "create_customers")?;
    
    let c = Customer {
        id: None,
        name: name.clone(),
        company,
        phone,
        email,
        address,
        tax_id,
        created_at: None,
    };
    let id = db.create_customer(&c).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Customer",
        Some(&id.to_string()),
        &format!("Created customer: {}", name)
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn update_customer(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    id: i64,
    name: String,
    company: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    tax_id: Option<String>,
) -> Result<(), String> {
    check_permission(&auth, "edit_customers")?;
    let c = Customer {
        id: Some(id),
        name: name.clone(),
        company,
        phone,
        email,
        address,
        tax_id,
        created_at: None,
    };
    db.update_customer(&c).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "UPDATE",
        "Customer",
        Some(&id.to_string()),
        &format!("Updated customer: {}", name)
    ).ok();

    Ok(())
}

#[tauri::command]
pub fn delete_customer(db: State<'_, AppDb>, auth: State<'_, AuthState>, id: i64) -> Result<(), String> {
    check_permission(&auth, "manage_customers")?;
    db.delete_customer(id).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "DELETE",
        "Customer",
        Some(&id.to_string()),
        "Deleted customer"
    ).ok();

    Ok(())
}

// ── Products ───────────────────────────────────────────

#[tauri::command]
pub fn get_products(db: State<'_, AppDb>) -> Result<Vec<Product>, String> {
    db.get_products().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_product(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    name: String,
    description: Option<String>,
    unit_price: f64,
    tax_percent: f64,
) -> Result<i64, String> {
    check_permission(&auth, "manage_products")?;
    let p = Product {
        id: None,
        name: name.clone(),
        description,
        unit_price,
        tax_percent,
    };
    let id = db.create_product(&p).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Product",
        Some(&id.to_string()),
        &format!("Created product: {}", name)
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn update_product(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    id: i64,
    name: String,
    description: Option<String>,
    unit_price: f64,
    tax_percent: f64,
) -> Result<(), String> {
    check_permission(&auth, "edit_products")?;
    let p = Product {
        id: Some(id),
        name: name.clone(),
        description,
        unit_price,
        tax_percent,
    };
    db.update_product(&p).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "UPDATE",
        "Product",
        Some(&id.to_string()),
        &format!("Updated product: {}", name)
    ).ok();

    Ok(())
}

#[tauri::command]
pub fn delete_product(db: State<'_, AppDb>, auth: State<'_, AuthState>, id: i64) -> Result<(), String> {
    check_permission(&auth, "delete_products")?;
    db.delete_product(id).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "DELETE",
        "Product",
        Some(&id.to_string()),
        "Deleted product"
    ).ok();

    Ok(())
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
    auth: State<'_, AuthState>,
    customer_id: i64,
    status: String,
    issue_date: String,
    due_date: String,
    notes: Option<String>,
    discount: f64,
    discount_percent: f64,
    advance: f64,
    items: Vec<InvoiceItem>,
) -> Result<i64, String> {
    check_permission(&auth, "create_invoice")?;
    let inv = Invoice {
        id: None,
        invoice_number: None,
        customer_id,
        customer_name: None,
        customer_phone: None,
        status,
        issue_date,
        due_date,
        notes,
        subtotal: 0.0,
        tax: 0.0,
        discount,
        discount_percent,
        advance,
        total: 0.0,
        created_at: None,
        items: None,
    };
    let id = db.create_invoice(&inv, &items).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Invoice",
        Some(&id.to_string()),
        "Created new invoice"
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn update_invoice_status(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    id: i64,
    status: String,
) -> Result<(), String> {
    check_permission(&auth, "edit_invoices")?; // Edit invoice permission
    db.update_invoice_status(id, &status)
        .map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "UPDATE_STATUS",
        "Invoice",
        Some(&id.to_string()),
        &format!("Updated invoice status to {}", status)
    ).ok();

    Ok(())
}

#[tauri::command]
pub fn delete_invoice(db: State<'_, AppDb>, auth: State<'_, AuthState>, id: i64) -> Result<(), String> {
    check_permission(&auth, "delete_invoices")?;
    db.delete_invoice(id).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "DELETE",
        "Invoice",
        Some(&id.to_string()),
        "Deleted invoice"
    ).ok();

    Ok(())
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
    auth: State<'_, AuthState>,
    business_name: String,
    business_address: Option<String>,
    business_phone: Option<String>,
    business_email: Option<String>,
    currency_symbol: String,
    tax_label: String,
    logo_path: Option<String>,
    default_footer: Option<String>,
    template_type: String,
    signature_path: Option<String>,
    bank_name: Option<String>,
    bank_account_name: Option<String>,
    bank_account_no: Option<String>,
    bank_branch: Option<String>,
    business_tagline: Option<String>,
    qr_code_path: Option<String>,
) -> Result<(), String> {
    check_permission(&auth, "manage_settings")?;
    let s = Settings {
        business_name: business_name.clone(),
        business_address,
        business_phone,
        business_email,
        currency_symbol,
        tax_label,
        logo_path,
        default_footer,
        template_type,
        signature_path,
        bank_name,
        bank_account_name,
        bank_account_no,
        bank_branch,
        business_tagline,
        qr_code_path,
    };
    db.update_settings(&s).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "UPDATE",
        "Settings",
        None,
        &format!("Updated business settings for {}", business_name)
    ).ok();

    Ok(())
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
    
    // Check if using a custom template
    let custom_template = if settings.template_type.starts_with("Custom-") {
        if let Ok(id) = settings.template_type.replace("Custom-", "").parse::<i64>() {
            db.get_custom_template(id).ok()
        } else { None }
    } else { None };
    
    crate::pdf::generate_invoice_pdf(&invoice, &settings, &file_path, custom_template.as_ref())
}

// ── Authentication ──────────────────────────────────────

#[tauri::command]
pub fn check_auth_initialized(db: State<'_, AppDb>) -> Result<bool, String> {
    db.has_any_user().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register(db: State<'_, AppDb>, auth: State<'_, AuthState>, username: String, password: String) -> Result<i64, String> {
    // Basic validation
    if username.trim().is_empty() || password.trim().is_empty() {
        return Err("Username and password are required".to_string());
    }

    // Role assignment
    let has_users = db.has_any_user().map_err(|e| e.to_string())?;
    let role = if !has_users { "Admin" } else { 
        check_permission(&auth, "manage_users")?;
        "User" 
    };

    // Check if user already exists
    if let Ok(Some(_)) = db.get_user_by_username(&username) {
        return Err("Username already exists".to_string());
    }

    // Hash password
    let hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

    let id = db.create_user(&username, &hash, role).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "REGISTER",
        "User",
        Some(&id.to_string()),
        &format!("Registered new user: {} with role {}", username, role)
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn login(db: State<'_, AppDb>, auth: State<'_, AuthState>, username: String, password: String) -> Result<SessionUser, String> {
    let user = db
        .get_user_by_username(&username)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Invalid username or password".to_string())?;

    let valid = bcrypt::verify(password, &user.password_hash).map_err(|e| e.to_string())?;

    if !valid {
        return Err("Invalid username or password".to_string());
    }

    let user_id = user.id.unwrap();
    let permissions = db.get_user_permissions(user_id).map_err(|e| e.to_string())?;
    
    let session_user = SessionUser {
        id: user_id,
        username: user.username.clone(),
        role: user.role.clone(),
        permissions,
    };

    // Store in global state
    let mut current_user = auth.user.lock().unwrap();
    *current_user = Some(session_user.clone());

    db.log_activity(
        Some(user_id),
        "LOGIN",
        "Session",
        None,
        &format!("User {} logged in", username)
    ).ok();

    Ok(session_user)
}

#[tauri::command]
pub fn logout(db: State<'_, AppDb>, auth: State<'_, AuthState>) -> Result<(), String> {
    let user_id = get_current_user_id(&auth);
    let mut current_user = auth.user.lock().unwrap();
    
    if let Some(u) = &*current_user {
        db.log_activity(
            user_id,
            "LOGOUT",
            "Session",
            None,
            &format!("User {} logged out", u.username)
        ).ok();
    }
    
    *current_user = None;
    Ok(())
}

#[tauri::command]
pub fn get_current_session(auth: State<'_, AuthState>) -> Result<Option<SessionUser>, String> {
    let user = auth.user.lock().unwrap();
    Ok(user.clone())
}

// ── Admin Commands ──────────────────────────────────────

#[tauri::command]
pub fn get_users(db: State<'_, AppDb>, auth: State<'_, AuthState>) -> Result<Vec<User>, String> {
    check_permission(&auth, "manage_users")?;
    db.get_users().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_user_permissions(db: State<'_, AppDb>, auth: State<'_, AuthState>, user_id: i64) -> Result<Vec<String>, String> {
    check_permission(&auth, "manage_users")?;
    db.get_user_permissions(user_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_user_permissions(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    user_id: i64,
    permissions: Vec<String>
) -> Result<(), String> {
    check_permission(&auth, "manage_users")?;
    db.update_user_permissions(user_id, permissions).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "UPDATE_PERMISSIONS",
        "User",
        Some(&user_id.to_string()),
        &format!("Updated permissions for user ID: {}", user_id)
    ).ok();

    Ok(())
}

#[tauri::command]
pub fn get_audit_logs(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    limit: i64,
    offset: i64,
    module: Option<String>,
    user_id: Option<i64>,
    date: Option<String>,
    month: Option<String>,
) -> Result<Vec<AuditLog>, String> {
    check_permission(&auth, "view_activity_logs")?;
    db.get_audit_logs(limit, offset, module, user_id, date, month).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn upload_logo(
    app: tauri::AppHandle,
    auth: State<'_, AuthState>,
    source_path: String,
) -> Result<String, String> {
    check_permission(&auth, "manage_settings")?;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let branding_dir = app_dir.join("branding");
    std::fs::create_dir_all(&branding_dir).map_err(|e| e.to_string())?;
    
    let extension = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
        
    let target_path = branding_dir.join(format!("logo.{}", extension));
    
    std::fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
    
    Ok(target_path.to_str().unwrap().to_string())
}

#[tauri::command]
pub fn upload_signature(
    app: tauri::AppHandle,
    auth: State<'_, AuthState>,
    source_path: String,
) -> Result<String, String> {
    check_permission(&auth, "manage_settings")?;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let branding_dir = app_dir.join("branding");
    std::fs::create_dir_all(&branding_dir).map_err(|e| e.to_string())?;
    
    let extension = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
        
    let target_path = branding_dir.join(format!("signature.{}", extension));
    
    std::fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
    
    Ok(target_path.to_str().unwrap().to_string())
}

#[tauri::command]
pub fn upload_qr_code(
    app: tauri::AppHandle,
    auth: State<'_, AuthState>,
    source_path: String,
) -> Result<String, String> {
    check_permission(&auth, "manage_settings")?;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let branding_dir = app_dir.join("branding");
    std::fs::create_dir_all(&branding_dir).map_err(|e| e.to_string())?;
    
    let extension = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
        
    let target_path = branding_dir.join(format!("qrcode.{}", extension));
    
    std::fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
    
    Ok(target_path.to_str().unwrap().to_string())
}
// ── Categories ─────────────────────────────────────────

#[tauri::command]
pub fn get_categories(db: State<'_, AppDb>) -> Result<Vec<Category>, String> {
    db.get_categories().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    name: String,
    category_type: String,
) -> Result<i64, String> {
    check_permission(&auth, "manage_settings")?;
    let c = Category { id: None, name: name.clone(), category_type };
    let id = db.create_category(&c).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Category",
        Some(&id.to_string()),
        &format!("Created category: {}", name)
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn delete_category(db: State<'_, AppDb>, auth: State<'_, AuthState>, id: i64) -> Result<(), String> {
    check_permission(&auth, "manage_settings")?;
    db.delete_category(id).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Accounts ───────────────────────────────────────────

#[tauri::command]
pub fn get_accounts(db: State<'_, AppDb>) -> Result<Vec<Account>, String> {
    db.get_accounts().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_account(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    name: String,
    account_type: String,
    balance: f64,
    currency: String,
) -> Result<i64, String> {
    check_permission(&auth, "manage_settings")?;
    let a = Account { id: None, name: name.clone(), account_type, balance, currency };
    let id = db.create_account(&a).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Account",
        Some(&id.to_string()),
        &format!("Created account: {}", name)
    ).ok();

    Ok(id)
}

// ── Transactions ───────────────────────────────────────

#[tauri::command]
pub fn get_transactions(db: State<'_, AppDb>, limit: i64) -> Result<Vec<Transaction>, String> {
    db.get_transactions(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_transaction(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    account_id: i64,
    category_id: Option<i64>,
    amount: f64,
    transaction_type: String,
    description: Option<String>,
    date: String,
    reference_id: Option<String>,
) -> Result<i64, String> {
    check_permission(&auth, "create_transactions")?;
    let t = Transaction {
        id: None,
        account_id,
        category_id,
        amount,
        transaction_type: transaction_type.clone(),
        description,
        date,
        reference_id,
        created_at: None,
    };
    let id = db.create_transaction(&t).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Transaction",
        Some(&id.to_string()),
        &format!("Recorded {} transaction of {}", transaction_type, amount)
    ).ok();

    Ok(id)
}

// ── Employees & Payroll ────────────────────────────────

#[tauri::command]
pub fn get_employees(db: State<'_, AppDb>) -> Result<Vec<Employee>, String> {
    db.get_employees().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_employee(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    name: String,
    role: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    salary: f64,
    allowances: Option<f64>,
) -> Result<i64, String> {
    check_permission(&auth, "manage_payroll")?;
    let e = Employee {
        id: None, name: name.clone(), role, email, phone, salary,
        allowances: allowances.unwrap_or(0.0),
        created_at: None,
    };
    let id = db.create_employee(&e).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Employee",
        Some(&id.to_string()),
        &format!("Added employee: {}", name)
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn update_employee(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    id: i64,
    name: String,
    role: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    salary: f64,
    allowances: Option<f64>,
) -> Result<(), String> {
    check_permission(&auth, "manage_payroll")?;
    let e = Employee {
        id: Some(id),
        name: name.clone(),
        role,
        email,
        phone,
        salary,
        allowances: allowances.unwrap_or(0.0),
        created_at: None,
    };
    db.update_employee(&e).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "UPDATE",
        "Employee",
        Some(&id.to_string()),
        &format!("Updated employee: {}", name)
    ).ok();

    Ok(())
}

#[tauri::command]
pub fn create_payroll(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    employee_id: i64,
    base_salary: f64,
    bonuses: f64,
    pay_period_start: String,
    pay_period_end: String,
    payment_date: String,
    status: String,
    notes: Option<String>,
) -> Result<i64, String> {
    check_permission(&auth, "manage_payroll")?;
    let net_pay = base_salary + bonuses;
    let p = PayrollRecord {
        id: None,
        employee_id,
        employee_name: None,
        employee_role: None,
        base_salary,
        overtime_pay: 0.0,
        bonuses,
        allowances: 0.0,
        gross_salary: net_pay,
        tax: 0.0,
        late_penalties: 0.0,
        absences: 0.0,
        other_deductions: 0.0,
        total_deductions: 0.0,
        net_pay,
        pay_period_start,
        pay_period_end,
        payment_date,
        status,
        notes,
    };
    let id = db.create_payroll(&p).map_err(|e| e.to_string())?;
    
    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Payroll",
        Some(&id.to_string()),
        &format!("Recorded payroll payment for employee ID: {}", employee_id)
    ).ok();

    Ok(id)
}

#[tauri::command]
pub fn create_bulk_payroll(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    pay_period_start: String,
    pay_period_end: String,
    payment_date: String,
    bonuses: f64,
) -> Result<i64, String> {
    check_permission(&auth, "manage_payroll")?;
    let employees = db.get_employees().map_err(|e| e.to_string())?;
    if employees.is_empty() {
        return Err("No employees found".to_string());
    }
    let mut count: i64 = 0;
    for emp in &employees {
        let base = emp.salary;
        let net_pay = base + bonuses;
        let p = PayrollRecord {
            id: None,
            employee_id: emp.id.unwrap_or(0),
            employee_name: None,
            employee_role: None,
            base_salary: base,
            overtime_pay: 0.0,
            bonuses,
            allowances: 0.0,
            gross_salary: net_pay,
            tax: 0.0,
            late_penalties: 0.0,
            absences: 0.0,
            other_deductions: 0.0,
            total_deductions: 0.0,
            net_pay,
            pay_period_start: pay_period_start.clone(),
            pay_period_end: pay_period_end.clone(),
            payment_date: payment_date.clone(),
            status: "Paid".to_string(),
            notes: None,
        };
        db.create_payroll(&p).map_err(|e| e.to_string())?;
        count += 1;
    }

    db.log_activity(
        get_current_user_id(&auth),
        "CREATE",
        "Payroll",
        None,
        &format!("Bulk payroll processed for {} employees", count)
    ).ok();

    Ok(count)
}

#[tauri::command]
pub fn get_payroll_summary(db: State<'_, AppDb>) -> Result<Vec<PayrollRecord>, String> {
    db.get_payroll_summary().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_payroll_detail(db: State<'_, AppDb>, id: i64) -> Result<PayrollRecord, String> {
    db.get_payroll_detail(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_payslip_pdf(
    db: State<'_, AppDb>,
    payroll_id: i64,
    file_path: String,
) -> Result<String, String> {
    let payroll = db.get_payroll_detail(payroll_id).map_err(|e| e.to_string())?;
    let settings = db.get_settings().map_err(|e| e.to_string())?;
    crate::pdf::generate_payslip_pdf(&payroll, &settings, &file_path)
}

// ── Reports & Export ─────────────────────────────────────

#[tauri::command]
pub fn get_cash_flow_report(db: State<'_, AppDb>, auth: State<'_, AuthState>) -> Result<Vec<CashFlowEntry>, String> {
    check_permission(&auth, "view_reports")?;
    db.get_cash_flow_report().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_category_report(db: State<'_, AppDb>, auth: State<'_, AuthState>) -> Result<Vec<CategoryReportEntry>, String> {
    check_permission(&auth, "view_reports")?;
    db.get_category_report().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_data_csv(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    module: String,
    path: String,
) -> Result<(), String> {
    check_permission(&auth, "manage_settings")?;
    
    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;

    match module.as_str() {
        "Customers" => {
            let data = db.get_customers().map_err(|e| e.to_string())?;
            wtr.write_record(&["ID", "Name", "Company", "Email", "Phone", "Tax ID"]).map_err(|e| e.to_string())?;
            for c in data {
                wtr.serialize((c.id, c.name, c.company, c.email, c.phone, c.tax_id)).map_err(|e| e.to_string())?;
            }
        },
        "Transactions" => {
            let data = db.get_transactions(10000).map_err(|e| e.to_string())?;
            wtr.write_record(&["ID", "Date", "Type", "Amount", "Description", "Ref ID"]).map_err(|e| e.to_string())?;
            for t in data {
                wtr.serialize((t.id, t.date, t.transaction_type, t.amount, t.description, t.reference_id)).map_err(|e| e.to_string())?;
            }
        },
        "Invoices" => {
            let data = db.get_invoices().map_err(|e| e.to_string())?;
            wtr.write_record(&["ID", "Number", "Customer", "Date", "Total", "Status"]).map_err(|e| e.to_string())?;
            for i in data {
                wtr.serialize((i.id, i.invoice_number, i.customer_name, i.issue_date, i.total, i.status)).map_err(|e| e.to_string())?;
            }
        },
        _ => return Err("Unsupported module for export".to_string()),
    }

    wtr.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn export_data_xlsx(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    module: String,
    path: String,
) -> Result<(), String> {
    check_permission(&auth, "manage_settings")?;
    
    let mut workbook = rust_xlsxwriter::Workbook::new();
    let worksheet = workbook.add_worksheet();

    match module.as_str() {
        "Transactions" => {
            let data = db.get_transactions(10000).map_err(|e| e.to_string())?;
            worksheet.write_string(0, 0, "ID").map_err(|e| e.to_string())?;
            worksheet.write_string(0, 1, "Date").map_err(|e| e.to_string())?;
            worksheet.write_string(0, 2, "Type").map_err(|e| e.to_string())?;
            worksheet.write_string(0, 3, "Amount").map_err(|e| e.to_string())?;
            worksheet.write_string(0, 4, "Description").map_err(|e| e.to_string())?;
            
            for (i, t) in data.iter().enumerate() {
                let row = (i + 1) as u32;
                worksheet.write_number(row, 0, t.id.unwrap_or(0) as f64).map_err(|e| e.to_string())?;
                worksheet.write_string(row, 1, &t.date).map_err(|e| e.to_string())?;
                worksheet.write_string(row, 2, &t.transaction_type).map_err(|e| e.to_string())?;
                worksheet.write_number(row, 3, t.amount).map_err(|e| e.to_string())?;
                worksheet.write_string(row, 4, t.description.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
            }
        },
        _ => return Err("Excel export currently supported for Transactions only".to_string()),
    }

    workbook.save(path).map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════════════════════════
//  ACTIVATION / LICENSING COMMANDS
// ══════════════════════════════════════════════════════════════════

use crate::models::ActivationStatus;
use serde_json::Value;

const FIREBASE_DB_URL: &str = "https://activation-145ea-default-rtdb.firebaseio.com";

fn get_machine_id() -> Result<String, String> {
    machine_uid::get()
        .map_err(|e| format!("Failed to get machine ID: {}", e))
}

#[tauri::command]
pub fn check_activation_status(db: State<'_, AppDb>) -> Result<ActivationStatus, String> {
    let machine_id = get_machine_id()?;
    
    // Check local activation first
    let local_info = db.get_activation_info().map_err(|e| e.to_string())?;
    
    if let Some(info) = local_info {
        // Verify machine ID matches (prevents copying DB to another machine)
        if info.machine_id == machine_id && info.is_active == 1 {
            return Ok(ActivationStatus {
                is_activated: true,
                activation_key: Some(info.activation_key),
                machine_id: Some(info.machine_id),
                activated_at: info.activated_at,
            });
        }
    }
    
    Ok(ActivationStatus {
        is_activated: false,
        activation_key: None,
        machine_id: Some(machine_id),
        activated_at: None,
    })
}

#[tauri::command]
pub async fn activate_with_key(db: State<'_, AppDb>, key: String) -> Result<ActivationStatus, String> {
    let key = key.trim().to_uppercase();
    
    if key.is_empty() {
        return Err("Activation key cannot be empty".to_string());
    }
    
    let machine_id = get_machine_id()?;
    
    // Step 1: Fetch the key from Firebase
    let url = format!("{}/activation_keys/{}.json", FIREBASE_DB_URL, key);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}. Please check your internet connection.", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to validate key: HTTP {}", response.status()));
    }
    
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Step 2: Check if key exists
    if body.is_null() {
        return Err("Invalid activation key. Please check and try again.".to_string());
    }
    
    // Step 3: Check if key is already used
    let used = body.get("used")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    if used {
        return Err("This activation key has already been used.".to_string());
    }
    
    // Step 4: Mark the key as used in Firebase
    let update_url = format!("{}/activation_keys/{}.json", FIREBASE_DB_URL, key);
    let update_body = serde_json::json!({
        "used": true,
        "machine_id": machine_id,
        "activated_at": chrono::Utc::now().to_rfc3339()
    });
    
    let update_response = client
        .patch(&update_url)
        .json(&update_body)
        .send()
        .await
        .map_err(|e| format!("Failed to update key status: {}", e))?;
    
    if !update_response.status().is_success() {
        return Err(format!("Failed to finalize activation: HTTP {}", update_response.status()));
    }
    
    // Step 5: Save activation locally
    db.save_activation(&key, &machine_id)
        .map_err(|e| format!("Failed to save activation locally: {}", e))?;
    
    Ok(ActivationStatus {
        is_activated: true,
        activation_key: Some(key),
        machine_id: Some(machine_id),
        activated_at: Some(chrono::Utc::now().to_rfc3339()),
    })
}

#[tauri::command]
pub fn verify_offline_activation(db: State<'_, AppDb>) -> Result<bool, String> {
    let machine_id = get_machine_id()?;
    db.verify_local_activation(&machine_id)
        .map_err(|e| e.to_string())
}

// ── Custom Templates ──────────────────────────────────

#[tauri::command]
pub fn get_custom_templates(db: State<'_, AppDb>) -> Result<Vec<CustomTemplate>, String> {
    db.get_custom_templates().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_custom_template(db: State<'_, AppDb>, id: i64) -> Result<CustomTemplate, String> {
    db.get_custom_template(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_custom_template(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    name: String,
    header_bg_color: String,
    header_text_color: String,
    accent_color: String,
    font_family: String,
    show_logo: bool,
    show_business_address: bool,
    show_business_phone: bool,
    show_business_email: bool,
    layout_style: String,
    header_position: String,
    table_style: String,
    show_tax_column: bool,
    show_description_column: bool,
    footer_text: Option<String>,
    border_style: String,
    border_color: String,
) -> Result<i64, String> {
    check_permission(&auth, "manage_templates")?;
    let template = CustomTemplate {
        id: None,
        name, header_bg_color, header_text_color, accent_color,
        font_family, show_logo, show_business_address, show_business_phone,
        show_business_email, layout_style, header_position, table_style,
        show_tax_column, show_description_column, footer_text,
        border_style, border_color, created_at: None,
    };
    db.create_custom_template(&template).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_custom_template(
    db: State<'_, AppDb>,
    auth: State<'_, AuthState>,
    id: i64,
    name: String,
    header_bg_color: String,
    header_text_color: String,
    accent_color: String,
    font_family: String,
    show_logo: bool,
    show_business_address: bool,
    show_business_phone: bool,
    show_business_email: bool,
    layout_style: String,
    header_position: String,
    table_style: String,
    show_tax_column: bool,
    show_description_column: bool,
    footer_text: Option<String>,
    border_style: String,
    border_color: String,
) -> Result<(), String> {
    check_permission(&auth, "manage_templates")?;
    let template = CustomTemplate {
        id: Some(id),
        name, header_bg_color, header_text_color, accent_color,
        font_family, show_logo, show_business_address, show_business_phone,
        show_business_email, layout_style, header_position, table_style,
        show_tax_column, show_description_column, footer_text,
        border_style, border_color, created_at: None,
    };
    db.update_custom_template(&template).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_custom_template(db: State<'_, AppDb>, auth: State<'_, AuthState>, id: i64) -> Result<(), String> {
    check_permission(&auth, "manage_templates")?;
    db.delete_custom_template(id).map_err(|e| e.to_string())
}
