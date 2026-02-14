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
  // Reset modal size
  const modal = document.querySelector('.modal');
  if (modal) {
    modal.style.maxWidth = '';
    modal.style.width = '';
    modal.style.maxHeight = '';
  }
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
console.log('Main script loaded');


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

    // ── Initialize sidebar collapsible menus ──
    initSidebarMenus();

    // ── Initialize sidebar mobile toggle ──
    initSidebarToggle();
  } catch(e) {
    console.error('Failed to init event listeners', e);
  }
}

function initSidebarMenus() {
  try {
    // Set up section toggle listeners
    $$('.nav-section-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const section = toggle.getAttribute('data-section');
        const submenu = $(`#${section}-submenu`);
        
        if (submenu) {
          // Toggle active state
          toggle.classList.toggle('active');
          submenu.classList.toggle('active');
          
          // Save state to localStorage
          const isActive = toggle.classList.contains('active');
          localStorage.setItem(`sidebar-section-${section}`, isActive ? 'open' : 'closed');
        }
      });
    });

    // Restore saved menu states
    $$('.nav-section-toggle').forEach(toggle => {
      const section = toggle.getAttribute('data-section');
      const savedState = localStorage.getItem(`sidebar-section-${section}`);
      const submenu = $(`#${section}-submenu`);
      
      if (submenu) {
        if (savedState === 'open') {
          toggle.classList.add('active');
          submenu.classList.add('active');
        } else if (savedState === 'closed') {
          toggle.classList.remove('active');
          submenu.classList.remove('active');
        } else {
          // Default: expand first few sections
          if (['financial', 'team'].includes(section)) {
            toggle.classList.add('active');
            submenu.classList.add('active');
            localStorage.setItem(`sidebar-section-${section}`, 'open');
          }
        }
      }
    });

    // Set up subitem navigation
    $$('.nav-subitem').forEach(item => {
      item.addEventListener('click', (e) => {
        // The link naturally navigates via href
        // Update active states after navigation
      });
    });
  } catch(e) {
    console.error('Failed to init sidebar menus', e);
  }
}

function initSidebarToggle() {
  // Create toggle button
  const toggle = document.createElement('button');
  toggle.className = 'sidebar-toggle';
  toggle.id = 'sidebar-toggle';
  toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  toggle.setAttribute('aria-label', 'Toggle sidebar');
  document.body.appendChild(toggle);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  document.body.appendChild(overlay);

  const sidebar = $('#sidebar');

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });

  // Close sidebar when a nav item is clicked (mobile)
  $$('.nav-item, .nav-subitem').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
      }
    });
  });
}

// ══════════════════════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════════════════════

const routes = {
  'dashboard': renderDashboard,
  'transactions': renderTransactions,
  'employees': renderEmployees,
  'payroll': renderPayroll,
  'customers': renderCustomers,
  'products': renderProducts,
  'create-invoice': renderCreateInvoice,
  'invoices': renderInvoices,
  'invoice-detail': renderInvoiceDetail,
  'reports': renderReports,
  'templates': renderTemplates,
  'template-designer': renderTemplateDesigner,
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
      // For nav items, subitems, or large blocks, hide them
      if (el.classList.contains('nav-item') || el.classList.contains('nav-subitem') || el.tagName === 'SECTION' || el.classList.contains('card')) {
        el.style.display = 'none';
      } else {
        // For buttons or smaller inputs, disable/ghost them
        el.style.opacity = '0.5';
        el.style.pointerEvents = 'none';
        el.title = 'Permission Denied';
      }
    } else {
      // Re-show if previously hidden (important for SPA state changes)
      if (el.classList.contains('nav-item') || el.classList.contains('nav-subitem')) {
        el.style.display = 'flex';
      } else if (el.style.display === 'none') {
        el.style.display = ''; // Reset to default
      }
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    }
  });

  // Clean up nav-section visibility (hide empty sections)
  $$('.nav-section').forEach(section => {
    const visibleItems = section.querySelectorAll('.nav-submenu .nav-subitem:not([style*="display: none"]), .nav-submenu .nav-subitem[style=""]');
    const allItems = section.querySelectorAll('.nav-submenu .nav-subitem');
    const hasVisibleItems = Array.from(allItems).some(item => item.style.display !== 'none');
    
    if (!hasVisibleItems && allItems.length > 0) {
      section.style.display = 'none';
    } else {
      section.style.display = 'flex';
    }
  });
}

function navigate() {
  const rawHash = location.hash.slice(1) || 'dashboard';
  const hashWithoutQuery = rawHash.split('?')[0];
  const [page, ...params] = hashWithoutQuery.split('/');
  const renderer = routes[page];

  // Highlight active nav (both old nav-item and new nav-subitem)
  $$('.nav-item, .nav-subitem').forEach(n => n.classList.remove('active'));
  
  // Check for nav-subitem first (new structure)
  const activeSubitem = $(`.nav-subitem[data-page="${page}"]`);
  if (activeSubitem) {
    activeSubitem.classList.add('active');
    // Ensure parent section is expanded
    const section = activeSubitem.closest('.nav-section');
    if (section) {
      const toggle = section.querySelector('.nav-section-toggle');
      const submenu = section.querySelector('.nav-submenu');
      if (toggle && submenu && !submenu.classList.contains('active')) {
        toggle.classList.add('active');
        submenu.classList.add('active');
      }
    }
  } else {
    // Fall back to nav-item (for dashboard and legacy items)
    const active = $(`.nav-item[data-page="${page}"]`);
    if (active) active.classList.add('active');
  }
  
  // Also highlight templates nav for template-designer page
  if (page === 'template-designer') {
    const templatesSubitem = $(`.nav-subitem[data-page="templates"]`);
    if (templatesSubitem) {
      templatesSubitem.classList.add('active');
    } else {
      const templatesNav = $(`.nav-item[data-page="templates"]`);
      if (templatesNav) templatesNav.classList.add('active');
    }
  }

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
  console.log('initAuth called');
  try {
    const isInitialized = await invoke('check_auth_initialized');
    console.log('auth initialized:', isInitialized);
    if (!isInitialized) {
      renderSignupForm();
    } else {
      renderLoginForm();
    }
  } catch (e) {
    console.error('initAuth failed:', e);
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
  addReplayButton();
  navigate();
}

// ══════════════════════════════════════════════════════════════════
//  PRODUCT TOUR / STEPPER v2
// ══════════════════════════════════════════════════════════════════

let currentStep = 1;
const totalSteps = 8;
let stepperTransitioning = false;
let particleAnimFrame = null;

function showStepper() {
  const overlay = $('#stepper-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    currentStep = 1;
    updateStepperUI();
    initParticles();

    // Setup event listeners
    $('#stepper-next').addEventListener('click', nextStep);
    $('#stepper-prev').addEventListener('click', prevStep);
    $('#stepper-skip').addEventListener('click', skipTour);

    // Dot click navigation
    $$('.stepper-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const targetStep = parseInt(dot.dataset.step);
        if (targetStep !== currentStep && !stepperTransitioning) {
          goToStep(targetStep);
        }
      });
    });
  }
}

function updateStepperUI() {
  // Hide all steps, show current
  $$('.stepper-step').forEach(s => {
    s.classList.remove('active', 'slide-in-left');
    s.style.display = 'none';
  });

  const currentStepEl = $(`#step-${currentStep}`);
  if (currentStepEl) {
    currentStepEl.style.display = 'flex';
    currentStepEl.classList.add('active');
  }

  // Update counter
  $('#step-counter').textContent = `Step ${currentStep} of ${totalSteps}`;

  // Update progress bar
  const progress = (currentStep / totalSteps) * 100;
  $('#progress-fill').style.width = `${progress}%`;

  // Update dots
  $$('.stepper-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i + 1 === currentStep) {
      dot.classList.add('active');
    } else if (i + 1 < currentStep) {
      dot.classList.add('completed');
    }
  });

  // Show/hide prev button
  const prevBtn = $('#stepper-prev');
  if (prevBtn) {
    prevBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
  }

  // Update next button text
  const nextBtn = $('#stepper-next');
  if (nextBtn) {
    if (currentStep === totalSteps) {
      nextBtn.textContent = 'Get Started!';
      nextBtn.classList.remove('btn-primary');
      nextBtn.classList.add('btn-success');
    } else {
      nextBtn.textContent = 'Next';
      nextBtn.classList.remove('btn-success');
      nextBtn.classList.add('btn-primary');
    }
  }

  // Trigger confetti on last step
  if (currentStep === totalSteps) {
    setTimeout(launchConfetti, 300);
  }
}

function goToStep(targetStep) {
  if (stepperTransitioning) return;
  stepperTransitioning = true;

  const direction = targetStep > currentStep ? 'right' : 'left';
  const currentStepEl = $(`#step-${currentStep}`);
  const targetStepEl = $(`#step-${targetStep}`);

  if (!currentStepEl || !targetStepEl) {
    stepperTransitioning = false;
    return;
  }

  // Animate out current step
  currentStepEl.classList.remove('active', 'slide-in-left');
  currentStepEl.style.animation = direction === 'right'
    ? 'stepSlideOutLeft 0.35s ease-in forwards'
    : 'stepSlideOutRight 0.35s ease-in forwards';

  setTimeout(() => {
    currentStepEl.style.display = 'none';
    currentStepEl.style.animation = '';

    // Show and animate in target step
    currentStep = targetStep;
    targetStepEl.style.display = 'flex';
    targetStepEl.classList.remove('active', 'slide-in-left');
    targetStepEl.style.animation = direction === 'right'
      ? 'stepSlideInRight 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      : 'stepSlideInLeft 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards';

    updateStepperUI();

    setTimeout(() => {
      targetStepEl.style.animation = '';
      targetStepEl.classList.add('active');
      stepperTransitioning = false;
    }, 450);
  }, 350);
}

function nextStep() {
  if (currentStep < totalSteps) {
    goToStep(currentStep + 1);
  } else {
    completeTour();
  }
}

function prevStep() {
  if (currentStep > 1) {
    goToStep(currentStep - 1);
  }
}

function skipTour() {
  if (confirm('Are you sure you want to skip the product tour?')) {
    completeTour();
  }
}

function completeTour() {
  localStorage.setItem('nyxo_tour_completed', 'true');
  const overlay = $('#stepper-overlay');
  if (overlay) {
    overlay.style.opacity = '1';
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.style.transition = '';
      overlay.style.opacity = '';
    }, 400);
  }
  currentStep = 1;
  stepperTransitioning = false;
  stopParticles();
  document.removeEventListener('keydown', handleStepperKeyboard);
  // After tour, proceed to activation/login check
  checkActivationAndAuth();
}

// ── Confetti Effect ──
function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  const overlay = $('#stepper-overlay');
  if (!overlay) return;
  overlay.appendChild(container);

  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#a78bfa'];

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.width = `${5 + Math.random() * 6}px`;
    piece.style.height = `${5 + Math.random() * 6}px`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 4000);
}

