/* ══════════════════════════════════════════════════════════
   Antigravity Billing Manager — Frontend Application
   Hash-based SPA with Tauri IPC
   ══════════════════════════════════════════════════════════ */

const { invoke } = window.__TAURI__.core;

// ── Helpers ─────────────────────────────────────────────

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(message, type = 'success') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function openModal(title, bodyHTML) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  $('#modal-overlay').classList.add('visible');
}

function closeModal() {
  $('#modal-overlay').classList.remove('visible');
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

// ── Modal events ───────────────────────────────────────

$('#modal-close').addEventListener('click', closeModal);
$('#modal-overlay').addEventListener('click', (e) => {
  if (e.target === $('#modal-overlay')) closeModal();
});

// ══════════════════════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════════════════════

const routes = {
  'dashboard': renderDashboard,
  'customers': renderCustomers,
  'products': renderProducts,
  'create-invoice': renderCreateInvoice,
  'invoices': renderInvoices,
  'invoice-detail': renderInvoiceDetail,
  'settings': renderSettings,
};

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
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);

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
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Business overview at a glance</p>
        </div>
        <a href="#create-invoice" class="btn btn-primary">⊕ New Invoice</a>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value revenue">${currency(stats.total_revenue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value outstanding">${currency(stats.outstanding_amount)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Invoices</div>
          <div class="stat-value info-val">${stats.total_invoices}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Paid</div>
          <div class="stat-value revenue">${stats.paid_invoices}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overdue</div>
          <div class="stat-value danger-val">${stats.overdue_invoices}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Drafts</div>
          <div class="stat-value">${stats.draft_invoices}</div>
        </div>
      </div>

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
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${stats.recent_invoices.length === 0
              ? '<tr><td colspan="5" class="table-empty">No invoices yet. Create your first one!</td></tr>'
              : stats.recent_invoices.map(inv => `
                <tr class="clickable-row" onclick="location.hash='invoice-detail/${inv.id}'">
                  <td>${escHtml(inv.invoice_number)}</td>
                  <td>${escHtml(inv.customer_name) || '—'}</td>
                  <td>${escHtml(inv.issue_date)}</td>
                  <td>${currency(inv.total)}</td>
                  <td>${statusBadge(inv.status)}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
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
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Customers</h1>
          <p class="page-subtitle">${customers.length} customer${customers.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="search-bar">
            <input class="form-input" id="customer-search" placeholder="Search customers..." />
          </div>
          <button class="btn btn-primary" id="btn-add-customer">⊕ Add Customer</button>
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
          <button class="btn btn-secondary btn-sm btn-icon edit-customer" data-id="${c.id}" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}'>✎</button>
          <button class="btn btn-danger btn-sm btn-icon delete-customer" data-id="${c.id}" data-name="${escHtml(c.name)}">✕</button>
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
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Products & Services</h1>
          <p class="page-subtitle">${products.length} item${products.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="search-bar">
            <input class="form-input" id="product-search" placeholder="Search products..." />
          </div>
          <button class="btn btn-primary" id="btn-add-product">⊕ Add Product</button>
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
          <button class="btn btn-secondary btn-sm btn-icon edit-product" data-id="${p.id}" data-json='${JSON.stringify(p).replace(/'/g, "&#39;")}'>✎</button>
          <button class="btn btn-danger btn-sm btn-icon delete-product" data-id="${p.id}" data-name="${escHtml(p.name)}">✕</button>
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
    <div class="page-enter">
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
          <a href="#create-invoice" class="btn btn-primary">⊕ New Invoice</a>
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
          <select class="form-select" id="status-select" style="width:140px;">
            ${['Draft','Sent','Paid','Overdue','Cancelled'].map(s =>
              `<option value="${s}" ${inv.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary" id="btn-export-pdf">📄 Export PDF</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-invoice">Delete</button>
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
    <div class="page-enter">
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
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">💾 Save Settings</button>
        </div>
      </form>
    </div>
  `;

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
      });
      toast('Settings saved');
    } catch (e) { toast(e, 'error'); }
  });
}

// Make close modal global for inline onclick handlers
window.closeModal = closeModal;
