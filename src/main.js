/* ══════════════════════════════════════════════════════════
   Antigravity Billing Manager — Frontend Application
   Hash-based SPA with Tauri IPC
   ══════════════════════════════════════════════════════════ */

const { invoke } = (window.__TAURI__ && window.__TAURI__.core) ? window.__TAURI__.core : { invoke: () => Promise.reject("Tauri not ready") };

// ── Error resilience ────────────────────────────────────
window.onerror = function(msg, url, line, col, error) {
  const errorMsg = `JS Error: ${msg} at ${line}:${col}`;
  console.error(errorMsg, error);
  // Try to show toast if possible, otherwise alert
  try { toast(errorMsg, 'error'); } catch(e) { alert(errorMsg); }
  return false;
};

window.onunhandledrejection = function(event) {
  const errorMsg = `Promise Rejection: ${event.reason}`;
  console.error(errorMsg);
  try { toast(errorMsg, 'error'); } catch(e) { alert(errorMsg); }
};

// ── Window Controls ─────────────────────────────────────

let appWindow = null;
try {
  if (window.__TAURI__ && window.__TAURI__.window) {
    appWindow = window.__TAURI__.window.getCurrentWindow();
  }
} catch (e) {
  console.error('Failed to get current window', e);
}

function initWindowControls() {
  try {
    const minBtn = document.getElementById('titlebar-minimize');
    const maxBtn = document.getElementById('titlebar-maximize');
    const closeBtn = document.getElementById('titlebar-close');

    if (minBtn && appWindow) {
      minBtn.addEventListener('click', () => appWindow.minimize());
    }
    if (maxBtn && appWindow) {
      maxBtn.addEventListener('click', () => appWindow.toggleMaximize());
    }
    if (closeBtn && appWindow) {
      closeBtn.addEventListener('click', () => appWindow.close());
    }
  } catch (e) {
    console.error('Failed to initialize custom window controls', e);
  }
}

// ── Helpers ─────────────────────────────────────────────

function $(sel) {
  try {
    return document.querySelector(sel);
  } catch(e) {
    console.error(`Selector failed: ${sel}`, e);
    return null;
  }
}
function $$(sel) {
  try {
    return document.querySelectorAll(sel);
  } catch(e) {
    console.error(`Selector failed: ${sel}`, e);
    return [];
  }
}