// ── Floating Particles ──
function initParticles() {
  const canvas = $('#stepper-particles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const count = Math.min(40, Math.floor(window.innerWidth / 30));

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.3 + 0.1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(99, 102, 241, ${p.alpha})`;
      ctx.fill();
    });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    particleAnimFrame = requestAnimationFrame(draw);
  }

  draw();

  // Handle resize
  window.addEventListener('resize', () => {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
}

function stopParticles() {
  if (particleAnimFrame) {
    cancelAnimationFrame(particleAnimFrame);
    particleAnimFrame = null;
  }
}

// ── Replay Tour ──
function replayTour() {
  localStorage.removeItem('nyxo_tour_completed');
  currentStep = 1;
  stepperTransitioning = false;

  const overlay = $('#stepper-overlay');
  const authContainer = $('#auth-container');
  const appLayout = $('#app-layout');

  if (overlay) {
    if (appLayout) appLayout.style.display = 'none';
    if (authContainer) authContainer.style.display = 'none';
    overlay.style.display = 'flex';
    updateStepperUI();
    initParticles();
    document.addEventListener('keydown', handleStepperKeyboard);
  }
}

function addReplayButton() {
  const logoutContainer = document.querySelector('.logout-container');
  if (!logoutContainer || document.getElementById('btn-replay-tour')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-replay-tour';
  btn.className = 'btn btn-secondary btn-sm btn-replay-tour';
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span>Replay Tour</span>';
  btn.addEventListener('click', replayTour);
  logoutContainer.insertBefore(btn, logoutContainer.firstChild);
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
  console.log('DOMContentLoaded fired');
  // Always init controls first
  initWindowControls();
  initEventListeners();

  try {
    // Step 1: Check if tour has been shown before
    const hasTourBeenShown = localStorage.getItem('nyxo_tour_completed');
    
    if (!hasTourBeenShown) {
      // Show tour first for first-time users
      console.log('First time user - showing product tour');
      showFirstTimeTour();
      return;
    }
    
    // Step 2: If tour was already seen, proceed to activation/auth
    checkActivationAndAuth();
  } catch (e) {
    console.error('Initialization failed', e);
    // If tour was already seen, try activation/auth
    checkActivationAndAuth();
  }
});

async function checkActivationAndAuth() {
  try {
    // Step 1: Check activation status
    console.log('Checking activation status...');
    const activationStatus = await invoke('check_activation_status');
    console.log('Activation status:', activationStatus);
    
    if (!activationStatus.is_activated) {
      // Show activation screen
      renderActivationScreen();
      return;
    }
    
    // Step 2: Check current session
    console.log('Checking current session...');
    const session = await invoke('get_current_session');
    console.log('Session response:', session);
    if (session) {
      currentUser = session;
      showApp();
    } else {
      console.log('No session, calling initAuth');
      initAuth();
    }
  } catch (e) {
    console.error('Activation/Auth check failed', e);
    // If activation check fails due to network, try offline verification
    try {
      const isActivatedOffline = await invoke('verify_offline_activation');
      if (isActivatedOffline) {
        initAuth();
      } else {
        renderActivationScreen('Unable to verify activation. Please connect to the internet.');
      }
    } catch (offlineErr) {
      renderActivationScreen();
    }
  }
}

function showFirstTimeTour() {
  const overlay = $('#stepper-overlay');
  const authContainer = $('#auth-container');
  const appLayout = $('#app-layout');

  if (overlay && authContainer && appLayout) {
    authContainer.style.display = 'none';
    appLayout.style.display = 'none';
    overlay.style.display = 'flex';
    currentStep = 1;
    stepperTransitioning = false;
    updateStepperUI();
    initParticles();

    // Setup event listeners
    $('#stepper-next').addEventListener('click', nextStep);
    $('#stepper-prev').addEventListener('click', prevStep);
    $('#stepper-skip').addEventListener('click', skipTour);

    // Dot click navigation
    $$('.stepper-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const targetStep = parseInt(dot.dataset.step);
        if (targetStep !== currentStep && !stepperTransitioning) {
          goToStep(targetStep);
        }
      });
    });

    // Add keyboard navigation
    document.addEventListener('keydown', handleStepperKeyboard);
  }
}

function handleStepperKeyboard(e) {
  const overlay = $('#stepper-overlay');
  if (!overlay || overlay.style.display === 'none') {
    document.removeEventListener('keydown', handleStepperKeyboard);
    return;
  }

  if (stepperTransitioning) return;

  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    nextStep();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevStep();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    skipTour();
  }
}

// ══════════════════════════════════════════════════════════
//  ACTIVATION SCREEN
// ══════════════════════════════════════════════════════════

function renderActivationScreen(errorMessage = null) {
  const container = $('#auth-container');
  container.style.display = 'flex';
  $('#app-layout').style.display = 'none';
  
  container.innerHTML = `
    <div class="auth-left">
      <div class="auth-brand-large">NyxoWealth</div>
      <div class="auth-tagline">
        Professional billing and accounting software for modern businesses.
      </div>
      
      <div class="auth-visuals">
        <div class="glass-card">
          <div class="glass-header">
            <div class="glass-icon" style="background: linear-gradient(135deg, #10b981, #059669);"></div>
            <div class="glass-lines">
               <div class="glass-line" style="width: 80%"></div>
               <div class="glass-line" style="width: 50%"></div>
            </div>
          </div>
          <div class="glass-stat">
             <div class="glass-stat-label">License Activation</div>
             <div class="glass-stat-value" style="font-size: 1.2rem;">Enter your key to unlock</div>
          </div>
        </div>
        
        <div class="floating-orb orb-1"></div>
        <div class="floating-orb orb-2"></div>
      </div>
    </div>
    
    <div class="auth-right">
      <div class="login-wrapper">
        <div class="login-header">
          <h2 class="login-title">Activate Your License</h2>
          <p class="login-subtitle">Enter your activation key to unlock NyxoWealth.</p>
        </div>
        
        ${errorMessage ? `<div class="activation-error" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 16px; color: #ef4444; font-size: 0.9rem;">${errorMessage}</div>` : ''}
        
        <form id="activation-form">
          <div class="auth-input-group">
            <label class="auth-input-label">Activation Key</label>
            <input type="text" class="auth-input" name="activation_key" required 
                   placeholder="XXXX-XXXX-XXXX-XXXX"
                   style="text-transform: uppercase; letter-spacing: 2px; font-family: monospace; font-size: 1.1rem;"
                   autocomplete="off" autofocus />
          </div>
          
          <div id="activation-status" style="margin-bottom: 16px; padding: 12px; border-radius: 8px; display: none;"></div>
          
          <button type="submit" class="btn btn-primary" id="activate-btn" style="width:100%; justify-content:center; padding: 14px; font-size: 1rem;">
            <span id="activate-btn-text">Activate License</span>
            <span id="activate-spinner" style="display: none; margin-left: 8px;">⟳</span>
          </button>
        </form>
        
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Don't have an activation key?<br/>
            Contact support or your vendor for a valid license.
          </p>
        </div>
        
        <div class="auth-footer">
          &copy; ${new Date().getFullYear()} NyxoLabs Solutions. All rights reserved.
        </div>
      </div>
    </div>
  `;

  // Handle activation form submission
  $('#activation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fd = new FormData(e.target);
    const key = fd.get('activation_key');
    const btn = $('#activate-btn');
    const btnText = $('#activate-btn-text');
    const spinner = $('#activate-spinner');
    const statusDiv = $('#activation-status');
    
    // Disable button and show spinner
    btn.disabled = true;
    btnText.textContent = 'Activating...';
    spinner.style.display = 'inline';
    statusDiv.style.display = 'none';
    
    try {
      const result = await invoke('activate_with_key', { key });
      
      // Show success
      statusDiv.style.display = 'block';
      statusDiv.style.background = 'rgba(16, 185, 129, 0.1)';
      statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      statusDiv.style.color = '#10b981';
      statusDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg> License activated successfully! Redirecting...';
      
      // Wait a moment then proceed to auth
      setTimeout(() => {
        initAuth();
      }, 1500);
      
    } catch (err) {
      // Show error
      statusDiv.style.display = 'block';
      statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
      statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      statusDiv.style.color = '#ef4444';
      statusDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> ' + err;
      
      // Re-enable button
      btn.disabled = false;
      btnText.textContent = 'Activate License';
      spinner.style.display = 'none';
    }
  });
}

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
          <a href="#create-invoice" class="btn btn-primary" data-perm="create_invoices"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> New Invoice</a>
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
    <div class="page-enter" data-perm="view_customers">
      <div class="page-header">
        <div>
          <h1 class="page-title">Customers</h1>
          <p class="page-subtitle">${customers.length} customer${customers.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="search-bar">
            <input class="form-input" id="customer-search" placeholder="Search customers..." />
          </div>
          <button class="btn btn-primary" id="btn-add-customer" data-perm="create_customers"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add Customer</button>
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
              <th class="col-actions">Actions</th>
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
          <button class="btn btn-secondary btn-sm btn-icon edit-customer" data-id="${c.id}" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' data-perm="edit_customers"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-icon delete-customer" data-id="${c.id}" data-name="${escHtml(c.name)}" data-perm="delete_customers"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
    <div class="page-enter" data-perm="view_products">
      <div class="page-header">
        <div>
          <h1 class="page-title">Products & Services</h1>
          <p class="page-subtitle">${products.length} item${products.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="search-bar">
            <input class="form-input" id="product-search" placeholder="Search products..." />
          </div>
          <button class="btn btn-primary" id="btn-add-product" data-perm="create_products"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add Product</button>
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
              <th class="col-actions">Actions</th>
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
          <button class="btn btn-secondary btn-sm btn-icon edit-product" data-id="${p.id}" data-json='${JSON.stringify(p).replace(/'/g, "&#39;")}' data-perm="edit_products"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-icon delete-product" data-id="${p.id}" data-name="${escHtml(p.name)}" data-perm="delete_products"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
    <div class="page-enter" data-perm="create_invoices">
      <div class="page-header">
        <div>
          <h1 class="page-title">Create Invoice</h1>
          <p class="page-subtitle">Fill in details and add line items</p>
        </div>
      </div>

      <form id="invoice-form" class="card invoice-form-card">
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
              <th class="col-product">Product / Description</th>
              <th class="col-qty">Qty</th>
              <th class="col-price">Unit Price</th>
              <th class="col-tax">Tax %</th>
              <th class="col-total">Line Total</th>
              <th class="col-remove"></th>
            </tr>
          </thead>
          <tbody id="invoice-items-body">
          </tbody>
        </table>

        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add Item</button>

        <div class="invoice-totals">
          <div class="invoice-totals-inner">
            <div class="totals-row"><span>Subtotal</span><span id="inv-subtotal">$0.00</span></div>
            <div class="totals-row"><span>Tax</span><span id="inv-tax">$0.00</span></div>
            <div class="totals-row">
              <span>Advance</span>
              <span><input class="form-input totals-input" id="inv-advance" name="advance" type="number" step="0.01" min="0" value="0" /></span>
            </div>
            <div class="totals-row">
              <span>Discount %</span>
              <span><input class="form-input totals-input" id="inv-discount-percent" name="discount_percent" type="number" step="0.1" min="0" max="100" value="0" /></span>
            </div>
            <div class="totals-row grand-total"><span>Total Due</span><span id="inv-total">$0.00</span></div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="location.hash='dashboard'">Cancel</button>
          <button type="submit" class="btn btn-primary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Invoice</button>
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
      <td><button type="button" class="btn btn-danger btn-sm btn-icon remove-item" data-idx="${itemIndex}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
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

    const advance = Number($('#inv-advance')?.value || 0);
    const discountPct = Number($('#inv-discount-percent')?.value || 0);
    const discountAmount = (subtotal + tax) * discountPct / 100;
    const total = subtotal + tax - advance - discountAmount;

    $('#inv-subtotal').textContent = currency(subtotal);
    $('#inv-tax').textContent = currency(tax);
    $('#inv-total').textContent = currency(total);
  }

  $('#btn-add-item').addEventListener('click', addItemRow);
  $('#inv-advance').addEventListener('input', recalcTotals);
  $('#inv-discount-percent').addEventListener('input', recalcTotals);

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
        discount: 0,
        discountPercent: Number(fd.get('discount_percent') || 0),
        advance: Number(fd.get('advance') || 0),
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

  // Build unique customer list for dropdown
  const customers = [...new Set(invoices.map(i => i.customer_name).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">Invoice History</h1>
          <p class="page-subtitle" id="invoice-count">${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="#create-invoice" class="btn btn-primary" data-perm="create_invoice"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> New Invoice</a>
      </div>
      <div class="filter-bar">
        <div class="filter-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="invoice-filter">
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="form-label">Customer</label>
          <select class="form-select" id="invoice-customer-filter">
            <option value="">All Customers</option>
            ${customers.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="form-label">From Date</label>
          <input type="date" class="form-input" id="invoice-date-from" />
        </div>
        <div class="filter-group">
          <label class="form-label">To Date</label>
          <input type="date" class="form-input" id="invoice-date-to" />
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-clear-invoice-filters">Clear</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Advance</th>
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

  function applyFilters() {
    const status = $('#invoice-filter').value;
    const customer = $('#invoice-customer-filter').value;
    const dateFrom = $('#invoice-date-from').value;
    const dateTo = $('#invoice-date-to').value;

    const filtered = invoices.filter(i => {
      if (status && i.status !== status) return false;
      if (customer && i.customer_name !== customer) return false;
      if (dateFrom && i.issue_date < dateFrom) return false;
      if (dateTo && i.issue_date > dateTo) return false;
      return true;
    });

    $('#invoices-tbody').innerHTML = invoiceRows(filtered);
    const total = invoices.length;
    const shown = filtered.length;
    $('#invoice-count').textContent = total === shown
      ? `${total} invoice${total !== 1 ? 's' : ''}`
      : `Showing ${shown} of ${total} invoice${total !== 1 ? 's' : ''}`;
  }

  $('#invoice-filter').addEventListener('change', applyFilters);
  $('#invoice-customer-filter').addEventListener('change', applyFilters);
  $('#invoice-date-from').addEventListener('change', applyFilters);
  $('#invoice-date-to').addEventListener('change', applyFilters);

  $('#btn-clear-invoice-filters').addEventListener('click', () => {
    $('#invoice-filter').value = '';
    $('#invoice-customer-filter').value = '';
    $('#invoice-date-from').value = '';
    $('#invoice-date-to').value = '';
    applyFilters();
  });
}

function invoiceRows(list) {
  if (list.length === 0) return '<tr><td colspan="7" class="table-empty">No invoices found</td></tr>';
  return list.map(inv => `
    <tr class="clickable-row" onclick="location.hash='invoice-detail/${inv.id}'">
      <td>${escHtml(inv.invoice_number)}</td>
      <td>${escHtml(inv.customer_name) || '—'}</td>
      <td>${escHtml(inv.issue_date)}</td>
      <td>${escHtml(inv.due_date)}</td>
      <td>${inv.advance > 0 ? currency(inv.advance) : '—'}</td>
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
          <select class="form-select status-select" id="status-select" data-perm="edit_invoices">
            ${['Draft','Sent','Paid','Overdue','Cancelled'].map(s =>
              `<option value="${s}" ${inv.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary" id="btn-export-pdf"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Export PDF</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-invoice" data-perm="delete_invoices">Delete</button>
        </div>
      </div>

      <div class="invoice-meta">
        <div>
          <div class="meta-label">Customer</div>
          <div class="meta-value">${escHtml(inv.customer_name) || '—'}</div>
        </div>
        ${inv.customer_phone ? `<div>
          <div class="meta-label">Contact No</div>
          <div class="meta-value">${escHtml(inv.customer_phone)}</div>
        </div>` : ''}
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
          ${inv.advance > 0 ? `<div class="totals-row"><span>Advance</span><span>-${currency(inv.advance)}</span></div>` : ''}
          ${inv.discount_percent > 0 ? `<div class="totals-row"><span>Discount (${inv.discount_percent}%)</span><span>-${currency((inv.subtotal + inv.tax) * inv.discount_percent / 100)}</span></div>` : (inv.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${currency(inv.discount)}</span></div>` : '')}
          <div class="totals-row grand-total"><span>Total Due</span><span>${currency(inv.total)}</span></div>
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

  let customTemplates = [];
  try { customTemplates = await invoke('get_custom_templates'); } catch(e) { console.error(e); }

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

          <div class="form-group full-width form-section-divider">
            <label class="form-label">Company Logo</label>
            <div class="flex items-center gap-4">
               <input class="form-input" name="logo_path" id="settings-logo-path" readonly value="${escHtml(settings.logo_path || '')}" placeholder="No logo selected" />
               <button type="button" class="btn btn-secondary" id="btn-select-logo">Select Logo</button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Supports PNG and JPG. Logo will be scaled to fit header.</p>
          </div>

          <div class="form-group full-width">
            <label class="form-label">Business Tagline</label>
            <input class="form-input" name="business_tagline" value="${escHtml(settings.business_tagline || '')}" placeholder="e.g. Sri Lankan No #1 Voice Over & Social Media Service" />
          </div>

          <div class="form-group full-width form-section-divider">
            <label class="form-label">Authorised Signature</label>
            <div class="flex items-center gap-4">
               <input class="form-input" name="signature_path" id="settings-signature-path" readonly value="${escHtml(settings.signature_path || '')}" placeholder="No signature selected" />
               <button type="button" class="btn btn-secondary" id="btn-select-signature">Select Signature</button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Supports PNG and JPG. Transparent background recommended.</p>
          </div>

          <div class="form-group full-width form-section-divider">
            <label class="form-label">QR Code Image</label>
            <div class="flex items-center gap-4">
               <input class="form-input" name="qr_code_path" id="settings-qr-path" readonly value="${escHtml(settings.qr_code_path || '')}" placeholder="No QR code selected" />
               <button type="button" class="btn btn-secondary" id="btn-select-qr">Select QR Code</button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Supports PNG and JPG. Shows in invoice footer.</p>
          </div>

          <div class="form-group full-width form-section-divider">
            <h3 style="margin:0 0 12px 0;font-size:var(--font-size-md);font-weight:600;">Bank Details (for Invoice)</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Bank Name</label>
                <input class="form-input" name="bank_name" value="${escHtml(settings.bank_name || '')}" placeholder="e.g. Bank Of Ceylon" />
              </div>
              <div class="form-group">
                <label class="form-label">Account Holder Name</label>
                <input class="form-input" name="bank_account_name" value="${escHtml(settings.bank_account_name || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Account Number</label>
                <input class="form-input" name="bank_account_no" value="${escHtml(settings.bank_account_no || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Branch</label>
                <input class="form-input" name="bank_branch" value="${escHtml(settings.bank_branch || '')}" />
              </div>
            </div>
          </div>

          <div class="form-group full-width">
            <label class="form-label">Default Invoice Footer</label>
            <textarea class="form-textarea" name="default_footer" placeholder="e.g. Thank you for your business!">${escHtml(settings.default_footer || '')}</textarea>
          </div>

          <div class="form-group full-width">
            <label class="form-label">Invoice Template</label>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <select class="form-select" name="template_type" style="flex: 1;">
                <option value="Basic" ${settings.template_type === 'Basic' ? 'selected' : ''}>Basic (Clean)</option>
                <option value="Professional" ${settings.template_type === 'Professional' ? 'selected' : ''}>Professional (Blue Accents)</option>
                <option value="Modern" ${settings.template_type === 'Modern' ? 'selected' : ''}>Modern (Stylish)</option>
                <option value="ClearStyle" ${settings.template_type === 'ClearStyle' ? 'selected' : ''}>Ruky Style (Signature & Bank Details)</option>
                ${customTemplates.map(ct => `<option value="Custom-${ct.id}" ${settings.template_type === 'Custom-' + ct.id ? 'selected' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> ${escHtml(ct.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-secondary" id="btn-preview-template" style="margin-top: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button>
              <button type="button" class="btn btn-primary" id="btn-go-templates" style="margin-top: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> Manage Templates</button>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings</button>
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

  $('#btn-select-signature').addEventListener('click', async () => {
    try {
      const { open } = window.__TAURI__.dialog;
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
      });
      if (selected) {
        toast('Uploading signature...');
        const newPath = await invoke('upload_signature', { sourcePath: selected });
        $('#settings-signature-path').value = newPath;
        toast('Signature uploaded successfully');
      }
    } catch (e) { toast(e, 'error'); }
  });

  $('#btn-select-qr').addEventListener('click', async () => {
    try {
      const { open } = window.__TAURI__.dialog;
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
      });
      if (selected) {
        toast('Uploading QR code...');
        const newPath = await invoke('upload_qr_code', { sourcePath: selected });
        $('#settings-qr-path').value = newPath;
        toast('QR code uploaded successfully');
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
        signaturePath: fd.get('signature_path') || null,
        bankName: fd.get('bank_name') || null,
        bankAccountName: fd.get('bank_account_name') || null,
        bankAccountNo: fd.get('bank_account_no') || null,
        bankBranch: fd.get('bank_branch') || null,
        businessTagline: fd.get('business_tagline') || null,
        qrCodePath: fd.get('qr_code_path') || null,
      });
      toast('Settings saved');
    } catch (err) { toast(err, 'error'); }
  });

  $('#btn-preview-template').addEventListener('click', async (e) => {
    e.preventDefault();
    const templateSelect = document.querySelector('select[name="template_type"]');
    const selectedTemplate = templateSelect.value;
    if (selectedTemplate.startsWith('Custom-')) {
      const ctId = parseInt(selectedTemplate.replace('Custom-', ''));
      const ct = customTemplates.find(t => t.id === ctId);
      if (ct) {
        const html = generateCustomTemplatePreview(ct, settings);
        openModal(`Custom Template Preview - ${ct.name}`, `
          <div style="max-height: 70vh; overflow-y: auto; background: #f3f4f6; padding: 20px; border-radius: 8px;">
            <div style="background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">${html}</div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          </div>
        `);
      }
    } else {
      previewInvoiceTemplate(selectedTemplate, settings);
    }
  });

  $('#btn-go-templates').addEventListener('click', () => {
    location.hash = 'templates';
  });
}

// ══════════════════════════════════════════════════════════
//  INVOICE TEMPLATE PREVIEW
// ══════════════════════════════════════════════════════════

function generateSampleInvoicePreview(template, settings) {
  const sampleData = {
    invoice_number: '2024-001',
    business_name: settings.business_name,
    business_address: settings.business_address || '123 Business Street',
    business_phone: settings.business_phone || '+1 (555) 123-4567',
    business_email: settings.business_email || 'hello@example.com',
    business_tagline: settings.business_tagline || 'Your trusted partner',
    customer_name: 'Acme Corporation',
    customer_address: '456 Client Ave, City, State 12345',
    customer_phone: '+94 77 123 4567',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '2024-02-28',
    subtotal: 5000,
    tax: 500,
    discount_percent: 5,
    advance: 1000,
    total: 4225,
    items: [
      { description: 'Web Design Services', product_name: 'Web Design Services', quantity: 1, unit_price: 3000, tax_percent: 10, line_total: 3000 },
      { description: 'Development & Implementation', product_name: 'Development & Implementation', quantity: 1, unit_price: 2000, tax_percent: 10, line_total: 2000 }
    ]
  };

  if (template === 'Basic') {
    return generateBasicTemplate(sampleData, settings);
  } else if (template === 'Professional') {
    return generateProfessionalTemplate(sampleData, settings);
  } else if (template === 'Modern') {
    return generateModernTemplate(sampleData, settings);
  } else if (template === 'ClearStyle') {
    return generateClearStyleTemplate(sampleData, settings);
  }
  return generateBasicTemplate(sampleData, settings);
}

function generateBasicTemplate(data, settings) {
  return `
    <div style="background: white; color: #000; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px;">${escHtml(data.business_name)}</h1>
        <p style="margin: 5px 0; font-size: 13px; color: #666;">
          ${escHtml(data.business_address)}<br/>
          ${escHtml(data.business_phone)} | ${escHtml(data.business_email)}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
        <div>
          <strong style="display: block; margin-bottom: 8px;">BILL TO:</strong>
          <p style="margin: 0; font-size: 14px; line-height: 1.6;">
            ${escHtml(data.customer_name)}<br/>
            ${escHtml(data.customer_address)}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #666;">INVOICE NUMBER</div>
            <div style="font-size: 20px; font-weight: bold;">${data.invoice_number}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #666;">DUE DATE</div>
            <div style="font-size: 14px; font-weight: bold;">${data.due_date}</div>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f5f5f5; border-bottom: 2px solid #000;">
            <th style="padding: 12px; text-align: left; font-weight: bold;">DESCRIPTION</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">QTY</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">RATE</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 12px; text-align: left;">${escHtml(item.description)}</td>
              <td style="padding: 12px; text-align: right;">${item.quantity}</td>
              <td style="padding: 12px; text-align: right;">${settings.currency_symbol}${item.unit_price.toFixed(2)}</td>
              <td style="padding: 12px; text-align: right;">${settings.currency_symbol}${item.line_total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div style="font-size: 13px;">
          <strong>Notes:</strong>
          <p style="margin: 8px 0 0 0; color: #666;">Thank you for your business!</p>
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
            <span>Subtotal:</span>
            <span>${settings.currency_symbol}${data.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #ddd;">
            <span>${settings.tax_label}:</span>
            <span>${settings.currency_symbol}${data.tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
            <span>TOTAL:</span>
            <span>${settings.currency_symbol}${data.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateProfessionalTemplate(data, settings) {
  return `
    <div style="background: white; color: #1a365d; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; margin: -40px -40px 40px -40px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">INVOICE</h1>
        <p style="margin: 0; font-size: 14px; opacity: 0.9;">${escHtml(data.business_name)}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
        <div>
          <strong style="display: block; margin-bottom: 12px; color: #3b82f6;">FROM:</strong>
          <p style="margin: 0; font-size: 14px; line-height: 1.8;">
            <strong style="color: #1a365d;">${escHtml(data.business_name)}</strong><br/>
            ${escHtml(data.business_address)}<br/>
            ${escHtml(data.business_phone)}<br/>
            ${escHtml(data.business_email)}
          </p>
        </div>
        <div>
          <strong style="display: block; margin-bottom: 12px; color: #3b82f6;">BILL TO:</strong>
          <p style="margin: 0; font-size: 14px; line-height: 1.8;">
            <strong style="color: #1a365d;">${escHtml(data.customer_name)}</strong><br/>
            ${escHtml(data.customer_address)}
          </p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; background: #f0f9ff; padding: 20px; border-radius: 8px;">
        <div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">INVOICE #</div>
          <div style="font-size: 18px; font-weight: bold; color: #1a365d;">${data.invoice_number}</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">ISSUE DATE</div>
          <div style="font-size: 18px; font-weight: bold; color: #1a365d;">${data.issue_date}</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">DUE DATE</div>
          <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">${data.due_date}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1e40af; color: white; border-radius: 4px;">
            <th style="padding: 12px; text-align: left; font-weight: bold;">DESCRIPTION</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">QTY</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">RATE</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr style="border-bottom: 1px solid #e0e7ff;">
              <td style="padding: 12px; text-align: left;">${escHtml(item.description)}</td>
              <td style="padding: 12px; text-align: right;">${item.quantity}</td>
              <td style="padding: 12px; text-align: right;">${settings.currency_symbol}${item.unit_price.toFixed(2)}</td>
              <td style="padding: 12px; text-align: right; font-weight: 600;">${settings.currency_symbol}${item.line_total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div></div>
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px;">
            <span style="color: #64748b;">Subtotal:</span>
            <span style="font-weight: 600; color: #1a365d;">${settings.currency_symbol}${data.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #bfdbfe;">
            <span style="color: #64748b;">${settings.tax_label}:</span>
            <span style="font-weight: 600; color: #1a365d;">${settings.currency_symbol}${data.tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #3b82f6;">
            <span>TOTAL:</span>
            <span>${settings.currency_symbol}${data.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateModernTemplate(data, settings) {
  return `
    <div style="background: white; color: #1f2937; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
            ${escHtml(data.business_name)}
          </h1>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280;">
            ${escHtml(data.business_phone)} • ${escHtml(data.business_email)}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Invoice</div>
          <div style="font-size: 28px; font-weight: 700; color: #8b5cf6;">#${data.invoice_number}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
        <div>
          <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Bill To</div>
          <p style="margin: 0; font-size: 15px; line-height: 1.8;">
            <strong style="color: #1f2937;">${escHtml(data.customer_name)}</strong><br/>
            <span style="color: #6b7280;">${escHtml(data.customer_address)}</span>
          </p>
        </div>
        <div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 600;">Issue Date</div>
              <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${data.issue_date}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 600;">Due Date</div>
              <div style="font-size: 14px; font-weight: 600; color: #ec4899;">${data.due_date}</div>
            </div>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="border-top: 2px solid #e5e7eb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 12px 0; text-align: left; font-weight: 600; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">ITEM</th>
            <th style="padding: 12px 0; text-align: right; font-weight: 600; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">QTY</th>
            <th style="padding: 12px 0; text-align: right; font-weight: 600; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, i) => `
            <tr style="border-bottom: 1px solid #f3f4f6; ${i % 2 === 0 ? 'background: #fafbfc;' : ''}">
              <td style="padding: 16px 0; font-size: 14px;">${escHtml(item.description)}</td>
              <td style="padding: 16px 0; text-align: right; font-size: 14px;">${item.quantity}</td>
              <td style="padding: 16px 0; text-align: right; font-weight: 600; color: #1f2937;">${settings.currency_symbol}${item.line_total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 300px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
            <span style="color: #6b7280;">Subtotal</span>
            <span style="color: #1f2937;">${settings.currency_symbol}${data.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; font-size: 14px;">
            <span style="color: #6b7280;">${settings.tax_label}</span>
            <span style="color: #1f2937;">${settings.currency_symbol}${data.tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700;">
            <span style="background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">TOTAL</span>
            <span style="background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${settings.currency_symbol}${data.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateClearStyleTemplate(data, settings) {
  const logoUrl = settings.logo_path ? window.__TAURI__.core.convertFileSrc(settings.logo_path) : '';
  const signatureUrl = settings.signature_path ? window.__TAURI__.core.convertFileSrc(settings.signature_path) : '';
  const qrCodeUrl = settings.qr_code_path ? window.__TAURI__.core.convertFileSrc(settings.qr_code_path) : '';
  const advanceAmt = data.advance || 0;
  const discountPct = data.discount_percent || 0;
  const discountAmt = discountPct > 0 ? (data.subtotal + data.tax) * discountPct / 100 : 0;
  const totalDue = data.subtotal + data.tax - advanceAmt - discountAmt;

  return `
    <div style="background: white; color: #000; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div>
          ${logoUrl ? `<img src="${logoUrl}" style="max-height: 70px; max-width: 180px; object-fit: contain;" alt="Logo"/>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #444;"><strong>Invoice No:</strong> ${escHtml(data.invoice_number)}</div>
          <div style="font-size: 12px; color: #444;"><strong>Date:</strong> ${escHtml(data.issue_date)}</div>
        </div>
      </div>

      <!-- Business Name & Tagline -->
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #222; padding-bottom: 12px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #111;">${escHtml(data.business_name)}</h1>
        ${settings.business_tagline ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666; letter-spacing: 1px;">${escHtml(settings.business_tagline)}</p>` : ''}
      </div>

      <!-- Customer Details -->
      <div style="margin-bottom: 20px; padding: 12px; background: #f9f9f9; border-radius: 4px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div><strong>Customer Name:</strong> ${escHtml(data.customer_name)}</div>
          <div><strong>Contact No:</strong> ${escHtml(data.customer_phone || '—')}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #222; color: #fff;">
            <th style="padding: 10px 8px; text-align: center; font-size: 12px; width: 40px;">No</th>
            <th style="padding: 10px 8px; text-align: left; font-size: 12px;">Service</th>
            <th style="padding: 10px 8px; text-align: left; font-size: 12px;">Description</th>
            <th style="padding: 10px 8px; text-align: right; font-size: 12px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${(data.items || []).map((item, idx) => `
            <tr style="border-bottom: 1px solid #ddd; ${idx % 2 === 0 ? 'background: #fafafa;' : ''}">
              <td style="padding: 10px 8px; text-align: center;">${idx + 1}</td>
              <td style="padding: 10px 8px;">${escHtml(item.product_name || item.description)}</td>
              <td style="padding: 10px 8px; color: #555;">${escHtml(item.description || '')}</td>
              <td style="padding: 10px 8px; text-align: right; font-weight: 600;">${settings.currency_symbol}${item.line_total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
        <div style="width: 280px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; padding: 8px 14px; background: #f5f5f5; border-bottom: 1px solid #ddd;">
            <span>Total</span>
            <span style="font-weight: 600;">${settings.currency_symbol}${(data.subtotal + data.tax).toFixed(2)}</span>
          </div>
          ${advanceAmt > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #ddd;">
            <span>Advance</span>
            <span style="color: #c0392b;">-${settings.currency_symbol}${advanceAmt.toFixed(2)}</span>
          </div>` : ''}
          ${discountPct > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #ddd;">
            <span>Discount (${discountPct}%)</span>
            <span style="color: #c0392b;">-${settings.currency_symbol}${discountAmt.toFixed(2)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; padding: 10px 14px; background: #222; color: #fff; font-weight: 700; font-size: 15px;">
            <span>Total Due</span>
            <span>${settings.currency_symbol}${totalDue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Bank Details + Signature -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          ${(settings.bank_name || settings.bank_account_no) ? `
          <div style="padding: 12px; background: #f9f9f9; border-radius: 4px; font-size: 12px;">
            <strong style="display: block; margin-bottom: 6px; font-size: 13px;">Bank Details</strong>
            ${settings.bank_name ? `<div><strong>Bank:</strong> ${escHtml(settings.bank_name)}</div>` : ''}
            ${settings.bank_account_name ? `<div><strong>Account Name:</strong> ${escHtml(settings.bank_account_name)}</div>` : ''}
            ${settings.bank_account_no ? `<div><strong>Account No:</strong> ${escHtml(settings.bank_account_no)}</div>` : ''}
            ${settings.bank_branch ? `<div><strong>Branch:</strong> ${escHtml(settings.bank_branch)}</div>` : ''}
          </div>
          ` : ''}
        </div>
        <div style="text-align: right;">
          ${signatureUrl ? `
            <img src="${signatureUrl}" style="max-height: 60px; max-width: 160px; object-fit: contain; margin-bottom: 4px;" alt="Signature"/>
            <div style="border-top: 1px solid #999; display: inline-block; padding-top: 4px; font-size: 11px; color: #666;">Authorised Sign</div>
          ` : `
            <div style="margin-top: 40px; border-top: 1px solid #999; display: inline-block; padding-top: 4px; font-size: 11px; color: #666;">Authorised Sign</div>
          `}
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 2px solid #222; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #666;">
        <div>
          ${qrCodeUrl ? `<img src="${qrCodeUrl}" style="width: 60px; height: 60px; object-fit: contain;" alt="QR"/>` : ''}
        </div>
        <div style="text-align: right;">
          ${data.business_phone ? `<div>${escHtml(data.business_phone)}</div>` : ''}
          ${data.business_email ? `<div>${escHtml(data.business_email)}</div>` : ''}
          ${data.business_address ? `<div>${escHtml(data.business_address)}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function previewInvoiceTemplate(template, settings) {
  const previewHTML = generateSampleInvoicePreview(template, settings);
  const modalContent = `
    <div style="max-height: 70vh; overflow-y: auto; background: #f3f4f6; padding: 20px; border-radius: 8px;">
      <div style="background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        ${previewHTML}
      </div>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="printInvoicePreview()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>
    </div>
  `;
  
  openModal(`Invoice Template Preview - ${template}`, modalContent);
}

function printInvoicePreview() {
  try {
    const modalBody = $('#modal-body');
    const printContent = modalBody.querySelector('div').innerHTML;
    const printWindow = window.open('', '', 'width=900,height=1000');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice Preview</title>
        <style>
          body { margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  } catch (e) {
    toast('Error printing preview: ' + e, 'error');
  }
}

// ══════════════════════════════════════════════════════════
//  CUSTOM TEMPLATES PAGE
// ══════════════════════════════════════════════════════════

async function renderTemplates(container) {
  let customTemplates = [];
  let settings;
  try {
    customTemplates = await invoke('get_custom_templates');
    settings = await invoke('get_settings');
  } catch (e) {
    container.innerHTML = `<p>Error: ${e}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> Invoice Templates</h1>
          <p class="page-subtitle">Design and manage your custom invoice templates</p>
        </div>
        <button class="btn btn-primary" id="btn-new-template"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create New Template</button>
      </div>

      <!-- Built-in Templates -->
      <div class="card" style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">Built-in Templates</h2>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-muted);">Pre-designed templates ready to use</p>
        <div class="custom-templates-grid">
          ${['Basic', 'Professional', 'Modern', 'ClearStyle'].map(name => {
            const colors = { Basic: ['#000000', '#333333', '#f5f5f5'], Professional: ['#1e40af', '#3b82f6', '#ffffff'], Modern: ['#8b5cf6', '#ec4899', '#ffffff'], ClearStyle: ['#222222', '#c0392b', '#f9f9f9'] };
            const desc = { Basic: 'Clean & minimal', Professional: 'Blue corporate', Modern: 'Gradient stylish', ClearStyle: 'Classic with signature' };
            return `
              <div class="ct-card ${settings.template_type === name ? 'ct-active' : ''}" data-builtin="${name}">
                <div class="ct-card-colors">
                  <div class="ct-swatch" style="background: ${colors[name][0]};"></div>
                  <div class="ct-swatch" style="background: ${colors[name][1]};"></div>
                  <div class="ct-swatch" style="background: ${colors[name][2]};"></div>
                </div>
                <div class="ct-card-name">${name}</div>
                <div class="ct-card-meta">${desc[name]}</div>
                <div class="ct-card-actions">
                  <button class="btn btn-secondary btn-sm builtin-preview" data-name="${name}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button>
                  <button class="btn btn-primary btn-sm builtin-use" data-name="${name}" ${settings.template_type === name ? 'disabled' : ''}>
                    ${settings.template_type === name ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg> Active' : 'Use'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Custom Templates -->
      <div class="card">
        <h2 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">Your Custom Templates</h2>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-muted);">Templates you've designed with full creative control</p>

        ${customTemplates.length === 0 ? `
          <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
            <div style="font-size: 56px; margin-bottom: 16px;"><svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>
            <p style="font-size: 16px; margin: 0; font-weight: 500;">No custom templates yet</p>
            <p style="font-size: 13px; margin: 6px 0 20px 0;">Create your first template with colors, fonts, and layouts of your choice</p>
            <button class="btn btn-primary" id="btn-empty-create"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Your First Template</button>
          </div>
        ` : `
          <div class="custom-templates-grid">
            ${customTemplates.map(ct => `
              <div class="ct-card ${settings.template_type === 'Custom-' + ct.id ? 'ct-active' : ''}" data-ct-id="${ct.id}">
                <div class="ct-card-colors">
                  <div class="ct-swatch" style="background: ${ct.header_bg_color};"></div>
                  <div class="ct-swatch" style="background: ${ct.accent_color};"></div>
                  <div class="ct-swatch" style="background: ${ct.header_text_color};"></div>
                </div>
                <div class="ct-card-name">${escHtml(ct.name)}</div>
                <div class="ct-card-meta">${ct.layout_style} • ${ct.font_family}</div>
                <div class="ct-card-actions">
                  <button class="btn btn-secondary btn-sm ct-preview" data-id="${ct.id}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button>
                  <button class="btn btn-secondary btn-sm ct-edit" data-id="${ct.id}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
                  <button class="btn btn-primary btn-sm ct-use" data-id="${ct.id}" ${settings.template_type === 'Custom-' + ct.id ? 'disabled' : ''}>
                    ${settings.template_type === 'Custom-' + ct.id ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg> Active' : 'Use'}
                  </button>
                  <button class="btn btn-danger btn-sm ct-delete" data-id="${ct.id}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Event listeners
  $('#btn-new-template').addEventListener('click', () => {
    location.hash = 'template-designer';
  });

  const emptyBtn = document.getElementById('btn-empty-create');
  if (emptyBtn) emptyBtn.addEventListener('click', () => { location.hash = 'template-designer'; });

  // Built-in preview
  document.querySelectorAll('.builtin-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      previewInvoiceTemplate(e.target.dataset.name, settings);
    });
  });

  // Built-in use
  document.querySelectorAll('.builtin-use').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = e.target.dataset.name;
      try {
        await invoke('update_settings', {
          businessName: settings.business_name,
          businessAddress: settings.business_address || null,
          businessPhone: settings.business_phone || null,
          businessEmail: settings.business_email || null,
          currencySymbol: settings.currency_symbol,
          taxLabel: settings.tax_label,
          logoPath: settings.logo_path || null,
          defaultFooter: settings.default_footer || null,
          templateType: name,
          signaturePath: settings.signature_path || null,
          bankName: settings.bank_name || null,
          bankAccountName: settings.bank_account_name || null,
          bankAccountNo: settings.bank_account_no || null,
          bankBranch: settings.bank_branch || null,
          businessTagline: settings.business_tagline || null,
          qrCodePath: settings.qr_code_path || null,
        });
        toast(`Template "${name}" is now active`);
        renderTemplates(container);
      } catch (err) { toast(err, 'error'); }
    });
  });

  // Custom template preview
  document.querySelectorAll('.ct-preview').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ctId = parseInt(e.target.dataset.id);
      const ct = customTemplates.find(t => t.id === ctId);
      if (ct) {
        const html = generateCustomTemplatePreview(ct, settings);
        openModal(`Preview - ${ct.name}`, `
          <div style="max-height: 70vh; overflow-y: auto; background: #f3f4f6; padding: 20px; border-radius: 8px;">
            <div style="background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">${html}</div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          </div>
        `);
      }
    });
  });

  // Custom template edit
  document.querySelectorAll('.ct-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ctId = e.target.dataset.id;
      location.hash = `template-designer?id=${ctId}`;
    });
  });

  // Custom template use
  document.querySelectorAll('.ct-use').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ctId = parseInt(e.target.dataset.id);
      try {
        await invoke('update_settings', {
          businessName: settings.business_name,
          businessAddress: settings.business_address || null,
          businessPhone: settings.business_phone || null,
          businessEmail: settings.business_email || null,
          currencySymbol: settings.currency_symbol,
          taxLabel: settings.tax_label,
          logoPath: settings.logo_path || null,
          defaultFooter: settings.default_footer || null,
          templateType: `Custom-${ctId}`,
          signaturePath: settings.signature_path || null,
          bankName: settings.bank_name || null,
          bankAccountName: settings.bank_account_name || null,
          bankAccountNo: settings.bank_account_no || null,
          bankBranch: settings.bank_branch || null,
          businessTagline: settings.business_tagline || null,
          qrCodePath: settings.qr_code_path || null,
        });
        const ct = customTemplates.find(t => t.id === ctId);
        toast(`Template "${ct ? ct.name : 'Custom'}" is now active`);
        renderTemplates(container);
      } catch (err) { toast(err, 'error'); }
    });
  });

  // Custom template delete
  document.querySelectorAll('.ct-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ctId = parseInt(e.target.dataset.id);
      if (confirm('Delete this custom template?')) {
        try {
          await invoke('delete_custom_template', { id: ctId });
          toast('Template deleted');
          renderTemplates(container);
        } catch(err) { toast(err, 'error'); }
      }
    });
  });
}

