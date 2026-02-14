use rusqlite::{params, Connection, Result as SqlResult};
use std::sync::Mutex;

use crate::models::*;

pub struct AppDb {
    pub conn: Mutex<Connection>,
}

impl AppDb {
    pub fn new(db_path: &str) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = AppDb {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                tax_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                unit_price REAL NOT NULL DEFAULT 0,
                tax_percent REAL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_number TEXT UNIQUE,
                customer_id INTEGER,
                status TEXT DEFAULT 'Draft',
                issue_date TEXT,
                due_date TEXT,
                notes TEXT,
                subtotal REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                discount_percent REAL DEFAULT 0,
                advance REAL DEFAULT 0,
                total REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER,
                product_name TEXT,
                description TEXT,
                quantity INTEGER DEFAULT 1,
                unit_price REAL DEFAULT 0,
                tax_percent REAL DEFAULT 0,
                line_total REAL DEFAULT 0,
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                business_name TEXT NOT NULL DEFAULT 'My Business',
                business_address TEXT,
                business_phone TEXT,
                business_email TEXT,
                currency_symbol TEXT DEFAULT '$',
                tax_label TEXT DEFAULT 'Tax',
                logo_path TEXT,
                default_footer TEXT,
                template_type TEXT DEFAULT 'Basic',
                signature_path TEXT,
                bank_name TEXT,
                bank_account_name TEXT,
                bank_account_no TEXT,
                bank_branch TEXT,
                business_tagline TEXT,
                qr_code_path TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'User'
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, permission_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category_type TEXT NOT NULL -- 'Income' or 'Expense'
            );

            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                account_type TEXT NOT NULL, -- 'Bank', 'Cash', 'Credit'
                balance REAL DEFAULT 0,
                currency TEXT DEFAULT '$'
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                category_id INTEGER,
                amount REAL NOT NULL,
                transaction_type TEXT NOT NULL, -- 'Income' or 'Expense'
                description TEXT,
                date TEXT NOT NULL,
                reference_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );

            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT,
                email TEXT,
                phone TEXT,
                salary REAL DEFAULT 0,
                allowances REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payroll (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                base_salary REAL NOT NULL DEFAULT 0,
                overtime_pay REAL DEFAULT 0,
                bonuses REAL DEFAULT 0,
                allowances REAL DEFAULT 0,
                gross_salary REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                late_penalties REAL DEFAULT 0,
                absences REAL DEFAULT 0,
                other_deductions REAL DEFAULT 0,
                total_deductions REAL DEFAULT 0,
                net_pay REAL NOT NULL DEFAULT 0,
                pay_period_start TEXT,
                pay_period_end TEXT,
                payment_date TEXT NOT NULL,
                status TEXT DEFAULT 'Paid',
                notes TEXT,
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                module TEXT NOT NULL,
                record_id TEXT,
                description TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS activation (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                activation_key TEXT NOT NULL,
                machine_id TEXT NOT NULL,
                activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS custom_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                header_bg_color TEXT DEFAULT '#1e40af',
                header_text_color TEXT DEFAULT '#ffffff',
                accent_color TEXT DEFAULT '#3b82f6',
                font_family TEXT DEFAULT 'Segoe UI',
                show_logo INTEGER DEFAULT 1,
                show_business_address INTEGER DEFAULT 1,
                show_business_phone INTEGER DEFAULT 1,
                show_business_email INTEGER DEFAULT 1,
                layout_style TEXT DEFAULT 'classic',
                header_position TEXT DEFAULT 'left',
                table_style TEXT DEFAULT 'striped',
                show_tax_column INTEGER DEFAULT 1,
                show_description_column INTEGER DEFAULT 1,
                footer_text TEXT,
                border_style TEXT DEFAULT 'solid',
                border_color TEXT DEFAULT '#e5e7eb',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Initial permissions
            INSERT OR IGNORE INTO permissions (name, description) VALUES 
                ('manage_users', 'Administer users and permissions'),
                ('view_logs', 'View system audit logs'),
                ('create_invoice', 'Create new invoices'),
                ('delete_invoice', 'Delete existing invoices'),
                ('manage_customers', 'Create, update or delete customers'),
                ('manage_products', 'Create, update or delete products'),
                ('manage_settings', 'Update business settings'),
                ('manage_transactions', 'Manage income and expenses'),
                ('manage_payroll', 'Manage employee payroll'),
                ('view_reports', 'View financial reports');

            -- Default accounts and categories
            INSERT OR IGNORE INTO accounts (id, name, account_type, balance) VALUES (1, 'Cash', 'Cash', 0);
            INSERT OR IGNORE INTO accounts (id, name, account_type, balance) VALUES (2, 'Bank Account', 'Bank', 0);

            INSERT OR IGNORE INTO categories (name, category_type) VALUES 
                ('Sales', 'Income'),
                ('Office Supplies', 'Expense'),
                ('Rent', 'Expense'),
                ('Utilities', 'Expense'),
                ('Salary', 'Expense'),
                ('Other', 'Expense');

            INSERT OR IGNORE INTO settings (id, business_name) VALUES (1, 'My Business');
            ",
        )?;

        // Migration: Add 'role' column to 'users' if it doesn't exist
        let has_role_col: bool = conn.query_row(
            "SELECT count(*) FROM pragma_table_info('users') WHERE name='role'",
            [],
            |row| row.get(0),
        ).unwrap_or(0) > 0;

        if !has_role_col {
            conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'User'", [])?;
            conn.execute("UPDATE users SET role = 'Admin' WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)", [])?;
            conn.execute("INSERT OR IGNORE INTO user_permissions (user_id, permission_id) SELECT u.id, p.id FROM users u CROSS JOIN permissions p WHERE u.role = 'Admin'", [])?;
        }

        // Migration for new settings and other tables
        let settings_cols: Vec<String> = conn.prepare("PRAGMA table_info('settings')")?
            .query_map([], |row| row.get(1))?
            .collect::<SqlResult<Vec<_>>>()?;

        if !settings_cols.contains(&"logo_path".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN logo_path TEXT", [])?;
        }
        if !settings_cols.contains(&"default_footer".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN default_footer TEXT", [])?;
        }
        if !settings_cols.contains(&"template_type".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN template_type TEXT DEFAULT 'Basic'", [])?;
        }
        if !settings_cols.contains(&"signature_path".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN signature_path TEXT", [])?;
        }
        if !settings_cols.contains(&"bank_name".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN bank_name TEXT", [])?;
        }
        if !settings_cols.contains(&"bank_account_name".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN bank_account_name TEXT", [])?;
        }
        if !settings_cols.contains(&"bank_account_no".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN bank_account_no TEXT", [])?;
        }
        if !settings_cols.contains(&"bank_branch".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN bank_branch TEXT", [])?;
        }
        if !settings_cols.contains(&"business_tagline".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN business_tagline TEXT", [])?;
        }
        if !settings_cols.contains(&"qr_code_path".to_string()) {
            conn.execute("ALTER TABLE settings ADD COLUMN qr_code_path TEXT", [])?;
        }

        // Migration for invoice advance and discount_percent columns
        let invoice_cols: Vec<String> = conn.prepare("PRAGMA table_info('invoices')")?
            .query_map([], |row| row.get(1))?
            .collect::<SqlResult<Vec<_>>>()?;

        if !invoice_cols.contains(&"discount_percent".to_string()) {
            conn.execute("ALTER TABLE invoices ADD COLUMN discount_percent REAL DEFAULT 0", [])?;
        }
        if !invoice_cols.contains(&"advance".to_string()) {
            conn.execute("ALTER TABLE invoices ADD COLUMN advance REAL DEFAULT 0", [])?;
        }

        // Migration for payroll expanded columns
        let payroll_cols: Vec<String> = conn.prepare("PRAGMA table_info('payroll')")?
            .query_map([], |row| row.get(1))?
            .collect::<SqlResult<Vec<_>>>()?;

        if !payroll_cols.contains(&"base_salary".to_string()) {
            conn.execute("ALTER TABLE payroll ADD COLUMN base_salary REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN overtime_pay REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN bonuses REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN allowances REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN gross_salary REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN tax REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN late_penalties REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN absences REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN other_deductions REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN total_deductions REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN net_pay REAL DEFAULT 0", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN pay_period_start TEXT", [])?;
            conn.execute("ALTER TABLE payroll ADD COLUMN pay_period_end TEXT", [])?;
            // Migrate existing records: set base_salary=amount, gross_salary=amount, net_pay=amount
            conn.execute("UPDATE payroll SET base_salary = amount, gross_salary = amount, net_pay = amount WHERE base_salary = 0 AND amount > 0", [])?;
        }

        // Migration for employee allowances field
        let emp_has_allowances: bool = conn.prepare("SELECT allowances FROM employees LIMIT 1")
            .is_ok();
        if !emp_has_allowances {
            conn.execute("ALTER TABLE employees ADD COLUMN allowances REAL DEFAULT 0", [])?;
        }

        // Ensure newly added permissions are assigned to Admins
        conn.execute(
            "INSERT OR IGNORE INTO user_permissions (user_id, permission_id) 
                SELECT u.id, p.id FROM users u CROSS JOIN permissions p 
                WHERE u.role = 'Admin'",
            [],
        )?;

        // Create default admin user if no users exist
        let user_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM users",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if user_count == 0 {
            // Hash password "admin" using bcrypt
            let password_hash = bcrypt::hash("admin", bcrypt::DEFAULT_COST)
                .expect("Failed to hash default password");
            
            conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?1, 'Admin')",
                params![password_hash],
            )?;

            // Grant all permissions to the admin user
            conn.execute(
                "INSERT OR IGNORE INTO user_permissions (user_id, permission_id) 
                    SELECT u.id, p.id FROM users u CROSS JOIN permissions p 
                    WHERE u.username = 'admin'",
                [],
            )?;
        }

        Ok(())
    }

    // ── Customers ──────────────────────────────────────────

    pub fn get_customers(&self) -> SqlResult<Vec<Customer>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, company, phone, email, address, tax_id, created_at FROM customers ORDER BY name"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                company: row.get(2)?,
                phone: row.get(3)?,
                email: row.get(4)?,
                address: row.get(5)?,
                tax_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_customer(&self, c: &Customer) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO customers (name, company, phone, email, address, tax_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![c.name, c.company, c.phone, c.email, c.address, c.tax_id],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_customer(&self, c: &Customer) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE customers SET name=?1, company=?2, phone=?3, email=?4, address=?5, tax_id=?6 WHERE id=?7",
            params![c.name, c.company, c.phone, c.email, c.address, c.tax_id, c.id],
        )?;
        Ok(())
    }

    pub fn delete_customer(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM customers WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── Products ───────────────────────────────────────────

    pub fn get_products(&self) -> SqlResult<Vec<Product>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, unit_price, tax_percent FROM products ORDER BY name"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                unit_price: row.get(3)?,
                tax_percent: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_product(&self, p: &Product) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO products (name, description, unit_price, tax_percent) VALUES (?1, ?2, ?3, ?4)",
            params![p.name, p.description, p.unit_price, p.tax_percent],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_product(&self, p: &Product) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE products SET name=?1, description=?2, unit_price=?3, tax_percent=?4 WHERE id=?5",
            params![p.name, p.description, p.unit_price, p.tax_percent, p.id],
        )?;
        Ok(())
    }

    pub fn delete_product(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM products WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── Invoices ───────────────────────────────────────────

    pub fn get_invoices(&self) -> SqlResult<Vec<Invoice>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT i.id, i.invoice_number, i.customer_id, c.name, c.phone, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tax, i.discount,
                    i.discount_percent, i.advance, i.total, i.created_at
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.id
             ORDER BY i.id DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                customer_id: row.get(2)?,
                customer_name: row.get(3)?,
                customer_phone: row.get(4)?,
                status: row.get(5)?,
                issue_date: row.get(6)?,
                due_date: row.get(7)?,
                notes: row.get(8)?,
                subtotal: row.get(9)?,
                tax: row.get(10)?,
                discount: row.get(11)?,
                discount_percent: row.get(12)?,
                advance: row.get(13)?,
                total: row.get(14)?,
                created_at: row.get(15)?,
                items: None,
            })
        })?;
        rows.collect()
    }

    pub fn get_invoice_detail(&self, id: i64) -> SqlResult<Invoice> {
        let conn = self.conn.lock().unwrap();
        let mut inv = conn.query_row(
            "SELECT i.id, i.invoice_number, i.customer_id, c.name, c.phone, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tax, i.discount,
                    i.discount_percent, i.advance, i.total, i.created_at
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.id
             WHERE i.id=?1",
            params![id],
            |row| {
                Ok(Invoice {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    customer_id: row.get(2)?,
                    customer_name: row.get(3)?,
                    customer_phone: row.get(4)?,
                    status: row.get(5)?,
                    issue_date: row.get(6)?,
                    due_date: row.get(7)?,
                    notes: row.get(8)?,
                    subtotal: row.get(9)?,
                    tax: row.get(10)?,
                    discount: row.get(11)?,
                    discount_percent: row.get(12)?,
                    advance: row.get(13)?,
                    total: row.get(14)?,
                    created_at: row.get(15)?,
                    items: None,
                })
            },
        )?;

        let mut stmt = conn.prepare(
            "SELECT id, invoice_id, product_name, description, quantity, unit_price, tax_percent, line_total
             FROM invoice_items WHERE invoice_id=?1"
        )?;
        let items: Vec<InvoiceItem> = stmt
            .query_map(params![id], |row| {
                Ok(InvoiceItem {
                    id: row.get(0)?,
                    invoice_id: row.get(1)?,
                    product_name: row.get(2)?,
                    description: row.get(3)?,
                    quantity: row.get(4)?,
                    unit_price: row.get(5)?,
                    tax_percent: row.get(6)?,
                    line_total: row.get(7)?,
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?;

        inv.items = Some(items);
        Ok(inv)
    }

    pub fn create_invoice(&self, inv: &Invoice, items: &[InvoiceItem]) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let inv_num = self.next_invoice_number_inner(&conn)?;

        // Calculate totals from items
        let mut subtotal = 0.0_f64;
        let mut tax_total = 0.0_f64;
        for item in items {
            let base = item.unit_price * item.quantity as f64;
            subtotal += base;
            tax_total += base * item.tax_percent / 100.0;
        }
        // Apply discount percent then subtract advance
        let discount_amount = if inv.discount_percent > 0.0 {
            (subtotal + tax_total) * inv.discount_percent / 100.0
        } else {
            inv.discount
        };
        let total = subtotal + tax_total - discount_amount - inv.advance;

        conn.execute(
            "INSERT INTO invoices (invoice_number, customer_id, status, issue_date, due_date, notes, subtotal, tax, discount, discount_percent, advance, total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                inv_num,
                inv.customer_id,
                inv.status,
                inv.issue_date,
                inv.due_date,
                inv.notes,
                subtotal,
                tax_total,
                discount_amount,
                inv.discount_percent,
                inv.advance,
                total,
            ],
        )?;
        let invoice_id = conn.last_insert_rowid();

        for item in items {
            let base = item.unit_price * item.quantity as f64;
            let item_tax = base * item.tax_percent / 100.0;
            let line_total = base + item_tax;
            conn.execute(
                "INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit_price, tax_percent, line_total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    invoice_id,
                    item.product_name,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    item.tax_percent,
                    line_total,
                ],
            )?;
        }

        Ok(invoice_id)
    }

    fn next_invoice_number_inner(&self, conn: &Connection) -> SqlResult<String> {
        let count: i64 = conn.query_row(
            "SELECT COALESCE(MAX(id), 0) FROM invoices",
            [],
            |row| row.get(0),
        )?;
        Ok(format!("INV-{:05}", count + 1))
    }

    pub fn update_invoice_status(&self, id: i64, status: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE invoices SET status=?1 WHERE id=?2",
            params![status, id],
        )?;
        Ok(())
    }

    pub fn delete_invoice(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM invoice_items WHERE invoice_id=?1", params![id])?;
        conn.execute("DELETE FROM invoices WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── Categories ─────────────────────────────────────────

    pub fn get_categories(&self) -> SqlResult<Vec<Category>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, category_type FROM categories ORDER BY name")?;
        let rows = stmt.query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                category_type: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_category(&self, c: &Category) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (name, category_type) VALUES (?1, ?2)",
            params![c.name, c.category_type],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_category(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM categories WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── Accounts ───────────────────────────────────────────

    pub fn get_accounts(&self) -> SqlResult<Vec<Account>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, account_type, balance, currency FROM accounts")?;
        let rows = stmt.query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
                currency: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_account(&self, a: &Account) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO accounts (name, account_type, balance, currency) VALUES (?1, ?2, ?3, ?4)",
            params![a.name, a.account_type, a.balance, a.currency],
        )?;
        Ok(conn.last_insert_rowid())
    }

    // ── Transactions ───────────────────────────────────────

    pub fn get_transactions(&self, limit: i64) -> SqlResult<Vec<Transaction>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, account_id, category_id, amount, transaction_type, description, date, reference_id, created_at 
             FROM transactions ORDER BY date DESC, id DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                category_id: row.get(2)?,
                amount: row.get(3)?,
                transaction_type: row.get(4)?,
                description: row.get(5)?,
                date: row.get(6)?,
                reference_id: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_transaction(&self, t: &Transaction) -> SqlResult<i64> {
        let mut conn_mu = self.conn.lock().unwrap();
        let tx = conn_mu.transaction()?;

        tx.execute(
            "INSERT INTO transactions (account_id, category_id, amount, transaction_type, description, date, reference_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![t.account_id, t.category_id, t.amount, t.transaction_type, t.description, t.date, t.reference_id],
        )?;

        let tx_id = tx.last_insert_rowid();

        // Update account balance
        let balance_change = if t.transaction_type == "Income" { t.amount } else { -t.amount };
        tx.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![balance_change, t.account_id],
        )?;

        tx.commit()?;
        Ok(tx_id)
    }

    // ── Employees & Payroll ────────────────────────────────

    pub fn get_employees(&self) -> SqlResult<Vec<Employee>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, role, email, phone, salary, allowances, created_at FROM employees ORDER BY name")?;
        let rows = stmt.query_map([], |row| {
            Ok(Employee {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                email: row.get(3)?,
                phone: row.get(4)?,
                salary: row.get(5)?,
                allowances: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_employee(&self, e: &Employee) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO employees (name, role, email, phone, salary, allowances) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![e.name, e.role, e.email, e.phone, e.salary, e.allowances],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_employee(&self, e: &Employee) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE employees SET name = ?1, role = ?2, email = ?3, phone = ?4, salary = ?5, allowances = ?6 WHERE id = ?7",
            params![e.name, e.role, e.email, e.phone, e.salary, e.allowances, e.id],
        )?;
        Ok(())
    }

    pub fn create_payroll(&self, p: &PayrollRecord) -> SqlResult<i64> {
        let mut conn_mu = self.conn.lock().unwrap();
        let tx = conn_mu.transaction()?;

        tx.execute(
            "INSERT INTO payroll (employee_id, base_salary, overtime_pay, bonuses, allowances, gross_salary, tax, late_penalties, absences, other_deductions, total_deductions, net_pay, pay_period_start, pay_period_end, payment_date, status, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![p.employee_id, p.base_salary, p.overtime_pay, p.bonuses, p.allowances, p.gross_salary, p.tax, p.late_penalties, p.absences, p.other_deductions, p.total_deductions, p.net_pay, p.pay_period_start, p.pay_period_end, p.payment_date, p.status, p.notes],
        )?;
        let payroll_id = tx.last_insert_rowid();

        // If status is Paid, automatically record an expense from Cash account (Account 1)
        if p.status == "Paid" {
            let employee_name: String = tx.query_row(
                "SELECT name FROM employees WHERE id = ?1",
                params![p.employee_id],
                |row| row.get(0),
            )?;

            tx.execute(
                "INSERT INTO transactions (account_id, amount, transaction_type, description, date, reference_id)
                 VALUES (1, ?1, 'Expense', ?2, ?3, ?4)",
                params![p.net_pay, format!("Salary: {}", employee_name), p.payment_date, format!("PAY-{}", payroll_id)],
            )?;

            tx.execute(
                "UPDATE accounts SET balance = balance - ?1 WHERE id = 1",
                params![p.net_pay],
            )?;
        }

        tx.commit()?;
        Ok(payroll_id)
    }

    pub fn get_payroll_summary(&self) -> SqlResult<Vec<PayrollRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.employee_id, e.name, e.role, p.base_salary, p.overtime_pay, p.bonuses, p.allowances, p.gross_salary, p.tax, p.late_penalties, p.absences, p.other_deductions, p.total_deductions, p.net_pay, p.pay_period_start, p.pay_period_end, p.payment_date, p.status, p.notes
             FROM payroll p LEFT JOIN employees e ON p.employee_id = e.id
             ORDER BY p.payment_date DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PayrollRecord {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                employee_name: row.get(2)?,
                employee_role: row.get(3)?,
                base_salary: row.get::<_, f64>(4).unwrap_or(0.0),
                overtime_pay: row.get::<_, f64>(5).unwrap_or(0.0),
                bonuses: row.get::<_, f64>(6).unwrap_or(0.0),
                allowances: row.get::<_, f64>(7).unwrap_or(0.0),
                gross_salary: row.get::<_, f64>(8).unwrap_or(0.0),
                tax: row.get::<_, f64>(9).unwrap_or(0.0),
                late_penalties: row.get::<_, f64>(10).unwrap_or(0.0),
                absences: row.get::<_, f64>(11).unwrap_or(0.0),
                other_deductions: row.get::<_, f64>(12).unwrap_or(0.0),
                total_deductions: row.get::<_, f64>(13).unwrap_or(0.0),
                net_pay: row.get::<_, f64>(14).unwrap_or(0.0),
                pay_period_start: row.get::<_, String>(15).unwrap_or_default(),
                pay_period_end: row.get::<_, String>(16).unwrap_or_default(),
                payment_date: row.get(17)?,
                status: row.get(18)?,
                notes: row.get(19)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_payroll_detail(&self, id: i64) -> SqlResult<PayrollRecord> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT p.id, p.employee_id, e.name, e.role, p.base_salary, p.overtime_pay, p.bonuses, p.allowances, p.gross_salary, p.tax, p.late_penalties, p.absences, p.other_deductions, p.total_deductions, p.net_pay, p.pay_period_start, p.pay_period_end, p.payment_date, p.status, p.notes
             FROM payroll p LEFT JOIN employees e ON p.employee_id = e.id
             WHERE p.id = ?1",
            params![id],
            |row| {
                Ok(PayrollRecord {
                    id: row.get(0)?,
                    employee_id: row.get(1)?,
                    employee_name: row.get(2)?,
                    employee_role: row.get(3)?,
                    base_salary: row.get::<_, f64>(4).unwrap_or(0.0),
                    overtime_pay: row.get::<_, f64>(5).unwrap_or(0.0),
                    bonuses: row.get::<_, f64>(6).unwrap_or(0.0),
                    allowances: row.get::<_, f64>(7).unwrap_or(0.0),
                    gross_salary: row.get::<_, f64>(8).unwrap_or(0.0),
                    tax: row.get::<_, f64>(9).unwrap_or(0.0),
                    late_penalties: row.get::<_, f64>(10).unwrap_or(0.0),
                    absences: row.get::<_, f64>(11).unwrap_or(0.0),
                    other_deductions: row.get::<_, f64>(12).unwrap_or(0.0),
                    total_deductions: row.get::<_, f64>(13).unwrap_or(0.0),
                    net_pay: row.get::<_, f64>(14).unwrap_or(0.0),
                    pay_period_start: row.get::<_, String>(15).unwrap_or_default(),
                    pay_period_end: row.get::<_, String>(16).unwrap_or_default(),
                    payment_date: row.get(17)?,
                    status: row.get(18)?,
                    notes: row.get(19)?,
                })
            },
        )
    }

    // ── Dashboard (Updated) ────────────────────────────────

    pub fn get_dashboard_stats(&self) -> SqlResult<DashboardStats> {
        let conn = self.conn.lock().unwrap();

        let total_revenue: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type='Income'",
            [], |row| row.get(0)
        )?;

        let total_expenses: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type='Expense'",
            [], |row| row.get(0)
        )?;

        let cash_in_hand: f64 = conn.query_row(
            "SELECT COALESCE(balance, 0) FROM accounts WHERE id=1",
            [], |row| row.get(0)
        ).unwrap_or(0.0);

        let bank_balance: f64 = conn.query_row(
            "SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE account_type='Bank'",
            [], |row| row.get(0)
        )?;

        let outstanding_amount: f64 = conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status IN ('Sent','Overdue')",
            [], |row| row.get(0)
        )?;

        let total_invoices: i64 = conn.query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))?;

        let mut stmt = conn.prepare(
            "SELECT i.id, i.invoice_number, i.customer_id, c.name, c.phone, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tax, i.discount,
                    i.discount_percent, i.advance, i.total, i.created_at
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.id
             ORDER BY i.id DESC LIMIT 5"
        )?;
        let recent: Vec<Invoice> = stmt.query_map([], |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                customer_id: row.get(2)?,
                customer_name: row.get(3)?,
                customer_phone: row.get(4)?,
                status: row.get(5)?,
                issue_date: row.get(6)?,
                due_date: row.get(7)?,
                notes: row.get(8)?,
                subtotal: row.get(9)?,
                tax: row.get(10)?,
                discount: row.get(11)?,
                discount_percent: row.get(12)?,
                advance: row.get(13)?,
                total: row.get(14)?,
                created_at: row.get(15)?,
                items: None,
            })
        })?.collect::<SqlResult<Vec<_>>>()?;

        Ok(DashboardStats {
            total_revenue,
            total_expenses,
            net_profit: total_revenue - total_expenses,
            cash_in_hand,
            bank_balance,
            outstanding_amount,
            total_invoices,
            recent_invoices: recent,
        })
    }

    // ── Settings ───────────────────────────────────────────

    pub fn get_settings(&self) -> SqlResult<Settings> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT business_name, business_address, business_phone, business_email, 
                    currency_symbol, tax_label, logo_path, default_footer, template_type,
                    signature_path, bank_name, bank_account_name, bank_account_no,
                    bank_branch, business_tagline, qr_code_path
             FROM settings WHERE id=1",
            [],
            |row| {
                Ok(Settings {
                    business_name: row.get(0)?,
                    business_address: row.get(1)?,
                    business_phone: row.get(2)?,
                    business_email: row.get(3)?,
                    currency_symbol: row.get(4)?,
                    tax_label: row.get(5)?,
                    logo_path: row.get(6)?,
                    default_footer: row.get(7)?,
                    template_type: row.get(8)?,
                    signature_path: row.get(9)?,
                    bank_name: row.get(10)?,
                    bank_account_name: row.get(11)?,
                    bank_account_no: row.get(12)?,
                    bank_branch: row.get(13)?,
                    business_tagline: row.get(14)?,
                    qr_code_path: row.get(15)?,
                })
            },
        )
    }

    pub fn update_settings(&self, s: &Settings) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET business_name=?1, business_address=?2, business_phone=?3, 
                                 business_email=?4, currency_symbol=?5, tax_label=?6,
                                 logo_path=?7, default_footer=?8, template_type=?9,
                                 signature_path=?10, bank_name=?11, bank_account_name=?12,
                                 bank_account_no=?13, bank_branch=?14, business_tagline=?15,
                                 qr_code_path=?16
             WHERE id=1",
            params![
                s.business_name, s.business_address, s.business_phone, 
                s.business_email, s.currency_symbol, s.tax_label,
                s.logo_path, s.default_footer, s.template_type,
                s.signature_path, s.bank_name, s.bank_account_name,
                s.bank_account_no, s.bank_branch, s.business_tagline,
                s.qr_code_path
            ],
        )?;
        Ok(())
    }

    // ── Authentication ──────────────────────────────────────

    pub fn has_any_user(&self) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
        Ok(count > 0)
    }

    pub fn create_user(&self, username: &str, password_hash: &str, role: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?1, ?2, ?3)",
            params![username, password_hash, role],
        )?;
        let user_id = conn.last_insert_rowid();

        // If Admin, auto-assign all permissions
        if role == "Admin" {
            conn.execute(
                "INSERT INTO user_permissions (user_id, permission_id) 
                 SELECT ?1, id FROM permissions",
                params![user_id],
            )?;
        }
        
        Ok(user_id)
    }

    pub fn get_user_by_username(&self, username: &str) -> SqlResult<Option<User>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?1")?;
        let user = stmt.query_row(params![username], |row| {
            Ok(User {
                id: Some(row.get(0)?),
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: row.get(3)?,
            })
        });

        match user {
            Ok(u) => Ok(Some(u)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_user_permissions(&self, user_id: i64) -> SqlResult<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.name FROM permissions p
             JOIN user_permissions up ON p.id = up.permission_id
             WHERE up.user_id = ?1"
        )?;
        let rows = stmt.query_map(params![user_id], |row| row.get(0))?;
        rows.collect()
    }

    pub fn log_activity(&self, user_id: Option<i64>, action: &str, module: &str, record_id: Option<&str>, description: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO audit_logs (user_id, action, module, record_id, description) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![user_id, action, module, record_id, description],
        )?;
        Ok(())
    }

    pub fn get_audit_logs(
        &self, 
        limit: i64, 
        offset: i64,
        module: Option<String>,
        user_id: Option<i64>,
        date: Option<String>, // YYYY-MM-DD
        month: Option<String>, // YYYY-MM
    ) -> SqlResult<Vec<AuditLog>> {
        let conn = self.conn.lock().unwrap();
        let mut query = String::from(
            "SELECT l.id, l.user_id, u.username, l.action, l.module, l.record_id, l.description, l.timestamp
             FROM audit_logs l
             LEFT JOIN users u ON l.user_id = u.id"
        );
        
        let mut conditions = Vec::new();
        if let Some(ref m) = module {
            conditions.push(format!("l.module = '{}'", m));
        }
        if let Some(uid) = user_id {
            conditions.push(format!("l.user_id = {}", uid));
        }
        if let Some(ref d) = date {
            conditions.push(format!("date(l.timestamp) = '{}'", d));
        }
        if let Some(ref m) = month {
            conditions.push(format!("strftime('%Y-%m', l.timestamp) = '{}'", m));
        }

        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }

        query.push_str(&format!(" ORDER BY l.timestamp DESC LIMIT {} OFFSET {}", limit, offset));

        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map([], |row| {
            Ok(AuditLog {
                id: Some(row.get(0)?),
                user_id: row.get(1)?,
                username: row.get(2)?,
                action: row.get(3)?,
                module: row.get(4)?,
                record_id: row.get(5)?,
                description: row.get(6)?,
                timestamp: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_users(&self) -> SqlResult<Vec<User>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, username, password_hash, role FROM users ORDER BY username")?;
        let rows = stmt.query_map([], |row| {
            Ok(User {
                id: Some(row.get(0)?),
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    pub fn update_user_permissions(&self, user_id: i64, permission_names: Vec<String>) -> SqlResult<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        tx.execute("DELETE FROM user_permissions WHERE user_id = ?1", params![user_id])?;

        for name in permission_names {
            tx.execute(
                "INSERT INTO user_permissions (user_id, permission_id)
                 SELECT ?1, id FROM permissions WHERE name = ?2",
                params![user_id, name],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_cash_flow_report(&self) -> SqlResult<Vec<CashFlowEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END) as expense
             FROM transactions
             GROUP BY month
             ORDER BY month DESC
             LIMIT 12"
        )?;
        let rows = stmt.query_map([], |row| {
            let income: f64 = row.get(1)?;
            let expense: f64 = row.get(2)?;
            Ok(CashFlowEntry {
                month: row.get(0)?,
                income,
                expense,
                net: income - expense,
            })
        })?;
        rows.collect()
    }

    pub fn get_category_report(&self) -> SqlResult<Vec<CategoryReportEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT 
                c.name, c.category_type, SUM(t.amount), COUNT(t.id)
             FROM categories c
             JOIN transactions t ON c.id = t.category_id
             GROUP BY c.id
             ORDER BY SUM(t.amount) DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(CategoryReportEntry {
                category_name: row.get(0)?,
                category_type: row.get(1)?,
                total_amount: row.get(2)?,
                count: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    // ── Activation Methods ──────────────────────────────────────

    pub fn is_activated(&self) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM activation WHERE id = 1 AND is_active = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn get_activation_info(&self) -> SqlResult<Option<ActivationInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT activation_key, machine_id, activated_at, is_active FROM activation WHERE id = 1"
        )?;
        
        let result = stmt.query_row([], |row| {
            Ok(ActivationInfo {
                activation_key: row.get(0)?,
                machine_id: row.get(1)?,
                activated_at: row.get(2)?,
                is_active: row.get(3)?,
            })
        });
        
        match result {
            Ok(info) => Ok(Some(info)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_activation(&self, key: &str, machine_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO activation (id, activation_key, machine_id, activated_at, is_active)
             VALUES (1, ?1, ?2, datetime('now'), 1)",
            params![key, machine_id],
        )?;
        Ok(())
    }

    pub fn verify_local_activation(&self, machine_id: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM activation WHERE id = 1 AND machine_id = ?1 AND is_active = 1",
            params![machine_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // ── Custom Templates ───────────────────────────────────

    pub fn get_custom_templates(&self) -> SqlResult<Vec<CustomTemplate>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, header_bg_color, header_text_color, accent_color, font_family,
                    show_logo, show_business_address, show_business_phone, show_business_email,
                    layout_style, header_position, table_style, show_tax_column,
                    show_description_column, footer_text, border_style, border_color, created_at
             FROM custom_templates ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(CustomTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                header_bg_color: row.get(2)?,
                header_text_color: row.get(3)?,
                accent_color: row.get(4)?,
                font_family: row.get(5)?,
                show_logo: row.get::<_, i32>(6)? != 0,
                show_business_address: row.get::<_, i32>(7)? != 0,
                show_business_phone: row.get::<_, i32>(8)? != 0,
                show_business_email: row.get::<_, i32>(9)? != 0,
                layout_style: row.get(10)?,
                header_position: row.get(11)?,
                table_style: row.get(12)?,
                show_tax_column: row.get::<_, i32>(13)? != 0,
                show_description_column: row.get::<_, i32>(14)? != 0,
                footer_text: row.get(15)?,
                border_style: row.get(16)?,
                border_color: row.get(17)?,
                created_at: row.get(18)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_custom_template(&self, id: i64) -> SqlResult<CustomTemplate> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, header_bg_color, header_text_color, accent_color, font_family,
                    show_logo, show_business_address, show_business_phone, show_business_email,
                    layout_style, header_position, table_style, show_tax_column,
                    show_description_column, footer_text, border_style, border_color, created_at
             FROM custom_templates WHERE id = ?1",
            params![id],
            |row| {
                Ok(CustomTemplate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    header_bg_color: row.get(2)?,
                    header_text_color: row.get(3)?,
                    accent_color: row.get(4)?,
                    font_family: row.get(5)?,
                    show_logo: row.get::<_, i32>(6)? != 0,
                    show_business_address: row.get::<_, i32>(7)? != 0,
                    show_business_phone: row.get::<_, i32>(8)? != 0,
                    show_business_email: row.get::<_, i32>(9)? != 0,
                    layout_style: row.get(10)?,
                    header_position: row.get(11)?,
                    table_style: row.get(12)?,
                    show_tax_column: row.get::<_, i32>(13)? != 0,
                    show_description_column: row.get::<_, i32>(14)? != 0,
                    footer_text: row.get(15)?,
                    border_style: row.get(16)?,
                    border_color: row.get(17)?,
                    created_at: row.get(18)?,
                })
            },
        )
    }

    pub fn create_custom_template(&self, t: &CustomTemplate) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO custom_templates (name, header_bg_color, header_text_color, accent_color,
                font_family, show_logo, show_business_address, show_business_phone, show_business_email,
                layout_style, header_position, table_style, show_tax_column, show_description_column,
                footer_text, border_style, border_color)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                t.name, t.header_bg_color, t.header_text_color, t.accent_color,
                t.font_family, t.show_logo as i32, t.show_business_address as i32,
                t.show_business_phone as i32, t.show_business_email as i32,
                t.layout_style, t.header_position, t.table_style,
                t.show_tax_column as i32, t.show_description_column as i32,
                t.footer_text, t.border_style, t.border_color
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_custom_template(&self, t: &CustomTemplate) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE custom_templates SET name=?1, header_bg_color=?2, header_text_color=?3,
                accent_color=?4, font_family=?5, show_logo=?6, show_business_address=?7,
                show_business_phone=?8, show_business_email=?9, layout_style=?10,
                header_position=?11, table_style=?12, show_tax_column=?13,
                show_description_column=?14, footer_text=?15, border_style=?16, border_color=?17
             WHERE id=?18",
            params![
                t.name, t.header_bg_color, t.header_text_color, t.accent_color,
                t.font_family, t.show_logo as i32, t.show_business_address as i32,
                t.show_business_phone as i32, t.show_business_email as i32,
                t.layout_style, t.header_position, t.table_style,
                t.show_tax_column as i32, t.show_description_column as i32,
                t.footer_text, t.border_style, t.border_color,
                t.id
            ],
        )?;
        Ok(())
    }

    pub fn delete_custom_template(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM custom_templates WHERE id = ?1", params![id])?;
        Ok(())
    }
}