function toast(message, type = 'success') {
  const container = $('#toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function openModal(title, bodyHTML) {
  const titleEl = $('#modal-title');
  const bodyEl = $('#modal-body');
  const overlay = $('#modal-overlay');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHTML;
  if (overlay) overlay.classList.add('visible');
}

function closeModal() {
  const overlay = $('#modal-overlay');
  if (overlay) overlay.classList.remove('visible');
}

function statusBadge(status) {
  const cls = {
    'Draft': 'badge-draft',
    'Sent': 'badge-sent',
    'Paid': 'badge-paid',
    'Overdue': 'badge-overdue',
    'Cancelled': 'badge-cancelled',
  }[status] || 'badge-draft';
  return `<span class="badge ${cls}">${status}</span>`;
}

function currency(val) {
  return `$${Number(val || 0).toFixed(2)}`;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Initialization Logic ───────────────────────────────

function initEventListeners() {
  try {
    const modalClose = $('#modal-close');
    const modalOverlay = $('#modal-overlay');

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    window.addEventListener('hashchange', navigate);
  } catch(e) {
    console.error('Failed to init event listeners', e);
  }
}

// ══════════════════════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════════════════════

const routes = {
  'dashboard': renderDashboard,
  'transactions': renderTransactions,
  'payroll': renderPayroll,
  'customers': renderCustomers,
  'products': renderProducts,
  'create-invoice': renderCreateInvoice,
  'invoices': renderInvoices,
  'invoice-detail': renderInvoiceDetail,
  'reports': renderReports,
  'settings': renderSettings,
  'users': renderUsers,
  'logs': renderLogs,
};

let currentUser = null;

function hasPermission(perm) {
  if (!currentUser) return false;
  return currentUser.role === 'Admin' || (currentUser.permissions && currentUser.permissions.includes(perm));
}

function updateUiPermissions() {
  if (!currentUser) return;

  const isAdmin = currentUser.role === 'Admin';

  // Handle general admin-only visibility
  $$('.admin-only').forEach(el => {
    el.style.display = isAdmin ? 'flex' : 'none';
  });

  // Handle granular data-perm enforcement
  $$('[data-perm]').forEach(el => {
    const requiredPerm = el.getAttribute('data-perm');
    const hasPerm = hasPermission(requiredPerm);

    if (!hasPerm) {
      // For nav items or large blocks, hide them
      if (el.classList.contains('nav-item') || el.tagName === 'SECTION' || el.classList.contains('card')) {
        el.style.display = 'none';
      } else {
        // For buttons or smaller inputs, disable/ghost them
        el.style.opacity = '0.5';
        el.style.pointerEvents = 'none';
        el.title = 'Permission Denied';
      }
    } else {
      // Re-show if previously hidden (important for SPA state changes)
      if (el.classList.contains('nav-item')) {
        el.style.display = 'flex';
      } else if (el.style.display === 'none') {
        el.style.display = ''; // Reset to default
      }
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    }
  });
}

function navigate() {
  const hash = location.hash.slice(1) || 'dashboard';
  const [page, ...params] = hash.split('/');
  const renderer = routes[page];

  // Highlight active nav
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const active = $(`.nav-item[data-page="${page}"]`);
  if (active) active.classList.add('active');

  const main = $('#main-content');
  main.innerHTML = '<div style="text-align:center;padding:80px;color:var(--text-muted)">Loading...</div>';

  if (renderer) {
    renderer(main, params);
  }
  updateUiPermissions();
}

window.addEventListener('hashchange', navigate);
// window.addEventListener('DOMContentLoaded', navigate); // Removed, will call after auth check

// ── Auth Logic ──────────────────────────────────────────

async function initAuth() {
  try {
    const isInitialized = await invoke('check_auth_initialized');
    if (!isInitialized) {
      renderSignupForm();
    } else {
      renderLoginForm();
    }
  } catch (e) {
    toast('Failed to initialize auth: ' + e, 'error');
  }
}

function renderSignupForm() {
  const container = $('#auth-container');
  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-header">
        <h2 class="auth-title">Create Admin Account</h2>
        <p class="auth-subtitle">Set up your username and password</p>
      </div>
      <form class="auth-form" id="signup-form">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" name="username" required placeholder="admin" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" required placeholder="••••••••" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;">Create Account</button>
      </form>
    </div>
  `;

  $('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await invoke('register', {
        username: fd.get('username'),
        password: fd.get('password'),
      });
      toast('Account created successfully!');
      showApp();
    } catch (err) { toast(err, 'error'); }
  });
}

function renderLoginForm() {
  const container = $('#auth-container');
  const rememberedUser = localStorage.getItem('nyxo_username');
  
  container.innerHTML = `
    <div class="auth-left">
      <div class="auth-brand-large">NyxoWealth</div>
      <div class="auth-tagline">
        The ultimate financial operating system for modern businesses.
      </div>
      
      <!-- Abstract Visuals -->
      <div class="auth-visuals">
        <div class="glass-card">
          <div class="glass-header">
            <div class="glass-icon"></div>
            <div class="glass-lines">
               <div class="glass-line" style="width: 60%"></div>
               <div class="glass-line" style="width: 40%"></div>
            </div>
          </div>
          <div class="glass-graph">
             <svg viewBox="0 0 200 100" class="glass-chart">
               <defs>
                 <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stop-color="rgba(255,255,255,0.4)"/>
                   <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                 </linearGradient>
               </defs>
               <path d="M0 80 Q 40 70, 70 40 T 140 30 T 200 10 V 100 H 0 Z" fill="url(#chartGradient)" />
               <path d="M0 80 Q 40 70, 70 40 T 140 30 T 200 10" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" />
             </svg>
          </div>
          <div class="glass-stat">
             <div class="glass-stat-label">Total Revenue</div>
             <div class="glass-stat-value">+$1.2M <span class="trend-up">▲ 24%</span></div>
          </div>
        </div>
        
        <div class="floating-orb orb-1"></div>
        <div class="floating-orb orb-2"></div>
      </div>
    </div>
    
    <div class="auth-right">
      <div class="login-wrapper">
        <div class="login-header">
          <h2 class="login-title">Welcome Back</h2>
          <p class="login-subtitle">Please enter your details to sign in.</p>
        </div>
        
        <form id="login-form">
          <div class="auth-input-group">
            <label class="auth-input-label">Username</label>
            <input type="text" class="auth-input" name="username" required 
                   placeholder="Enter your username" 
                   value="${rememberedUser || ''}" autofocus />
          </div>
          
          <div class="auth-input-group">
            <label class="auth-input-label">Password</label>
            <input type="password" class="auth-input" name="password" required placeholder="••••••••" />
          </div>
          
          <label class="remember-me">
            <input type="checkbox" name="remember" ${rememberedUser ? 'checked' : ''}>
            <span>Remember me for 30 days</span>
          </label>
          
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding: 14px; font-size: 1rem;">
            Sign In
          </button>
        </form>
        
        <div class="auth-footer">
          &copy; ${new Date().getFullYear()} NyxoLabs Solutions.
        </div>
      </div>
    </div>
  `;

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = fd.get('username');
    const remember = fd.get('remember');

    // Handle Remember Me
    if (remember) {
      localStorage.setItem('nyxo_username', username);
    } else {
      localStorage.removeItem('nyxo_username');
    }

    try {
      const session = await invoke('login', {
        username: username,
        password: fd.get('password'),
      });
      currentUser = session;
      toast('Logged in successfully');
      showApp();
    } catch (err) { toast(err, 'error'); }
  });
}

function showApp() {
  $('#auth-container').style.display = 'none';
  $('#app-layout').style.display = 'flex';
  updateUiPermissions();
  navigate();
}

async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    try {
      await invoke('logout');
      currentUser = null;
      $('#app-layout').style.display = 'none';
      $('#auth-container').style.display = 'flex'; // Ensure flex layout is restored
      location.hash = 'dashboard';
      renderLoginForm(document.getElementById('auth-container')); // Re-render login
    } catch (e) { toast(e, 'error'); }
  }
}

// Initial check
window.addEventListener('DOMContentLoaded', async () => {
  // Always init controls first
  initWindowControls();

  try {
    const session = await invoke('get_current_session');
    if (session) {
      currentUser = session;
      showApp();
    } else {
      initAuth();
    }
  } catch (e) {
    console.error('Session check failed', e);
    initAuth(); 
  }
});

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════

async function renderDashboard(container) {
  let stats;
  try {
    stats = await invoke('get_dashboard_stats');
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Business Overview</h1>
          <p class="page-subtitle">Real-time financial summary</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="location.hash='transactions'">Record Expense</button>
          <a href="#create-invoice" class="btn btn-primary" data-perm="create_invoice">⊕ New Invoice</a>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Net Profit</div>
          <div class="stat-value ${stats.net_profit >= 0 ? 'revenue' : 'danger-val'}">${currency(stats.net_profit)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Income</div>
          <div class="stat-value revenue">${currency(stats.total_revenue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Expenses</div>
          <div class="stat-value danger-val">${currency(stats.total_expenses)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cash in Hand</div>
          <div class="stat-value info-val">${currency(stats.cash_in_hand)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Bank Balance</div>
          <div class="stat-value info-val">${currency(stats.bank_balance)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Receivables</div>
          <div class="stat-value outstanding">${currency(stats.outstanding_amount)}</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="table-wrap">
          <div class="table-header">
            <span class="table-title">Recent Invoices</span>
            <a href="#invoices" class="btn btn-secondary btn-sm">View All →</a>
          </div>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${stats.recent_invoices.length === 0
                ? '<tr><td colspan="4" class="table-empty">No invoices yet.</td></tr>'
                : stats.recent_invoices.map(inv => `
                  <tr class="clickable-row" onclick="location.hash='invoice-detail/${inv.id}'">
                    <td>${escHtml(inv.invoice_number)}</td>
                    <td>${escHtml(inv.customer_name) || '—'}</td>
                    <td>${currency(inv.total)}</td>
                    <td>${statusBadge(inv.status)}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>

        <div class="flex-col gap-4">
           <div class="card">
              <h3 class="mb-4" style="font-size:var(--font-size-md)">Quick Actions</h3>
              <div class="flex-col gap-2">
                <button class="btn btn-secondary w-full" onclick="location.hash='payroll'">Manage Payroll</button>
                <button class="btn btn-secondary w-full" onclick="location.hash='reports'">Generate Report</button>
              </div>
           </div>
           <div class="card mt-4">
              <h3 class="mb-4" style="font-size:var(--font-size-md)">Employee Count</h3>
              <div class="stat-value" id="employee-count-dash">...</div>
           </div>
        </div>
      </div>
    </div>
  `;

  // Fetch employee count asynchronously to avoid blocking the main view
  invoke('get_employees').then(emps => {
    const el = $('#employee-count-dash');
    if (el) el.textContent = emps.length;
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════
//  CUSTOMERS
// ══════════════════════════════════════════════════════════

async function renderCustomers(container) {
  let customers;
  try {
    customers = await invoke('get_customers');
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter" data-perm="manage_customers">
      <div class="page-header">
        <div>
          <h1 class="page-title">Customers</h1>
          <p class="page-subtitle">${customers.length} customer${customers.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="search-bar">
            <input class="form-input" id="customer-search" placeholder="Search customers..." />
          </div>
          <button class="btn btn-primary" id="btn-add-customer" data-perm="manage_customers">⊕ Add Customer</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th style="width:120px">Actions</th>
            </tr>
          </thead>
          <tbody id="customers-tbody">
            ${customers.length === 0
              ? '<tr><td colspan="5" class="table-empty">No customers yet</td></tr>'
              : customers.map(c => customerRow(c)).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#btn-add-customer').addEventListener('click', () => openCustomerModal());

  // Search filter
  $('#customer-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = customers.filter(c =>
      (c.name||'').toLowerCase().includes(q) ||
      (c.company||'').toLowerCase().includes(q) ||
      (c.email||'').toLowerCase().includes(q)
    );
    $('#customers-tbody').innerHTML = filtered.length === 0
      ? '<tr><td colspan="5" class="table-empty">No matches</td></tr>'
      : filtered.map(c => customerRow(c)).join('');
    bindCustomerActions();
  });

  bindCustomerActions();
}

function customerRow(c) {
  return `
    <tr>
      <td>${escHtml(c.name)}</td>
      <td>${escHtml(c.company) || '—'}</td>
      <td>${escHtml(c.email) || '—'}</td>
      <td>${escHtml(c.phone) || '—'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm btn-icon edit-customer" data-id="${c.id}" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' data-perm="manage_customers">✎</button>
          <button class="btn btn-danger btn-sm btn-icon delete-customer" data-id="${c.id}" data-name="${escHtml(c.name)}" data-perm="manage_customers">✕</button>
        </div>
      </td>
    </tr>
  `;
}

function bindCustomerActions() {
  $$('.edit-customer').forEach(btn => {
    btn.onclick = () => {
      const data = JSON.parse(btn.dataset.json);
      openCustomerModal(data);
    };
  });
  $$('.delete-customer').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Delete customer "${btn.dataset.name}"?`)) {
        try {
          await invoke('delete_customer', { id: Number(btn.dataset.id) });
          toast('Customer deleted');
          renderCustomers($('#main-content'));
        } catch (e) { toast(e, 'error'); }
      }
    };
  });
}