// ══════════════════════════════════════════════════════════
//  TEMPLATE DESIGNER PAGE (full page)
// ══════════════════════════════════════════════════════════

async function renderTemplateDesigner(container) {
  // Check if editing existing template via ?id=
  const hashParts = location.hash.split('?');
  let editId = null;
  if (hashParts[1]) {
    const params = new URLSearchParams(hashParts[1]);
    editId = params.get('id') ? parseInt(params.get('id')) : null;
  }

  let existingTemplate = null;
  if (editId) {
    try { existingTemplate = await invoke('get_custom_template', { id: editId }); } catch(e) { console.error(e); }
  }

  const isEdit = !!existingTemplate;
  const t = existingTemplate || {
    name: 'My Custom Template',
    header_bg_color: '#1e40af',
    header_text_color: '#ffffff',
    accent_color: '#3b82f6',
    font_family: 'Segoe UI',
    show_logo: true,
    show_business_address: true,
    show_business_phone: true,
    show_business_email: true,
    layout_style: 'classic',
    header_position: 'left',
    table_style: 'striped',
    show_tax_column: true,
    show_description_column: true,
    footer_text: 'Thank you for your business!',
    border_style: 'solid',
    border_color: '#e5e7eb',
  };

  let settings;
  try { settings = await invoke('get_settings'); } catch(e) { settings = { business_name: 'My Business', currency_symbol: '$', tax_label: 'Tax' }; }

  container.innerHTML = `
    <div class="page-enter">
      <div class="page-header">
        <div>
          <h1 class="page-title">${isEdit ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Template' : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> Create Template'}</h1>
          <p class="page-subtitle">${isEdit ? `Editing "${escHtml(t.name)}"` : 'Design your custom invoice template with live preview'}</p>
        </div>
        <button class="btn btn-secondary" id="td-btn-back">← Back to Templates</button>
      </div>

      <div class="template-designer-page">
        <div class="td-controls">
          <div class="td-section">
            <h3 class="td-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Template Name</h3>
            <input class="form-input" id="td-name" value="${escHtml(t.name)}" placeholder="Template name" />
          </div>

          <div class="td-section">
            <h3 class="td-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> Colors</h3>
            <div class="td-color-grid">
              <label class="td-color-item">
                <span>Header Background</span>
                <input type="color" id="td-header-bg" value="${t.header_bg_color}" />
              </label>
              <label class="td-color-item">
                <span>Header Text</span>
                <input type="color" id="td-header-text" value="${t.header_text_color}" />
              </label>
              <label class="td-color-item">
                <span>Accent Color</span>
                <input type="color" id="td-accent" value="${t.accent_color}" />
              </label>
              <label class="td-color-item">
                <span>Border Color</span>
                <input type="color" id="td-border-color" value="${t.border_color}" />
              </label>
            </div>
          </div>

          <div class="td-section">
            <h3 class="td-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> Typography</h3>
            <select class="form-select" id="td-font">
              ${['Segoe UI', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'].map(f =>
                `<option value="${f}" ${t.font_family === f ? 'selected' : ''}>${f}</option>`
              ).join('')}
            </select>
          </div>

          <div class="td-section">
            <h3 class="td-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Layout</h3>
            <div class="td-option-group">
              <label class="td-label-sm">Style</label>
              <select class="form-select" id="td-layout">
                <option value="classic" ${t.layout_style === 'classic' ? 'selected' : ''}>Classic</option>
                <option value="modern" ${t.layout_style === 'modern' ? 'selected' : ''}>Modern</option>
                <option value="minimal" ${t.layout_style === 'minimal' ? 'selected' : ''}>Minimal</option>
                <option value="bold" ${t.layout_style === 'bold' ? 'selected' : ''}>Bold</option>
              </select>
            </div>
            <div class="td-option-group">
              <label class="td-label-sm">Header Position</label>
              <select class="form-select" id="td-header-pos">
                <option value="left" ${t.header_position === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${t.header_position === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${t.header_position === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>
            <div class="td-option-group">
              <label class="td-label-sm">Table Style</label>
              <select class="form-select" id="td-table-style">
                <option value="striped" ${t.table_style === 'striped' ? 'selected' : ''}>Striped</option>
                <option value="bordered" ${t.table_style === 'bordered' ? 'selected' : ''}>Bordered</option>
                <option value="minimal" ${t.table_style === 'minimal' ? 'selected' : ''}>Minimal</option>
                <option value="clean" ${t.table_style === 'clean' ? 'selected' : ''}>Clean</option>
              </select>
            </div>
            <div class="td-option-group">
              <label class="td-label-sm">Border Style</label>
              <select class="form-select" id="td-border-style">
                <option value="solid" ${t.border_style === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${t.border_style === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="none" ${t.border_style === 'none' ? 'selected' : ''}>None</option>
              </select>
            </div>
          </div>

          <div class="td-section">
            <h3 class="td-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Visibility</h3>
            <div class="td-toggles">
              <label class="td-toggle"><input type="checkbox" id="td-show-logo" ${t.show_logo ? 'checked' : ''} /> Show Logo</label>
              <label class="td-toggle"><input type="checkbox" id="td-show-addr" ${t.show_business_address ? 'checked' : ''} /> Show Address</label>
              <label class="td-toggle"><input type="checkbox" id="td-show-phone" ${t.show_business_phone ? 'checked' : ''} /> Show Phone</label>
              <label class="td-toggle"><input type="checkbox" id="td-show-email" ${t.show_business_email ? 'checked' : ''} /> Show Email</label>
              <label class="td-toggle"><input type="checkbox" id="td-show-tax" ${t.show_tax_column ? 'checked' : ''} /> Tax Column</label>
              <label class="td-toggle"><input type="checkbox" id="td-show-desc" ${t.show_description_column ? 'checked' : ''} /> Description Column</label>
            </div>
          </div>

          <div class="td-section">
            <h3 class="td-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Footer</h3>
            <input class="form-input" id="td-footer" value="${escHtml(t.footer_text || '')}" placeholder="Custom footer text" />
          </div>
        </div>

        <div class="td-preview-area">
          <div class="td-preview-header">
            <h3>Live Preview</h3>
            <button class="btn btn-secondary btn-sm" id="td-btn-print"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>
          </div>
          <div class="td-preview-scroll">
            <div id="td-live-preview" class="td-preview-content"></div>
          </div>
        </div>
      </div>

      <div class="td-bottom-bar">
        <button class="btn btn-secondary" id="td-btn-cancel">← Cancel</button>
        <button class="btn btn-primary" id="td-btn-save">${isEdit ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Update Template' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Template'}</button>
      </div>
    </div>
  `;

  // Back button
  document.getElementById('td-btn-back').addEventListener('click', () => { location.hash = 'templates'; });
  document.getElementById('td-btn-cancel').addEventListener('click', () => { location.hash = 'templates'; });

  function getTemplateData() {
    return {
      name: $('#td-name').value,
      header_bg_color: $('#td-header-bg').value,
      header_text_color: $('#td-header-text').value,
      accent_color: $('#td-accent').value,
      font_family: $('#td-font').value,
      show_logo: $('#td-show-logo').checked,
      show_business_address: $('#td-show-addr').checked,
      show_business_phone: $('#td-show-phone').checked,
      show_business_email: $('#td-show-email').checked,
      layout_style: $('#td-layout').value,
      header_position: $('#td-header-pos').value,
      table_style: $('#td-table-style').value,
      show_tax_column: $('#td-show-tax').checked,
      show_description_column: $('#td-show-desc').checked,
      footer_text: $('#td-footer').value || null,
      border_style: $('#td-border-style').value,
      border_color: $('#td-border-color').value,
    };
  }

  function updateLivePreview() {
    const td = getTemplateData();
    const preview = document.getElementById('td-live-preview');
    if (!preview) return;
    preview.innerHTML = generateCustomTemplatePreview(td, settings);
  }

  // Attach change listeners to all controls
  const controls = document.querySelectorAll('.td-controls input, .td-controls select');
  controls.forEach(el => {
    el.addEventListener('input', updateLivePreview);
    el.addEventListener('change', updateLivePreview);
  });

  // Initial preview
  updateLivePreview();

  // Print
  document.getElementById('td-btn-print').addEventListener('click', () => {
    const preview = document.getElementById('td-live-preview');
    if (!preview) return;
    const pw = window.open('', '', 'width=900,height=1000');
    pw.document.write(`<!DOCTYPE html><html><head><title>Template Preview</title><style>body{margin:0;padding:20px;}@media print{body{padding:0;}}</style></head><body>${preview.innerHTML}</body></html>`);
    pw.document.close();
    pw.print();
  });

  // Save
  document.getElementById('td-btn-save').addEventListener('click', async () => {
    const data = getTemplateData();
    if (!data.name.trim()) { toast('Please enter a template name', 'error'); return; }
    try {
      if (isEdit && existingTemplate.id) {
        await invoke('update_custom_template', {
          id: existingTemplate.id,
          name: data.name,
          headerBgColor: data.header_bg_color,
          headerTextColor: data.header_text_color,
          accentColor: data.accent_color,
          fontFamily: data.font_family,
          showLogo: data.show_logo,
          showBusinessAddress: data.show_business_address,
          showBusinessPhone: data.show_business_phone,
          showBusinessEmail: data.show_business_email,
          layoutStyle: data.layout_style,
          headerPosition: data.header_position,
          tableStyle: data.table_style,
          showTaxColumn: data.show_tax_column,
          showDescriptionColumn: data.show_description_column,
          footerText: data.footer_text,
          borderStyle: data.border_style,
          borderColor: data.border_color,
        });
        toast('Template updated!');
      } else {
        await invoke('create_custom_template', {
          name: data.name,
          headerBgColor: data.header_bg_color,
          headerTextColor: data.header_text_color,
          accentColor: data.accent_color,
          fontFamily: data.font_family,
          showLogo: data.show_logo,
          showBusinessAddress: data.show_business_address,
          showBusinessPhone: data.show_business_phone,
          showBusinessEmail: data.show_business_email,
          layoutStyle: data.layout_style,
          headerPosition: data.header_position,
          tableStyle: data.table_style,
          showTaxColumn: data.show_tax_column,
          showDescriptionColumn: data.show_description_column,
          footerText: data.footer_text,
          borderStyle: data.border_style,
          borderColor: data.border_color,
        });
        toast('Template created!');
      }
      location.hash = 'templates';
    } catch (err) {
      toast('Error saving template: ' + err, 'error');
    }
  });
}

