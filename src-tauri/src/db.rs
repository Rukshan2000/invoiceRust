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
                tax_label TEXT DEFAULT 'Tax'
            );

            INSERT OR IGNORE INTO settings (id, business_name) VALUES (1, 'My Business');
            ",
        )?;
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

    fn next_invoice_number(&self, conn: &Connection) -> SqlResult<String> {
        let count: i64 = conn.query_row(
            "SELECT COALESCE(MAX(id), 0) FROM invoices",
            [],
            |row| row.get(0),
        )?;
        Ok(format!("INV-{:05}", count + 1))
    }

    pub fn get_invoices(&self) -> SqlResult<Vec<Invoice>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT i.id, i.invoice_number, i.customer_id, c.name, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tax, i.discount, i.total, i.created_at
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
                status: row.get(4)?,
                issue_date: row.get(5)?,
                due_date: row.get(6)?,
                notes: row.get(7)?,
                subtotal: row.get(8)?,
                tax: row.get(9)?,
                discount: row.get(10)?,
                total: row.get(11)?,
                created_at: row.get(12)?,
                items: None,
            })
        })?;
        rows.collect()
    }

    pub fn get_invoice_detail(&self, id: i64) -> SqlResult<Invoice> {
        let conn = self.conn.lock().unwrap();
        let mut inv = conn.query_row(
            "SELECT i.id, i.invoice_number, i.customer_id, c.name, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tax, i.discount, i.total, i.created_at
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
                    status: row.get(4)?,
                    issue_date: row.get(5)?,
                    due_date: row.get(6)?,
                    notes: row.get(7)?,
                    subtotal: row.get(8)?,
                    tax: row.get(9)?,
                    discount: row.get(10)?,
                    total: row.get(11)?,
                    created_at: row.get(12)?,
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
        let total = subtotal + tax_total - inv.discount;

        conn.execute(
            "INSERT INTO invoices (invoice_number, customer_id, status, issue_date, due_date, notes, subtotal, tax, discount, total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                inv_num,
                inv.customer_id,
                inv.status,
                inv.issue_date,
                inv.due_date,
                inv.notes,
                subtotal,
                tax_total,
                inv.discount,
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

    // ── Dashboard ──────────────────────────────────────────

    pub fn get_dashboard_stats(&self) -> SqlResult<DashboardStats> {
        let conn = self.conn.lock().unwrap();

        let total_revenue: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status='Paid'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let outstanding_amount: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status IN ('Sent','Overdue')",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let total_invoices: i64 = conn
            .query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))
            .unwrap_or(0);

        let paid_invoices: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM invoices WHERE status='Paid'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let overdue_invoices: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM invoices WHERE status='Overdue'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let draft_invoices: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM invoices WHERE status='Draft'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Recent 5 invoices
        let mut stmt = conn.prepare(
            "SELECT i.id, i.invoice_number, i.customer_id, c.name, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tax, i.discount, i.total, i.created_at
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.id
             ORDER BY i.id DESC LIMIT 5"
        )?;
        let recent: Vec<Invoice> = stmt
            .query_map([], |row| {
                Ok(Invoice {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    customer_id: row.get(2)?,
                    customer_name: row.get(3)?,
                    status: row.get(4)?,
                    issue_date: row.get(5)?,
                    due_date: row.get(6)?,
                    notes: row.get(7)?,
                    subtotal: row.get(8)?,
                    tax: row.get(9)?,
                    discount: row.get(10)?,
                    total: row.get(11)?,
                    created_at: row.get(12)?,
                    items: None,
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?;

        Ok(DashboardStats {
            total_revenue,
            outstanding_amount,
            total_invoices,
            paid_invoices,
            overdue_invoices,
            draft_invoices,
            recent_invoices: recent,
        })
    }

    // ── Settings ───────────────────────────────────────────

    pub fn get_settings(&self) -> SqlResult<Settings> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT business_name, business_address, business_phone, business_email, currency_symbol, tax_label FROM settings WHERE id=1",
            [],
            |row| {
                Ok(Settings {
                    business_name: row.get(0)?,
                    business_address: row.get(1)?,
                    business_phone: row.get(2)?,
                    business_email: row.get(3)?,
                    currency_symbol: row.get(4)?,
                    tax_label: row.get(5)?,
                })
            },
        )
    }

    pub fn update_settings(&self, s: &Settings) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET business_name=?1, business_address=?2, business_phone=?3, business_email=?4, currency_symbol=?5, tax_label=?6 WHERE id=1",
            params![s.business_name, s.business_address, s.business_phone, s.business_email, s.currency_symbol, s.tax_label],
        )?;
        Ok(())
    }
}