function openCustomerModal(data = null) {
  const isEdit = !!data;
  openModal(isEdit ? 'Edit Customer' : 'Add Customer', `
    <form id="customer-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input class="form-input" name="name" required value="${escHtml(data?.name || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Company</label>
          <input class="form-input" name="company" value="${escHtml(data?.company || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" name="email" type="email" value="${escHtml(data?.email || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" name="phone" value="${escHtml(data?.phone || '')}" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Address</label>
          <textarea class="form-textarea" name="address">${escHtml(data?.address || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tax ID</label>
          <input class="form-input" name="tax_id" value="${escHtml(data?.tax_id || '')}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Customer'}</button>
      </div>
    </form>
  `);

  $('#customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const args = {
      name: fd.get('name'),
      company: fd.get('company') || null,
      phone: fd.get('phone') || null,
      email: fd.get('email') || null,
      address: fd.get('address') || null,
      tax_id: fd.get('tax_id') || null,
    };
    try {
      if (isEdit) {
        await invoke('update_customer', { id: data.id, ...args });
        toast('Customer updated');
      } else {
        await invoke('create_customer', args);
        toast('Customer added');
      }
      closeModal();
      renderCustomers($('#main-content'));
    } catch (e) { toast(e, 'error'); }
  });
}

// ══════════════════════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════════════════════