function generateCustomTemplatePreview(td, settings) {
  const sampleData = {
    invoice_number: '2024-001',
    business_name: settings.business_name || 'My Business',
    business_address: settings.business_address || '123 Business Street, City',
    business_phone: settings.business_phone || '+1 (555) 123-4567',
    business_email: settings.business_email || 'hello@example.com',
    customer_name: 'Acme Corporation',
    customer_address: '456 Client Ave, City, State 12345',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '2024-02-28',
    currency: settings.currency_symbol || '$',
    tax_label: settings.tax_label || 'Tax',
    subtotal: 5000,
    tax: 500,
    total: 5500,
    items: [
      { description: 'Web Design Services', quantity: 1, unit_price: 3000, tax_percent: 10, line_total: 3000 },
      { description: 'Development & Implementation', quantity: 2, unit_price: 1000, tax_percent: 10, line_total: 2000 },
    ]
  };

  const font = td.font_family || 'Segoe UI';
  const headerBg = td.header_bg_color || '#1e40af';
  const headerText = td.header_text_color || '#ffffff';
  const accent = td.accent_color || '#3b82f6';
  const borderClr = td.border_color || '#e5e7eb';
  const borderSt = td.border_style === 'none' ? 'none' : `1px ${td.border_style || 'solid'} ${borderClr}`;
  const pos = td.header_position || 'left';
  const layout = td.layout_style || 'classic';
  const tblStyle = td.table_style || 'striped';
  const cur = sampleData.currency;

  // Header alignment
  const headerAlign = pos === 'center' ? 'center' : pos === 'right' ? 'flex-end' : 'flex-start';
  const textAlign = pos === 'center' ? 'center' : pos === 'right' ? 'right' : 'left';

  // Table styles
  let thBg, thColor, rowBorder, altRowBg;
  if (tblStyle === 'striped') {
    thBg = headerBg; thColor = headerText; rowBorder = borderSt; altRowBg = accent + '10';
  } else if (tblStyle === 'bordered') {
    thBg = headerBg; thColor = headerText; rowBorder = borderSt; altRowBg = 'transparent';
  } else if (tblStyle === 'minimal') {
    thBg = 'transparent'; thColor = accent; rowBorder = `1px solid ${borderClr}`; altRowBg = 'transparent';
  } else {
    thBg = '#f9fafb'; thColor = '#374151'; rowBorder = 'none'; altRowBg = 'transparent';
  }

  // Layout-specific header
  let headerHTML = '';
  if (layout === 'bold') {
    headerHTML = `
      <div style="background: ${headerBg}; color: ${headerText}; padding: 30px 40px; margin: -40px -40px 30px -40px; display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align: ${textAlign};">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">INVOICE</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">${escHtml(sampleData.business_name)}</p>
        </div>
        <div style="text-align: right; font-size: 14px; opacity: 0.85;">
          ${td.show_business_address ? `<div>${escHtml(sampleData.business_address)}</div>` : ''}
          ${td.show_business_phone ? `<div>${escHtml(sampleData.business_phone)}</div>` : ''}
          ${td.show_business_email ? `<div>${escHtml(sampleData.business_email)}</div>` : ''}
        </div>
      </div>`;
  } else if (layout === 'modern') {
    headerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; margin-bottom: 25px; border-bottom: 3px solid ${accent};">
        <div style="text-align: ${textAlign};">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${accent};">${escHtml(sampleData.business_name)}</h1>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280;">
            ${td.show_business_phone ? escHtml(sampleData.business_phone) : ''}${td.show_business_phone && td.show_business_email ? ' • ' : ''}${td.show_business_email ? escHtml(sampleData.business_email) : ''}
          </p>
          ${td.show_business_address ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">${escHtml(sampleData.business_address)}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Invoice</div>
          <div style="font-size: 26px; font-weight: 700; color: ${accent};">#${sampleData.invoice_number}</div>
        </div>
      </div>`;
  } else if (layout === 'minimal') {
    headerHTML = `
      <div style="margin-bottom: 30px; text-align: ${textAlign};">
        <h1 style="margin: 0 0 5px 0; font-size: 20px; font-weight: 600; color: #1f2937;">${escHtml(sampleData.business_name)}</h1>
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
          ${td.show_business_address ? escHtml(sampleData.business_address) + '<br/>' : ''}
          ${td.show_business_phone ? escHtml(sampleData.business_phone) : ''}${td.show_business_phone && td.show_business_email ? ' | ' : ''}${td.show_business_email ? escHtml(sampleData.business_email) : ''}
        </p>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid ${borderClr}; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px;">Invoice #${sampleData.invoice_number}</div>
      </div>`;
  } else {
    // Classic
    headerHTML = `
      <div style="display: flex; justify-content: ${headerAlign}; align-items: flex-start; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid ${accent};">
        <div style="text-align: ${textAlign}; flex: 1;">
          <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: ${accent};">${escHtml(sampleData.business_name)}</h1>
          <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.6;">
            ${td.show_business_address ? escHtml(sampleData.business_address) + '<br/>' : ''}
            ${td.show_business_phone ? escHtml(sampleData.business_phone) : ''}${td.show_business_phone && td.show_business_email ? ' | ' : ''}${td.show_business_email ? escHtml(sampleData.business_email) : ''}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 32px; font-weight: 800; color: ${accent};">INVOICE</div>
          <div style="font-size: 14px; color: #666;">#${sampleData.invoice_number}</div>
        </div>
      </div>`;
  }

  // Extra table columns
  const descTh = td.show_description_column ? '<th style="padding: 10px; text-align: left;">DESCRIPTION</th>' : '';
  const taxTh = td.show_tax_column ? '<th style="padding: 10px; text-align: right;">TAX %</th>' : '';

  const itemRows = sampleData.items.map((item, i) => {
    const bg = (tblStyle === 'striped' && i % 2 === 1) ? altRowBg : 'transparent';
    const descTd = td.show_description_column ? `<td style="padding: 10px; text-align: left; color: #6b7280; font-size: 13px;">${escHtml(item.description)}</td>` : '';
    const taxTd = td.show_tax_column ? `<td style="padding: 10px; text-align: right;">${item.tax_percent}%</td>` : '';
    const cellBorder = tblStyle === 'bordered' ? `border: ${borderSt};` : `border-bottom: ${rowBorder};`;
    return `<tr style="background: ${bg};">
      <td style="padding: 10px; text-align: left; font-weight: 500; ${cellBorder}">${escHtml(item.description)}</td>
      ${descTd ? '' : ''}
      <td style="padding: 10px; text-align: right; ${cellBorder}">${item.quantity}</td>
      <td style="padding: 10px; text-align: right; ${cellBorder}">${cur}${item.unit_price.toFixed(2)}</td>
      ${taxTd ? `<td style="padding: 10px; text-align: right; ${cellBorder}">${item.tax_percent}%</td>` : ''}
      <td style="padding: 10px; text-align: right; font-weight: 600; ${cellBorder}">${cur}${item.line_total.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const thStyle = `background: ${thBg}; color: ${thColor}; padding: 10px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;`;
  const thBorderStyle = tblStyle === 'bordered' ? `border: ${borderSt};` : '';

  return `
    <div style="background: white; color: #1f2937; padding: 40px; font-family: '${font}', sans-serif; font-size: 14px;">
      ${headerHTML}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <div style="font-size: 11px; color: ${accent}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px;">Bill To</div>
          <div style="font-size: 15px; font-weight: 600;">${escHtml(sampleData.customer_name)}</div>
          <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${escHtml(sampleData.customer_address)}</div>
        </div>
        <div style="text-align: right;">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 12px; color: #9ca3af;">Issue Date: </span>
            <span style="font-weight: 600;">${sampleData.issue_date}</span>
          </div>
          <div>
            <span style="font-size: 12px; color: #9ca3af;">Due Date: </span>
            <span style="font-weight: 600; color: ${accent};">${sampleData.due_date}</span>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr>
            <th style="${thStyle} text-align: left; ${thBorderStyle}">ITEM</th>
            <th style="${thStyle} text-align: right; ${thBorderStyle}">QTY</th>
            <th style="${thStyle} text-align: right; ${thBorderStyle}">RATE</th>
            ${td.show_tax_column ? `<th style="${thStyle} text-align: right; ${thBorderStyle}">TAX %</th>` : ''}
            <th style="${thStyle} text-align: right; ${thBorderStyle}">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 280px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid ${borderClr};">
            <span style="color: #6b7280;">Subtotal</span>
            <span>${cur}${sampleData.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 2px solid ${borderClr};">
            <span style="color: #6b7280;">${sampleData.tax_label}</span>
            <span>${cur}${sampleData.tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; font-weight: 700; color: ${accent};">
            <span>TOTAL</span>
            <span>${cur}${sampleData.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${td.footer_text ? `<div style="text-align: center; padding-top: 20px; border-top: 1px solid ${borderClr}; font-size: 13px; color: #9ca3af;">${escHtml(td.footer_text)}</div>` : ''}
    </div>
  `;
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
        <button class="btn btn-primary" id="btn-add-user"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> New User</button>
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
    // Financial Management - Invoices
    'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices', 'export_invoices',
    // Financial Management - Transactions
    'view_transactions', 'create_transactions', 'edit_transactions', 'delete_transactions',
    // Financial Management - Reports
    'view_reports', 'export_reports',
    // Team & Operations - Customers
    'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
    // Team & Operations - Employees
    'view_employees', 'create_employees', 'edit_employees', 'delete_employees',
    // Team & Operations - Payroll
    'view_payroll', 'manage_payroll',
    // Business Setup - Products
    'view_products', 'create_products', 'edit_products', 'delete_products',
    // Business Setup - Templates
    'manage_templates',
    // Business Setup - Settings
    'manage_settings',
    // Admin
    'manage_users', 'view_activity_logs'
  ];

  openModal(`Permissions: ${username}`, `
    <div style="padding: 10px 0">
      <p style="margin-bottom: 20px; color: var(--text-muted)">Grant specific access to this user.</p>
      <form id="perms-form">
        <div class="perms-grid">
          <!-- Financial Management -->
          <div>
            <h4 class="perms-section-title">Financial Management</h4>
            <div class="perms-list">
              ${['view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices', 'export_invoices', 'view_transactions', 'create_transactions', 'edit_transactions', 'delete_transactions', 'view_reports', 'export_reports'].map(p => `
                <div class="perm-item">
                  <input type="checkbox" name="perms" value="${p}" id="perm-${p}">
                  <label for="perm-${p}">${p.replace(/_/g, ' ')}</label>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Team & Operations -->
          <div>
            <h4 class="perms-section-title">Team & Operations</h4>
            <div class="perms-list">
              ${['view_customers', 'create_customers', 'edit_customers', 'delete_customers', 'view_employees', 'create_employees', 'edit_employees', 'delete_employees', 'view_payroll', 'manage_payroll'].map(p => `
                <div class="perm-item">
                  <input type="checkbox" name="perms" value="${p}" id="perm-${p}">
                  <label for="perm-${p}">${p.replace(/_/g, ' ')}</label>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Business Setup -->
          <div>
            <h4 class="perms-section-title">Business Setup</h4>
            <div class="perms-list">
              ${['view_products', 'create_products', 'edit_products', 'delete_products', 'manage_templates', 'manage_settings'].map(p => `
                <div class="perm-item">
                  <input type="checkbox" name="perms" value="${p}" id="perm-${p}">
                  <label for="perm-${p}">${p.replace(/_/g, ' ')}</label>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Administration -->
          <div>
            <h4 class="perms-section-title">Administration</h4>
            <div class="perms-list">
              ${['manage_users', 'view_activity_logs'].map(p => `
                <div class="perm-item">
                  <input type="checkbox" name="perms" value="${p}" id="perm-${p}">
                  <label for="perm-${p}">${p.replace(/_/g, ' ')}</label>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);"/>
        <div class="form-actions" style="margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Update Permissions</button>
        </div>
      </form>
    </div>
  `);

  // Widen modal for permissions
  const modal = document.querySelector('.modal');
  if (modal) modal.style.maxWidth = '700px';

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
        <div class="filter-bar">
          <div class="filter-group">
            <label class="form-label">User</label>
            <select class="form-select" id="filter-user">
              <option value="">All Users</option>
              ${users.map(u => `<option value="${u.id}">${escHtml(u.username)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="form-label">Module</label>
            <select class="form-select" id="filter-module">
              <option value="">All Modules</option>
              ${modules.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="filter-date" />
          </div>
          <div class="filter-group">
            <label class="form-label">Month</label>
            <input type="month" class="form-input" id="filter-month" />
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-clear-filters">Clear</button>
          <button class="btn btn-primary btn-sm" id="btn-apply-filters">Apply Filters</button>
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
        <button class="btn btn-primary" id="btn-add-tx"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Record Transaction</button>
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
  let [payrollRecords, employees] = await Promise.all([
    invoke('get_payroll_summary'),
    invoke('get_employees')
  ]);

  container.innerHTML = `
    <div class="page-enter" data-perm="view_payroll">
          <p class="page-subtitle">${payrollRecords.length} payroll record${payrollRecords.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="btn-add-payroll"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> New Payroll</button>
          <button class="btn btn-secondary" id="btn-bulk-payroll">Bulk Run</button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Period</th>
              <th>Base Salary</th>
              <th>Bonuses</th>
              <th>Net Pay</th>
              <th>Date</th>
              <th>Status</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${payrollRecords.length === 0
              ? '<tr><td colspan="9" class="table-empty">No payroll records yet.</td></tr>'
              : payrollRecords.map(p => `
                <tr>
                  <td>${escHtml(p.employee_name) || 'Unknown'}</td>
                  <td>${escHtml(p.employee_role) || '—'}</td>
                  <td>${p.pay_period_start || '—'} – ${p.pay_period_end || '—'}</td>
                  <td>${currency(p.base_salary)}</td>
                  <td>${currency(p.bonuses)}</td>
                  <td><strong>${currency(p.net_pay)}</strong></td>
                  <td>${p.payment_date}</td>
                  <td>${statusBadge(p.status)}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-payslip" data-id="${p.id}" title="Download Payslip">PDF</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#btn-add-payroll').onclick = () => openPayrollModal(employees);
  $('#btn-bulk-payroll').onclick = () => openBulkPayrollModal();

  $$('.btn-payslip').forEach(btn => {
    btn.onclick = async () => {
      try {
        const { save } = window.__TAURI__.dialog;
        const path = await save({ defaultPath: `payslip-${btn.dataset.id}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
        if (path) {
          await invoke('export_payslip_pdf', { payrollId: Number(btn.dataset.id), filePath: path });
          toast('Payslip exported');
        }
      } catch (e) { toast(e, 'error'); }
    };
  });
}

function openPayrollModal(employees) {
  if (!employees || employees.length === 0) {
    toast('No employees found. Please add employees first.', 'error');
    setTimeout(() => { location.hash = 'employees'; }, 500);
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  openModal('New Payroll Entry', `
    <form id="payroll-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Employee *</label>
          <select class="form-select" name="employee_id" required>
            ${employees.map(e => `<option value="${e.id}">${escHtml(e.name)} — ${escHtml(e.role || '')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Base Salary *</label>
          <input class="form-input" name="base_salary" type="number" step="0.01" min="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Bonuses</label>
          <input class="form-input" name="bonuses" type="number" step="0.01" value="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Pay Period Start *</label>
          <input class="form-input" name="pay_period_start" type="date" required />
        </div>
        <div class="form-group">
          <label class="form-label">Pay Period End *</label>
          <input class="form-input" name="pay_period_end" type="date" required />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Date *</label>
          <input class="form-input" name="payment_date" type="date" value="${today}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" name="status">
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" name="notes"></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Payroll</button>
      </div>
    </form>
  `);

  // Auto-fill base salary when employee is selected
  const empSelect = document.querySelector('#payroll-form select[name="employee_id"]');
  const salaryInput = document.querySelector('#payroll-form input[name="base_salary"]');
  function fillSalary() {
    const emp = employees.find(e => String(e.id) === empSelect.value);
    if (emp && emp.salary) salaryInput.value = emp.salary;
  }
  empSelect.addEventListener('change', fillSalary);
  fillSalary();

  $('#payroll-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await invoke('create_payroll', {
        employeeId: Number(fd.get('employee_id')),
        baseSalary: Number(fd.get('base_salary')),
        bonuses: Number(fd.get('bonuses') || 0),
        payPeriodStart: fd.get('pay_period_start'),
        payPeriodEnd: fd.get('pay_period_end'),
        paymentDate: fd.get('payment_date'),
        status: fd.get('status'),
        notes: fd.get('notes') || null,
      });
      toast('Payroll recorded');
      closeModal();
      renderPayroll($('#main-content'));
    } catch (err) { toast(err, 'error'); }
  };
}

function openBulkPayrollModal() {
  const today = new Date().toISOString().split('T')[0];
  openModal('Bulk Payroll Run', `
    <form id="bulk-payroll-form">
      <p class="mb-4" style="color:var(--text-secondary)">Process payroll for all employees using their saved salary.</p>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Pay Period Start *</label>
          <input class="form-input" name="pay_period_start" type="date" required />
        </div>
        <div class="form-group">
          <label class="form-label">Pay Period End *</label>
          <input class="form-input" name="pay_period_end" type="date" required />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Date *</label>
          <input class="form-input" name="payment_date" type="date" value="${today}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Extra Bonuses</label>
          <input class="form-input" name="bonuses" type="number" step="0.01" value="0" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Run Bulk Payroll</button>
      </div>
    </form>
  `);

  $('#bulk-payroll-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const count = await invoke('create_bulk_payroll', {
        payPeriodStart: fd.get('pay_period_start'),
        payPeriodEnd: fd.get('pay_period_end'),
        paymentDate: fd.get('payment_date'),
        bonuses: Number(fd.get('bonuses') || 0),
      });
      toast(`Payroll processed for ${count} employee(s)`);
      closeModal();
      renderPayroll($('#main-content'));
    } catch (err) { toast(err, 'error'); }
  };
}

// ── Employees ────────────────────────────────────────

async function renderEmployees(container) {
  let employees = await invoke('get_employees');

  container.innerHTML = `
    <div class="page-enter" data-perm="view_employees">
      <div class="page-header">
        <div>
          <h1 class="page-title">Employees</h1>
          <p class="page-subtitle">${employees.length} employee${employees.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" id="btn-add-employee"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add Employee</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Salary</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${employees.length === 0
              ? '<tr><td colspan="6" class="table-empty">No employees yet. Add your first employee.</td></tr>'
              : employees.map(e => `
                <tr>
                  <td>${escHtml(e.name)}</td>
                  <td>${escHtml(e.role) || '—'}</td>
                  <td>${escHtml(e.email) || '—'}</td>
                  <td>${escHtml(e.phone) || '—'}</td>
                  <td>${currency(e.salary)}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-icon edit-emp" data-id="${e.id}" data-json='${JSON.stringify(e).replace(/'/g, "&#39;")}'><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#btn-add-employee').onclick = () => openEmployeeModal();

  $$('.edit-emp').forEach(btn => {
    btn.onclick = () => {
      const data = JSON.parse(btn.dataset.json);
      openEmployeeModal(data);
    };
  });
}

function openEmployeeModal(data = null) {
  const isEdit = !!data;
  openModal(isEdit ? 'Edit Employee' : 'Add Employee', `
    <form id="employee-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input class="form-input" name="name" required value="${escHtml(data?.name || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <input class="form-input" name="role" value="${escHtml(data?.role || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" name="email" type="email" value="${escHtml(data?.email || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" name="phone" value="${escHtml(data?.phone || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Salary *</label>
          <input class="form-input" name="salary" type="number" step="0.01" min="0" required value="${data?.salary || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Allowances</label>
          <input class="form-input" name="allowances" type="number" step="0.01" value="${data?.allowances || 0}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Employee'}</button>
      </div>
    </form>
  `);

  $('#employee-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      if (isEdit) {
        await invoke('update_employee', {
          id: data.id,
          name: fd.get('name'),
          role: fd.get('role') || null,
          email: fd.get('email') || null,
          phone: fd.get('phone') || null,
          salary: Number(fd.get('salary')),
          allowances: Number(fd.get('allowances') || 0),
        });
      } else {
        await invoke('create_employee', {
          name: fd.get('name'),
          role: fd.get('role') || null,
          email: fd.get('email') || null,
          phone: fd.get('phone') || null,
          salary: Number(fd.get('salary')),
          allowances: Number(fd.get('allowances') || 0),
        });
      }
      toast(isEdit ? 'Employee updated' : 'Employee added');
      closeModal();
      renderEmployees($('#main-content'));
    } catch (err) { toast(err, 'error'); }
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
    const { save } = window.__TAURI__.dialog;
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