async function renderProducts(container) {
  let products;
  try {
    products = await invoke('get_products');
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter" data-perm="manage_products">
      <div class="page-header">
        <div>
          <h1 class="page-title">Products & Services</h1>
          <p class="page-subtitle">${products.length} item${products.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="search-bar">
            <input class="form-input" id="product-search" placeholder="Search products..." />
          </div>
          <button class="btn btn-primary" id="btn-add-product" data-perm="manage_products">⊕ Add Product</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Unit Price</th>
              <th>Tax %</th>
              <th style="width:120px">Actions</th>
            </tr>
          </thead>
          <tbody id="products-tbody">
            ${products.length === 0
              ? '<tr><td colspan="5" class="table-empty">No products yet</td></tr>'
              : products.map(p => productRow(p)).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#btn-add-product').addEventListener('click', () => openProductModal());

  $('#product-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = products.filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.description||'').toLowerCase().includes(q)
    );
    $('#products-tbody').innerHTML = filtered.length === 0
      ? '<tr><td colspan="5" class="table-empty">No matches</td></tr>'
      : filtered.map(p => productRow(p)).join('');
    bindProductActions();
  });

  bindProductActions();
}

function productRow(p) {
  return `
    <tr>
      <td>${escHtml(p.name)}</td>
      <td>${escHtml(p.description) || '—'}</td>
      <td>${currency(p.unit_price)}</td>
      <td>${p.tax_percent}%</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm btn-icon edit-product" data-id="${p.id}" data-json='${JSON.stringify(p).replace(/'/g, "&#39;")}' data-perm="manage_products">✎</button>
          <button class="btn btn-danger btn-sm btn-icon delete-product" data-id="${p.id}" data-name="${escHtml(p.name)}" data-perm="manage_products">✕</button>
        </div>
      </td>
    </tr>
  `;
}

function bindProductActions() {
  $$('.edit-product').forEach(btn => {
    btn.onclick = () => {
      const data = JSON.parse(btn.dataset.json);
      openProductModal(data);
    };
  });
  $$('.delete-product').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Delete product "${btn.dataset.name}"?`)) {
        try {
          await invoke('delete_product', { id: Number(btn.dataset.id) });
          toast('Product deleted');
          renderProducts($('#main-content'));
        } catch (e) { toast(e, 'error'); }
      }
    };
  });
}

function openProductModal(data = null) {
  const isEdit = !!data;
  openModal(isEdit ? 'Edit Product' : 'Add Product', `
    <form id="product-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input class="form-input" name="name" required value="${escHtml(data?.name || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Unit Price *</label>
          <input class="form-input" name="unit_price" type="number" step="0.01" min="0" required value="${data?.unit_price || ''}" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" name="description">${escHtml(data?.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tax %</label>
          <input class="form-input" name="tax_percent" type="number" step="0.1" min="0" value="${data?.tax_percent ?? 0}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Product'}</button>
      </div>
    </form>
  `);

  $('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const args = {
      name: fd.get('name'),
      description: fd.get('description') || null,
      unitPrice: Number(fd.get('unit_price')),
      taxPercent: Number(fd.get('tax_percent') || 0),
    };
    try {
      if (isEdit) {
        await invoke('update_product', { id: data.id, ...args });
        toast('Product updated');
      } else {
        await invoke('create_product', args);
        toast('Product added');
      }
      closeModal();
      renderProducts($('#main-content'));
    } catch (e) { toast(e, 'error'); }
  });
}

// ══════════════════════════════════════════════════════════
//  CREATE INVOICE
// ══════════════════════════════════════════════════════════

async function renderCreateInvoice(container) {
  let customers, products;
  try {
    [customers, products] = await Promise.all([
      invoke('get_customers'),
      invoke('get_products'),
    ]);
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  container.innerHTML = `
    <div class="page-enter" data-perm="create_invoice">
      <div class="page-header">
        <div>
          <h1 class="page-title">Create Invoice</h1>
          <p class="page-subtitle">Fill in details and add line items</p>
        </div>
      </div>

      <form id="invoice-form" class="card" style="max-width:900px;">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Customer *</label>
            <select class="form-select" name="customer_id" required>
              <option value="">Select customer...</option>
              ${customers.map(c => `<option value="${c.id}">${escHtml(c.name)}${c.company ? ' — ' + escHtml(c.company) : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" name="status">
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Issue Date</label>
            <input class="form-input" name="issue_date" type="date" value="${today}" />
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-input" name="due_date" type="date" value="${dueDate}" />
          </div>
          <div class="form-group full-width">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" name="notes" placeholder="Payment terms, notes..."></textarea>
          </div>
        </div>

        <h3 style="margin:24px 0 8px; font-size:var(--font-size-md); font-weight:600;">Line Items</h3>

        <table class="invoice-items-table">
          <thead>
            <tr>
              <th style="width:30%">Product / Description</th>
              <th style="width:15%">Qty</th>
              <th style="width:18%">Unit Price</th>
              <th style="width:12%">Tax %</th>
              <th style="width:18%">Line Total</th>
              <th style="width:7%"></th>
            </tr>
          </thead>
          <tbody id="invoice-items-body">
          </tbody>
        </table>

        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item">⊕ Add Item</button>

        <div class="invoice-totals">
          <div class="invoice-totals-inner">
            <div class="totals-row"><span>Subtotal</span><span id="inv-subtotal">$0.00</span></div>
            <div class="totals-row"><span>Tax</span><span id="inv-tax">$0.00</span></div>
            <div class="totals-row">
              <span>Discount</span>
              <span><input class="form-input" id="inv-discount" name="discount" type="number" step="0.01" min="0" value="0" style="width:100px;text-align:right;padding:6px 10px;" /></span>
            </div>
            <div class="totals-row grand-total"><span>Total</span><span id="inv-total">$0.00</span></div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="location.hash='dashboard'">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 Save Invoice</button>
        </div>
      </form>
    </div>
  `;

  let itemIndex = 0;

  function addItemRow() {
    const tbody = $('#invoice-items-body');
    const tr = document.createElement('tr');
    tr.dataset.idx = itemIndex;
    tr.innerHTML = `
      <td>
        <select class="form-select item-product" data-idx="${itemIndex}" style="width:100%">
          <option value="">Custom item...</option>
          ${products.map(p => `<option value="${p.id}" data-price="${p.unit_price}" data-tax="${p.tax_percent}">${escHtml(p.name)}</option>`).join('')}
        </select>
        <input class="form-input item-name" data-idx="${itemIndex}" placeholder="Item name" style="margin-top:4px;width:100%" />
      </td>
      <td><input class="form-input item-qty" data-idx="${itemIndex}" type="number" min="1" value="1" style="width:100%" /></td>
      <td><input class="form-input item-price" data-idx="${itemIndex}" type="number" step="0.01" min="0" value="0" style="width:100%" /></td>
      <td><input class="form-input item-tax" data-idx="${itemIndex}" type="number" step="0.1" min="0" value="0" style="width:100%" /></td>
      <td class="item-total" data-idx="${itemIndex}">$0.00</td>
      <td><button type="button" class="btn btn-danger btn-sm btn-icon remove-item" data-idx="${itemIndex}">✕</button></td>
    `;
    tbody.appendChild(tr);

    // When product selected, fill in price & tax
    tr.querySelector('.item-product').addEventListener('change', (e) => {
      const opt = e.target.selectedOptions[0];
      if (opt.value) {
        tr.querySelector('.item-name').value = opt.textContent;
        tr.querySelector('.item-price').value = opt.dataset.price;
        tr.querySelector('.item-tax').value = opt.dataset.tax;
      }
      recalcTotals();
    });

    // Recalc on any numeric change
    tr.querySelectorAll('.item-qty, .item-price, .item-tax').forEach(inp => {
      inp.addEventListener('input', recalcTotals);
    });

    tr.querySelector('.remove-item').addEventListener('click', () => {
      tr.remove();
      recalcTotals();
    });

    itemIndex++;
    recalcTotals();
  }

  function recalcTotals() {
    let subtotal = 0;
    let tax = 0;

    $$('#invoice-items-body tr').forEach(tr => {
      const qty = Number(tr.querySelector('.item-qty')?.value || 0);
      const price = Number(tr.querySelector('.item-price')?.value || 0);
      const taxPct = Number(tr.querySelector('.item-tax')?.value || 0);

      const base = qty * price;
      const itemTax = base * taxPct / 100;
      const lineTotal = base + itemTax;

      subtotal += base;
      tax += itemTax;

      const totalCell = tr.querySelector('.item-total');
      if (totalCell) totalCell.textContent = currency(lineTotal);
    });

    const discount = Number($('#inv-discount')?.value || 0);
    const total = subtotal + tax - discount;

    $('#inv-subtotal').textContent = currency(subtotal);
    $('#inv-tax').textContent = currency(tax);
    $('#inv-total').textContent = currency(total);
  }

  $('#btn-add-item').addEventListener('click', addItemRow);
  $('#inv-discount').addEventListener('input', recalcTotals);

  // Add first row
  addItemRow();

  // Submit
  $('#invoice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const items = [];
    $$('#invoice-items-body tr').forEach(tr => {
      const name = tr.querySelector('.item-name')?.value;
      if (!name) return;
      items.push({
        id: null,
        invoice_id: null,
        product_name: name,
        description: null,
        quantity: Number(tr.querySelector('.item-qty')?.value || 1),
        unit_price: Number(tr.querySelector('.item-price')?.value || 0),
        tax_percent: Number(tr.querySelector('.item-tax')?.value || 0),
        line_total: 0,
      });
    });

    if (items.length === 0) {
      toast('Add at least one item', 'error');
      return;
    }

    try {
      const id = await invoke('create_invoice', {
        customerId: Number(fd.get('customer_id')),
        status: fd.get('status'),
        issueDate: fd.get('issue_date'),
        dueDate: fd.get('due_date'),
        notes: fd.get('notes') || null,
        discount: Number(fd.get('discount') || 0),
        items: items,
      });
      toast('Invoice created!');
      location.hash = `invoice-detail/${id}`;
    } catch (e) { toast(e, 'error'); }
  });
}

// ══════════════════════════════════════════════════════════
//  INVOICE HISTORY
// ══════════════════════════════════════════════════════════

async function renderInvoices(container) {
  let invoices;
  try {
    invoices = await invoke('get_invoices');
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Invoice History</h1>
          <p class="page-subtitle">${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <select class="form-select" id="invoice-filter" style="width:150px;">
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <a href="#create-invoice" class="btn btn-primary" data-perm="create_invoice">⊕ New Invoice</a>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="invoices-tbody">
            ${invoiceRows(invoices)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#invoice-filter').addEventListener('change', (e) => {
    const status = e.target.value;
    const filtered = status ? invoices.filter(i => i.status === status) : invoices;
    $('#invoices-tbody').innerHTML = invoiceRows(filtered);
  });
}

function invoiceRows(list) {
  if (list.length === 0) return '<tr><td colspan="6" class="table-empty">No invoices found</td></tr>';
  return list.map(inv => `
    <tr class="clickable-row" onclick="location.hash='invoice-detail/${inv.id}'">
      <td>${escHtml(inv.invoice_number)}</td>
      <td>${escHtml(inv.customer_name) || '—'}</td>
      <td>${escHtml(inv.issue_date)}</td>
      <td>${escHtml(inv.due_date)}</td>
      <td>${currency(inv.total)}</td>
      <td>${statusBadge(inv.status)}</td>
    </tr>
  `).join('');
}

// ══════════════════════════════════════════════════════════
//  INVOICE DETAIL
// ══════════════════════════════════════════════════════════

async function renderInvoiceDetail(container, params) {
  const id = Number(params[0]);
  if (!id) { location.hash = 'invoices'; return; }

  let inv;
  try {
    inv = await invoke('get_invoice_detail', { id });
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Invoice ${escHtml(inv.invoice_number)}</h1>
          <p class="page-subtitle">Created ${escHtml(inv.created_at) || ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <select class="form-select" id="status-select" style="width:140px;" data-perm="create_invoice">
            ${['Draft','Sent','Paid','Overdue','Cancelled'].map(s =>
              `<option value="${s}" ${inv.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary" id="btn-export-pdf">📄 Export PDF</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-invoice" data-perm="delete_invoice">Delete</button>
        </div>
      </div>

      <div class="invoice-meta">
        <div>
          <div class="meta-label">Customer</div>
          <div class="meta-value">${escHtml(inv.customer_name) || '—'}</div>
        </div>
        <div>
          <div class="meta-label">Status</div>
          <div class="meta-value">${statusBadge(inv.status)}</div>
        </div>
        <div>
          <div class="meta-label">Issue Date</div>
          <div class="meta-value">${escHtml(inv.issue_date)}</div>
        </div>
        <div>
          <div class="meta-label">Due Date</div>
          <div class="meta-value">${escHtml(inv.due_date)}</div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-header">
          <span class="table-title">Line Items</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Tax %</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || []).map(item => `
              <tr>
                <td>${escHtml(item.product_name)}</td>
                <td>${item.quantity}</td>
                <td>${currency(item.unit_price)}</td>
                <td>${item.tax_percent}%</td>
                <td class="text-right">${currency(item.line_total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="invoice-totals" style="margin-top:20px;">
        <div class="invoice-totals-inner">
          <div class="totals-row"><span>Subtotal</span><span>${currency(inv.subtotal)}</span></div>
          <div class="totals-row"><span>Tax</span><span>${currency(inv.tax)}</span></div>
          ${inv.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${currency(inv.discount)}</span></div>` : ''}
          <div class="totals-row grand-total"><span>Total</span><span>${currency(inv.total)}</span></div>
        </div>
      </div>

      ${inv.notes ? `<div class="card mt-4"><strong>Notes:</strong><br/>${escHtml(inv.notes)}</div>` : ''}
    </div>
  `;

  // Status change
  $('#status-select').addEventListener('change', async (e) => {
    try {
      await invoke('update_invoice_status', { id, status: e.target.value });
      toast(`Status updated to ${e.target.value}`);
      renderInvoiceDetail(container, params);
    } catch (err) { toast(err, 'error'); }
  });

  // Export PDF
  $('#btn-export-pdf').addEventListener('click', async () => {
    try {
      const { save } = window.__TAURI__.dialog;
      const filePath = await save({
        defaultPath: `${inv.invoice_number || 'invoice'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!filePath) return;
      await invoke('export_invoice_pdf', { invoiceId: id, filePath });
      toast('PDF exported successfully!');
    } catch (err) { toast(String(err), 'error'); }
  });

  // Delete
  $('#btn-delete-invoice').addEventListener('click', async () => {
    if (confirm('Delete this invoice? This cannot be undone.')) {
      try {
        await invoke('delete_invoice', { id });
        toast('Invoice deleted');
        location.hash = 'invoices';
      } catch (err) { toast(err, 'error'); }
    }
  });
}

// ══════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════

async function renderSettings(container) {
  let settings;
  try {
    settings = await invoke('get_settings');
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter" data-perm="manage_settings">
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Configure your business details</p>
        </div>
      </div>

      <form id="settings-form" class="card settings-section">
        <div class="form-grid">
          <div class="form-group full-width">
            <label class="form-label">Business Name *</label>
            <input class="form-input" name="business_name" required value="${escHtml(settings.business_name)}" />
          </div>
          <div class="form-group full-width">
            <label class="form-label">Address</label>
            <textarea class="form-textarea" name="business_address">${escHtml(settings.business_address || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" name="business_phone" value="${escHtml(settings.business_phone || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" name="business_email" value="${escHtml(settings.business_email || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Currency Symbol</label>
            <input class="form-input" name="currency_symbol" value="${escHtml(settings.currency_symbol)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tax Label</label>
            <input class="form-input" name="tax_label" value="${escHtml(settings.tax_label)}" />
          </div>

          <div class="form-group full-width" style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:10px;">
            <label class="form-label">Company Logo</label>
            <div class="flex items-center gap-4">
               <input class="form-input" name="logo_path" id="settings-logo-path" readonly value="${escHtml(settings.logo_path || '')}" placeholder="No logo selected" />
               <button type="button" class="btn btn-secondary" id="btn-select-logo">Select Logo</button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Supports PNG and JPG. Logo will be scaled to fit header.</p>
          </div>

          <div class="form-group full-width">
            <label class="form-label">Default Invoice Footer</label>
            <textarea class="form-textarea" name="default_footer" placeholder="e.g. Thank you for your business!">${escHtml(settings.default_footer || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Invoice Template</label>
            <select class="form-select" name="template_type">
              <option value="Basic" ${settings.template_type === 'Basic' ? 'selected' : ''}>Basic (Clean)</option>
              <option value="Professional" ${settings.template_type === 'Professional' ? 'selected' : ''}>Professional (Blue Accents)</option>
              <option value="Modern" ${settings.template_type === 'Modern' ? 'selected' : ''}>Modern (Stylish)</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">💾 Save Settings</button>
        </div>
      </form>
    </div>
  `;

  $('#btn-select-logo').addEventListener('click', async () => {
    try {
      const { open } = window.__TAURI__.dialog;
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
      });
      if (selected) {
        toast('Uploading logo...');
        const newPath = await invoke('upload_logo', { sourcePath: selected });
        $('#settings-logo-path').value = newPath;
        toast('Logo uploaded successfully');
      }
    } catch (e) { toast(e, 'error'); }
  });

  $('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await invoke('update_settings', {
        businessName: fd.get('business_name'),
        businessAddress: fd.get('business_address') || null,
        businessPhone: fd.get('business_phone') || null,
        businessEmail: fd.get('business_email') || null,
        currencySymbol: fd.get('currency_symbol'),
        taxLabel: fd.get('tax_label'),
        logoPath: fd.get('logo_path') || null,
        defaultFooter: fd.get('default_footer') || null,
        templateType: fd.get('template_type'),
      });
      toast('Settings saved');
    } catch (err) { toast(err, 'error'); }
  });
}

// ══════════════════════════════════════════════════════════
//  USERS & PERMISSIONS
// ══════════════════════════════════════════════════════════

async function renderUsers(container) {
  if (!hasPermission('manage_users')) {
    container.innerHTML = '<h2>Permission Denied</h2>';
    return;
  }

  let users = [];
  try { users = await invoke('get_users'); } catch (e) { toast(e, 'error'); }

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">User Management</h1>
          <p class="page-subtitle">Manage admin and staff accounts</p>
        </div>
        <button class="btn btn-primary" id="btn-add-user">⊕ New User</button>
      </div>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><strong>${escHtml(u.username)}</strong></td>
                <td><span class="badge ${u.role === 'Admin' ? 'badge-paid' : 'badge-draft'}">${u.role}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="editPermissions(${u.id}, '${u.username}')">Permissions</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#btn-add-user').addEventListener('click', () => {
    openModal('Create New User', `
      <form id="new-user-form" class="modal-form">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" name="username" required autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" required />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create User</button>
        </div>
      </form>
    `);

    $('#new-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await invoke('register', {
          username: fd.get('username'),
          password: fd.get('password'),
        });
        toast('User created');
        closeModal();
        renderUsers(container);
      } catch (err) { toast(err, 'error'); }
    });
  });
}

async function editPermissions(userId, username) {
  const permsList = [
    'manage_users', 'view_logs', 'create_invoice', 'delete_invoice',
    'manage_customers', 'manage_products', 'manage_settings',
    'manage_transactions', 'manage_payroll', 'view_reports'
  ];

  openModal(`Permissions: ${username}`, `
    <div style="padding: 10px 0">
      <p style="margin-bottom: 20px; color: var(--text-muted)">Grant specific access to this user.</p>
      <form id="perms-form">
        ${permsList.map(p => `
          <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" name="perms" value="${p}" id="perm-${p}" style="width: 18px; height: 18px;">
            <label for="perm-${p}" style="cursor: pointer; font-size: 14px;">${p.replace(/_/g, ' ')}</label>
          </div>
        `).join('')}
        <div class="form-actions" style="margin-top: 25px">
          <button type="submit" class="btn btn-primary">Update Permissions</button>
        </div>
      </form>
    </div>
  `);

  try {
    const userPerms = await invoke('get_user_permissions', { userId });
    userPerms.forEach(p => {
      const cb = $(`#perms-form input[value="${p}"]`);
      if (cb) cb.checked = true;
    });
  } catch (e) {
    console.error('Failed to pre-fill permissions:', e);
  }

  $('#perms-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const perms = fd.getAll('perms');
    try {
      await invoke('update_user_permissions', { userId, permissions: perms });
      toast('Permissions updated');
      closeModal();
    } catch (err) { toast(err, 'error'); }
  });
}
window.editPermissions = editPermissions;

async function renderLogs(container) {
  if (!hasPermission('view_logs')) {
    container.innerHTML = '<h2>Permission Denied</h2>';
    return;
  }

  let users = [];
  try { users = await invoke('get_users'); } catch (e) {}

  const modules = ['Invoice', 'Customer', 'Product', 'User', 'Session', 'Settings', 'Transaction', 'Payroll'];

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Activity Logs</h1>
          <p class="page-subtitle">Track all system actions and changes</p>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="flex gap-4 flex-wrap items-end">
          <div class="form-group mb-0">
            <label class="form-label" style="font-size: 12px;">User</label>
            <select class="form-select" id="filter-user" style="width: 150px;">
              <option value="">All Users</option>
              ${users.map(u => `<option value="${u.id}">${escHtml(u.username)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" style="font-size: 12px;">Module</label>
            <select class="form-select" id="filter-module" style="width: 150px;">
              <option value="">All Modules</option>
              ${modules.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" style="font-size: 12px;">Date</label>
            <input type="date" class="form-input" id="filter-date" style="width: 150px;" />
          </div>
          <div class="form-group mb-0">
            <label class="form-label" style="font-size: 12px;">Month</label>
            <input type="month" class="form-input" id="filter-month" style="width: 150px;" />
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-clear-filters" style="height: 38px;">Clear</button>
          <button class="btn btn-primary btn-sm" id="btn-apply-filters" style="height: 38px;">Apply Filters</button>
        </div>
      </div>

      <div class="card">
        <div id="logs-container">
          <div style="text-align:center;padding:40px;color:var(--text-muted)">Loading logs...</div>
        </div>
      </div>
    </div>
  `;

  const loadLogs = async () => {
    const userId = $('#filter-user').value;
    const module = $('#filter-module').value;
    const date = $('#filter-date').value;
    const month = $('#filter-month').value;

    const logsContainer = $('#logs-container');
    try {
      const logs = await invoke('get_audit_logs', {
        limit: 100,
        offset: 0,
        userId: userId ? Number(userId) : null,
        module: module || null,
        date: date || null,
        month: month || null
      });

      logsContainer.innerHTML = `
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0
              ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No logs found matching filters.</td></tr>'
              : logs.map(l => `
                <tr>
                  <td style="white-space: nowrap; color: var(--text-muted)">${new Date(l.timestamp).toLocaleString()}</td>
                  <td><strong>${escHtml(l.username || 'System/Deleted')}</strong></td>
                  <td><span class="badge ${l.action.includes('DELETE') ? 'badge-cancelled' : 'badge-paid'}">${l.action}</span></td>
                  <td><span style="color: var(--primary-color)">${l.module}</span></td>
                  <td>${escHtml(l.description)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      logsContainer.innerHTML = `<div style="color:var(--danger-color);padding:20px;">Error: ${e}</div>`;
    }
  };

  // Bind events
  $('#btn-apply-filters').addEventListener('click', loadLogs);

  $('#btn-clear-filters').addEventListener('click', () => {
    $('#filter-user').value = '';
    $('#filter-module').value = '';
    $('#filter-date').value = '';
    $('#filter-month').value = '';
    loadLogs();
  });

  // Initial load
  await loadLogs();
}

// ── Transactions ───────────────────────────────────────

async function renderTransactions(container) {
  let [txs, accounts, categories] = await Promise.all([
    invoke('get_transactions', { limit: 50 }),
    invoke('get_accounts'),
    invoke('get_categories')
  ]);

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Transactions</h1>
          <p class="page-subtitle">Income and Expense history</p>
        </div>
        <button class="btn btn-primary" id="btn-add-tx">⊕ Record Transaction</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <!-- <th>Account</th> -->
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${txs.length === 0
              ? '<tr><td colspan="6" class="table-empty">No transactions recorded yet.</td></tr>'
              : txs.map(t => `
                <tr>
                  <td>${t.date}</td>
                  <!-- <td>${accounts.find(a => a.id === t.account_id)?.name || 'Unknown'}</td> -->
                  <td>${categories.find(c => c.id === t.category_id)?.name || 'Uncategorized'}</td>
                  <td><span class="badge ${t.transaction_type === 'Income' ? 'badge-paid' : 'badge-overdue'}">${t.transaction_type}</span></td>
                  <td class="${t.transaction_type === 'Income' ? 'transaction-type-income' : 'transaction-type-expense'}">
                    ${t.transaction_type === 'Income' ? '+' : '-'}${currency(t.amount)}
                  </td>
                  <td>${escHtml(t.description) || '—'}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#btn-add-tx').onclick = () => openTransactionModal(accounts, categories);
}

async function openTransactionModal(accounts, categories) {
  // Auto-select or create default account
  let defaultAccount = accounts[0];
  if (!defaultAccount) {
    try {
      // Create default account if none exists
      await invoke('create_account', {
        name: 'Business Account',
        accountType: 'Bank',
        balance: 0.0,
        currency: 'USD'
      });
      const newAccounts = await invoke('get_accounts');
      defaultAccount = newAccounts[0];
    } catch (e) {
      console.error('Failed to create default account', e);
    }
  }

  if (!defaultAccount) {
    toast('No accounts available. Please contact support.', 'error');
    return;
  }

  openModal('Record Transaction', `
    <form id="tx-form">
      <input type="hidden" name="account_id" value="${defaultAccount.id}">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Type *</label>
          <select class="form-select" name="transaction_type" required>
            <option value="Expense">Expense</option>
            <option value="Income">Income</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" name="category_id">
            <option value="">None</option>
            ${categories.map(c => `<option value="${c.id}">${c.name} (${c.category_type})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount *</label>
          <input class="form-input" name="amount" type="number" step="0.01" min="0.01" required />
        </div>
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input class="form-input" name="date" type="date" value="${new Date().toISOString().split('T')[0]}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Reference ID</label>
          <input class="form-input" name="reference_id" placeholder="Optional" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" name="description"></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Transaction</button>
      </div>
    </form>
  `);

  $('#tx-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await invoke('create_transaction', {
        accountId: Number(fd.get('account_id')),
        categoryId: fd.get('category_id') ? Number(fd.get('category_id')) : null,
        amount: Number(fd.get('amount')),
        transactionType: fd.get('transaction_type'),
        description: fd.get('description') || null,
        date: fd.get('date'),
        referenceId: fd.get('reference_id') || null,
      });
      toast('Transaction recorded');
      closeModal();
      renderTransactions($('#main-content'));
    } catch (err) { toast(err, 'error'); }
  };
}

// ── Accounts ───────────────────────────────────────────


// ── Payroll ───────────────────────────────────────────

async function renderPayroll(container) {
  let [employees, payroll] = await Promise.all([
    invoke('get_employees'),
    invoke('get_payroll_summary')
  ]);

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Payroll Management</h1>
          <p class="page-subtitle">${employees.length} employees</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" id="btn-add-employee">⊕ Add Employee</button>
          <button class="btn btn-primary" id="btn-run-payroll">⊕ Run Payroll</button>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="table-wrap">
          <div class="table-header">
            <span class="table-title">Recent Payments</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${payroll.length === 0
                ? '<tr><td colspan="4" class="table-empty">No payroll records.</td></tr>'
                : payroll.map(p => {
                    const emp = employees.find(e => e.id === p.employee_id);
                    return `
                      <tr>
                        <td>${p.payment_date}</td>
                        <td>${emp ? emp.name : 'Unknown'}</td>
                        <td>${currency(p.amount)}</td>
                        <td>${statusBadge(p.status)}</td>
                      </tr>
                    `;
                  }).join('')
              }
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3 class="mb-4">Employees</h3>
          <div class="flex-col gap-2">
            ${employees.length === 0 ? '<p class="text-muted">No employees.</p>' : employees.map(e => `
              <div class="account-card">
                <div class="flex-col">
                  <span style="font-weight:600">${e.name}</span>
                  <span class="text-muted" style="font-size:var(--font-size-xs)">${e.role || 'No Role'}</span>
                </div>
                <div class="text-right">
                  <div style="font-weight:700">${currency(e.salary)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  $('#btn-add-employee').onclick = () => {
    openModal('Add Employee', `
      <form id="emp-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-input" name="name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <input class="form-input" name="role" />
          </div>
          <div class="form-group">
            <label class="form-label">Monthly Salary *</label>
            <input class="form-input" name="salary" type="number" step="0.01" required />
          </div>
          <div class="form-group">
             <label class="form-label">Phone</label>
             <input class="form-input" name="phone" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Employee</button>
        </div>
      </form>
    `);
    $('#emp-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await invoke('create_employee', {
          name: fd.get('name'),
          role: fd.get('role') || null,
          salary: Number(fd.get('salary')),
          email: null,
          phone: fd.get('phone') || null,
        });
        toast('Employee added');
        closeModal();
        renderPayroll($('#main-content'));
      } catch (err) { toast(err, 'error'); }
    }
  };

  $('#btn-run-payroll').onclick = () => {
    if (employees.length === 0) return toast('No employees to pay', 'error');
    openModal('Run Payroll', `
      <form id="run-payroll-form">
        <div class="form-group mb-4">
          <label class="form-label">Employee *</label>
          <select class="form-select" name="employee_id" required>
            ${employees.map(e => `<option value="${e.id}" data-salary="${e.salary}">${e.name} (${currency(e.salary)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Payment Amount *</label>
          <input class="form-input" name="amount" type="number" step="0.01" id="payroll-amount" required />
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Payment Date *</label>
          <input class="form-input" name="payment_date" type="date" value="${new Date().toISOString().split('T')[0]}" required />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Record Payment</button>
        </div>
      </form>
    `);

    const sel = $('select[name="employee_id"]');
    const amt = $('#payroll-amount');
    amt.value = sel.selectedOptions[0].dataset.salary;
    sel.onchange = () => amt.value = sel.selectedOptions[0].dataset.salary;

    $('#run-payroll-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await invoke('create_payroll', {
          employeeId: Number(fd.get('employee_id')),
          amount: Number(fd.get('amount')),
          paymentDate: fd.get('payment_date'),
          status: 'Paid',
          notes: 'Regular salary'
        });
        toast('Payroll recorded');
        closeModal();
        renderPayroll($('#main-content'));
      } catch (err) { toast(err, 'error'); }
    }
  };
}

// ── Reports ───────────────────────────────────────────

async function renderReports(container) {
  let [stats, cashFlow, categories] = await Promise.all([
    invoke('get_dashboard_stats'),
    invoke('get_cash_flow_report'),
    invoke('get_category_report')
  ]);

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Financial Reports</h1>
          <p class="page-subtitle">Deep dive into your business metrics</p>
        </div>
        <div class="btn-group">
           <button class="btn btn-secondary" onclick="performExport('Transactions', 'csv')">Export CSV</button>
           <button class="btn btn-primary" onclick="performExport('Transactions', 'xlsx')">Export Excel</button>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <h3 class="mb-4">Profit & Loss Summary</h3>
          <div class="flex-col gap-4">
            <div class="totals-row">
              <span>Total Revenue</span>
              <span class="revenue">${currency(stats.total_revenue)}</span>
            </div>
            <div class="totals-row">
              <span>Total Expenses</span>
              <span class="danger-val">${currency(stats.total_expenses)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Net Profit</span>
              <span class="${stats.net_profit >= 0 ? 'revenue' : 'danger-val'}">${currency(stats.net_profit)}</span>
            </div>
          </div>

          <h3 class="mt-8 mb-4">Cash Flow (Last 12 Months)</h3>
          <div class="table-wrap">
            <table class="table-sm">
               <thead>
                 <tr><th>Month</th><th>Income</th><th>Expense</th><th>Net</th></tr>
               </thead>
               <tbody>
                  ${cashFlow.map(cf => `
                    <tr>
                      <td>${cf.month}</td>
                      <td class="revenue">${currency(cf.income)}</td>
                      <td class="danger-val">${currency(cf.expense)}</td>
                      <td class="${cf.net >=0 ? 'revenue' : 'danger-val'}">${currency(cf.net)}</td>
                    </tr>
                  `).join('')}
               </tbody>
            </table>
          </div>
        </div>

        <div class="flex-col gap-4">
          <div class="card">
            <h3 class="mb-4">Category Breakdown</h3>
            <div class="table-wrap">
               <table class="table-sm">
                  <thead>
                    <tr><th>Category</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    ${categories.map(c => `
                      <tr>
                        <td>${c.category_name} <small class="text-muted">(${c.category_type})</small></td>
                        <td>${currency(c.total_amount)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
               </table>
            </div>
          </div>
          
          <div class="card">
            <h3 class="mb-4">Quick Exports</h3>
            <div class="flex-col gap-2">
              <button class="btn btn-secondary w-full" onclick="performExport('Invoices', 'csv')">Invoices (CSV)</button>
              <button class="btn btn-secondary w-full" onclick="performExport('Customers', 'csv')">Customers (CSV)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function performExport(module, format) {
  try {
    const { save } = window.__TAURI__.plugins.dialog;
    const path = await save({
      filters: [{
        name: format === 'csv' ? 'CSV File' : 'Excel File',
        extensions: [format]
      }],
      defaultPath: `${module.toLowerCase()}_export.${format}`
    });

    if (!path) return;

    toast(`Exporting ${module}...`);
    const cmd = format === 'csv' ? 'export_data_csv' : 'export_data_xlsx';
    await invoke(cmd, { module, path });
    toast('Export completed successfully');
  } catch (err) {
    toast(`Export failed: ${err}`, 'error');
  }
}

// Make functions global for inline onclick handlers
window.closeModal = closeModal;
window.handleLogout = handleLogout;
window.performExport = performExport;
