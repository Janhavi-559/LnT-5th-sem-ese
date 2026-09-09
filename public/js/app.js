/**
 * Digital Library Management System - Frontend App Logic
 * Project P05 • Christ University CIA-3
 */

const API_BASE = window.location.origin + '/api';

const PERSONAS = {
  admin: {
    email: 'admin@library.edu',
    password: 'Admin@123',
    label: 'Chief Administrator',
    role: 'admin'
  },
  librarian: {
    email: 'sarah.librarian@library.edu',
    password: 'Lib@12345',
    label: 'Sarah Jenkins (Librarian)',
    role: 'librarian'
  },
  student: {
    email: 'alex.student@christ.in',
    password: 'Student@123',
    label: 'Alex Rivera (Student)',
    role: 'member'
  },
  student_overdue: {
    email: 'priya.student@christ.in',
    password: 'Student@123',
    label: 'Priya Sharma (Overdue)',
    role: 'member'
  },
  faculty: {
    email: 'dr.anand@christ.in',
    password: 'Faculty@123',
    label: 'Dr. Anand Kumar (Faculty)',
    role: 'member'
  }
};

let currentPersonaKey = 'admin';
let currentToken = '';
let currentUser = null;
let currentTab = 'catalog';

// Helper for authenticated API calls
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Modal Controls
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Switch Persona & Automatically Re-authenticate
async function switchPersona(personaKey) {
  currentPersonaKey = personaKey;

  // Update button active state
  document.querySelectorAll('#roleBtnGroup .role-pill').forEach((btn) => {
    btn.classList.remove('active');
  });
  event?.target?.classList?.add('active');

  const target = PERSONAS[personaKey];
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target.email, password: target.password })
    });

    const result = await res.json();
    if (result.success) {
      currentToken = result.data.token;
      currentUser = result.data.user;

      updateUserUI();
      showToast(`Logged in as ${currentUser.name} (${currentUser.role.toUpperCase()})`, 'success');

      // Refresh current tab
      refreshCurrentView();
    }
  } catch (err) {
    showToast('Failed to switch persona: ' + err.message, 'error');
  }
}

function updateUserUI() {
  if (!currentUser) return;

  const roleBadge = document.getElementById('currentUserRoleBadge');
  const nameEl = document.getElementById('currentUserName');
  const quotaEl = document.getElementById('currentUserQuota');

  nameEl.innerText = currentUser.name;
  roleBadge.innerText = currentUser.role.toUpperCase();
  roleBadge.className = `user-badge badge-${currentUser.role}`;

  if (currentUser.role === 'member') {
    quotaEl.innerText = `${currentUser.memberType?.toUpperCase()} | Max: ${currentUser.maxBooksAllowed} bks`;
  } else {
    quotaEl.innerText = `${currentUser.department || 'Staff'}`;
  }

  // Hide or show librarian/admin-specific controls
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'librarian';
  const btnAddBook = document.getElementById('btnOpenAddBookModal');
  const btnIssue = document.getElementById('btnOpenIssueModal');
  const btnScan = document.getElementById('btnRunOverdueScan');
  const btnAddLib = document.getElementById('btnOpenAddLibrarianModal');

  if (btnAddBook) btnAddBook.style.display = isStaff ? 'block' : 'none';
  if (btnIssue) btnIssue.style.display = isStaff ? 'block' : 'none';
  if (btnScan) btnScan.style.display = isStaff ? 'block' : 'none';
  if (btnAddLib) btnAddLib.style.display = currentUser.role === 'admin' ? 'block' : 'none';
}

// Tab Switching
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.app-nav .nav-tab').forEach((t) => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.main-content .tab-pane').forEach((p) => {
    p.classList.toggle('active', p.id === `tab-${tabId}`);
  });

  refreshCurrentView();
}

function refreshCurrentView() {
  switch (currentTab) {
    case 'catalog':
      loadCatalog();
      break;
    case 'circulation':
      loadCirculation();
      break;
    case 'holds':
      loadHolds();
      break;
    case 'fines':
      loadFines();
      break;
    case 'notifications':
      loadNotifications();
      break;
    case 'reports':
      loadReports();
      break;
    case 'members':
      loadMembers();
      break;
  }
}

// -------------------------------------------------------------
// TAB 1: Book Catalog (Modules 2 & 3)
// -------------------------------------------------------------
function handleSearchKeyup(e) {
  if (e.key === 'Enter') {
    loadCatalog();
  }
}

async function loadCatalog() {
  const search = document.getElementById('catalogSearchInput').value;
  const category = document.getElementById('catalogCategoryFilter').value;
  const availableOnly = document.getElementById('catalogAvailableOnly').checked;

  let url = `/books/search?availableOnly=${availableOnly}`;
  if (search) url += `&q=${encodeURIComponent(search)}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  try {
    const res = await apiCall(url);
    renderBooksGrid(res.data);

    // Populate category dropdown if empty
    const catSelect = document.getElementById('catalogCategoryFilter');
    if (catSelect.options.length <= 1) {
      const allBooksRes = await apiCall('/books');
      if (allBooksRes.categories) {
        allBooksRes.categories.forEach((cat) => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.innerText = cat;
          catSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderBooksGrid(books) {
  const container = document.getElementById('booksGrid');
  if (!books || books.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b;">
        <h3>No books found matching your query</h3>
        <p>Try searching with another keyword or resetting filters.</p>
      </div>`;
    return;
  }

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'librarian';

  container.innerHTML = books
    .map((b) => {
      const isAvailable = b.availableCopies > 0;
      return `
      <div class="book-card">
        <div>
          <span class="book-category-tag">${b.category}</span>
          <h3 class="book-title">${b.title}</h3>
          <p class="book-author">by ${b.author}</p>
          <div class="book-meta-grid">
            <div class="meta-item">
              <span class="meta-label">ISBN</span>
              <span class="meta-val">${b.isbn}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Shelf / Rack</span>
              <span class="meta-val">${b.rackNumber || 'General'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Copies Available</span>
              <span class="meta-val">${b.availableCopies} / ${b.totalCopies}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Price / Replacement</span>
              <span class="meta-val">₹${b.price}</span>
            </div>
          </div>
          <div>
            <span class="availability-badge ${isAvailable ? 'available' : 'unavailable'}">
              ${isAvailable ? '● Available in Stack' : '● Currently Out of Stock'}
            </span>
          </div>
        </div>
        <div class="card-actions">
          ${
            isAvailable
              ? `<button class="btn-card btn-issue" onclick="quickIssueBook('${b._id}')">📖 Issue Book</button>`
              : `<button class="btn-card btn-hold" onclick="quickPlaceHold('${b._id}')">⏳ Place Hold</button>`
          }
          ${
            isStaff
              ? `<button class="btn-card btn-hold" onclick="openAdjustInventory('${b._id}', '${escape(b.title)}')">⚙️ Stock</button>`
              : ''
          }
        </div>
      </div>`;
    })
    .join('');
}

// Quick Issue Trigger
function quickIssueBook(bookId) {
  openIssueModal(bookId);
}

// Quick Hold Placement (Module 6)
async function quickPlaceHold(bookId) {
  try {
    const res = await apiCall('/holds', {
      method: 'POST',
      body: JSON.stringify({ bookId })
    });
    showToast(res.message, 'success');
    loadCatalog();
  } catch (err) {
    // Handled in apiCall
  }
}

// -------------------------------------------------------------
// TAB 2: Circulation Desk (Modules 4 & 5)
// -------------------------------------------------------------
async function loadCirculation() {
  try {
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'librarian';

    if (isStaff) {
      const res = await apiCall('/transactions/active');
      document.getElementById('activeLoansCount').innerText = res.count;
      renderActiveLoansTable(res.data);
      document.getElementById('myHistoryCard').style.display = 'none';
    } else {
      // Member personal history
      const historyRes = await apiCall('/transactions/my-history');
      document.getElementById('myBorrowingHistoryCount').innerText = historyRes.count;
      renderMyHistoryTable(historyRes.data);
      document.getElementById('activeLoansTableBody').innerHTML = `
        <tr><td colspan="8" style="text-align:center; color:#64748b;">Active circulation management is restricted to Librarian/Admin. Check your personal borrowing history below.</td></tr>`;
      document.getElementById('myHistoryCard').style.display = 'block';
    }
  } catch (err) {
    console.error(err);
  }
}

function renderActiveLoansTable(transactions) {
  const tbody = document.getElementById('activeLoansTableBody');
  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No active loaned books at the moment.</td></tr>`;
    return;
  }

  const now = new Date();

  tbody.innerHTML = transactions
    .map((t) => {
      const dueDate = new Date(t.dueDate);
      const isOverdue = now > dueDate;
      const overdueDays = isOverdue ? Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;
      const fineRate = t.memberId?.memberType === 'faculty' ? 5 : 10;
      const estFine = overdueDays * fineRate;

      return `
      <tr>
        <td>
          <strong>${t.bookId?.title || 'Unknown Book'}</strong>
          <div style="font-size: 0.78rem; color: #64748b;">ISBN: ${t.bookId?.isbn || 'N/A'}</div>
        </td>
        <td>
          <div><strong>${t.memberId?.name || 'N/A'}</strong></div>
          <div style="font-size: 0.78rem; color: #64748b;">${t.memberId?.membershipId || ''} (${t.memberId?.email || ''})</div>
        </td>
        <td><span class="status-pill">${t.memberId?.memberType || 'Student'}</span></td>
        <td>${new Date(t.issueDate).toLocaleDateString()}</td>
        <td>
          <span style="font-weight: 600; color: ${isOverdue ? '#dc2626' : '#1e293b'};">
            ${dueDate.toLocaleDateString()}
          </span>
          ${isOverdue ? `<br><small style="color: #dc2626; font-weight: 700;">${overdueDays}d Late</small>` : ''}
        </td>
        <td><span class="status-pill pill-issued">${t.status}</span></td>
        <td>
          ${isOverdue ? `<span style="color: #dc2626; font-weight: 800;">₹${estFine}</span>` : '₹0'}
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn-card btn-issue" style="padding: 0.35rem 0.65rem;" onclick="processReturn('${t._id}')">
              📥 Return
            </button>
            <button class="btn-card btn-danger-outline" style="padding: 0.35rem 0.65rem;" onclick="reportLost('${t._id}')">
              Lost
            </button>
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function renderMyHistoryTable(history) {
  const tbody = document.getElementById('myHistoryTableBody');
  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">You have not borrowed any books yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = history
    .map((h) => {
      return `
      <tr>
        <td>
          <strong>${h.bookId?.title || 'Book'}</strong>
          <div style="font-size: 0.78rem; color: #64748b;">${h.bookId?.author}</div>
        </td>
        <td>${new Date(h.issueDate).toLocaleDateString()}</td>
        <td>${new Date(h.dueDate).toLocaleDateString()}</td>
        <td>${h.returnDate ? new Date(h.returnDate).toLocaleDateString() : '<em>Active</em>'}</td>
        <td>
          <span class="status-pill pill-${h.fineStatus.toLowerCase()}">${h.fineStatus} (${h.fineAmount ? '₹' + h.fineAmount : '₹0'})</span>
        </td>
        <td><span class="status-pill pill-${h.status.toLowerCase()}">${h.status}</span></td>
      </tr>`;
    })
    .join('');
}

// Process Return (Module 5)
async function processReturn(txId) {
  try {
    const res = await apiCall(`/transactions/${txId}/return`, {
      method: 'PUT'
    });
    showToast(res.message, 'success');
    loadCirculation();
  } catch (err) {
    // Handled in apiCall
  }
}

// Report Lost (Module 10)
async function reportLost(txId) {
  if (!confirm('Are you sure you want to report this copy as LOST? A replacement fee will be charged to the borrower.')) {
    return;
  }
  try {
    const res = await apiCall(`/transactions/${txId}/report-lost`, {
      method: 'POST',
      body: JSON.stringify({ issueType: 'LOST', notes: 'Reported lost at circulation desk' })
    });
    showToast(res.message, 'success');
    loadCirculation();
  } catch (err) {
    // Handled in apiCall
  }
}

// -------------------------------------------------------------
// TAB 3: Hold Queue (Module 6)
// -------------------------------------------------------------
async function loadHolds() {
  try {
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'librarian';
    let holds = [];

    if (isStaff) {
      // In a real app we'd fetch all holds or book specific
      // We can fetch holds for AI book as example or catalog books
      const allBooks = await apiCall('/books');
      for (const b of allBooks.data) {
        const q = await apiCall(`/holds/book/${b._id}`);
        if (q.data && q.data.length > 0) {
          q.data.forEach((item) => {
            holds.push({ ...item, bookTitle: b.title });
          });
        }
      }
    } else {
      const myHolds = await apiCall('/holds/my-holds');
      holds = myHolds.data.map((h) => ({
        ...h,
        bookTitle: h.bookId?.title,
        memberId: { name: currentUser.name, email: currentUser.email }
      }));
    }

    renderHoldsTable(holds);
  } catch (err) {
    console.error(err);
  }
}

function renderHoldsTable(holds) {
  const tbody = document.getElementById('holdsTableBody');
  if (!holds || holds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No active holds in the queue.</td></tr>`;
    return;
  }

  tbody.innerHTML = holds
    .map((h) => {
      const isPickup = h.status === 'AVAILABLE_FOR_PICKUP';
      return `
      <tr>
        <td><strong>${h.bookTitle || h.bookId?.title || 'Book'}</strong></td>
        <td>${h.memberId?.name || 'Member'} (${h.memberId?.membershipId || ''})</td>
        <td>${new Date(h.requestedAt).toLocaleDateString()}</td>
        <td>
          <span class="status-pill ${isPickup ? 'pill-pickup' : 'pill-queued'}">
            ${h.status.replace(/_/g, ' ')}
          </span>
        </td>
        <td>${h.pickupExpiryDate ? new Date(h.pickupExpiryDate).toLocaleDateString() : 'N/A (In Queue)'}</td>
        <td>
          <button class="btn-card btn-danger-outline" style="padding: 0.3rem 0.6rem;" onclick="cancelHold('${h._id}')">
            Cancel
          </button>
        </td>
      </tr>`;
    })
    .join('');
}

async function cancelHold(holdId) {
  try {
    const res = await apiCall(`/holds/${holdId}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    loadHolds();
  } catch (err) {
    // Handled in apiCall
  }
}

// -------------------------------------------------------------
// TAB 4: Fines & Payments (Module 8)
// -------------------------------------------------------------
async function loadFines() {
  try {
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'librarian';

    if (isStaff) {
      const res = await apiCall('/fines/unpaid');
      renderUnpaidFinesTable(res.data);
    } else {
      const res = await apiCall('/fines/my-fines');
      const unpaid = res.transactionsWithFines.filter((t) => t.fineStatus === 'UNPAID');
      renderUnpaidFinesTable(unpaid);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderUnpaidFinesTable(fines) {
  const tbody = document.getElementById('unpaidFinesTableBody');
  if (!fines || fines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No outstanding unpaid fines. Excellent!</td></tr>`;
    return;
  }

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'librarian';

  tbody.innerHTML = fines
    .map((f) => {
      const memberName = f.memberId?.name || currentUser?.name || 'Member';
      const bookTitle = f.bookId?.title || 'Book Title';

      return `
      <tr>
        <td><strong>${memberName}</strong></td>
        <td>${bookTitle}</td>
        <td>${new Date(f.dueDate).toLocaleDateString()}</td>
        <td><span style="color: #dc2626; font-weight: 800; font-size: 1.1rem;">₹${f.fineAmount}</span></td>
        <td><span class="status-pill pill-unpaid">${f.fineStatus}</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn-card btn-issue" style="padding: 0.35rem 0.75rem;" onclick="openPayFineModal('${f._id}', '${escape(memberName)}', '${escape(bookTitle)}', ${f.fineAmount})">
              💳 Pay Fine
            </button>
            ${
              isStaff
                ? `<button class="btn-card btn-hold" style="padding: 0.35rem 0.75rem;" onclick="waiveFine('${f._id}')">
                    🤝 Waive
                  </button>`
                : ''
            }
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function openPayFineModal(txId, memberName, bookTitle, amount) {
  document.getElementById('payFineTxId').value = txId;
  document.getElementById('payFineDetailsText').innerText = `${unescape(memberName)} - ${unescape(bookTitle)}`;
  document.getElementById('payFineAmount').value = amount;
  openModal('payFineModal');
}

async function submitPayFine() {
  const transactionId = document.getElementById('payFineTxId').value;
  const amount = document.getElementById('payFineAmount').value;
  const paymentMethod = document.getElementById('payFineMethod').value;

  try {
    const res = await apiCall('/fines/pay', {
      method: 'POST',
      body: JSON.stringify({ transactionId, amount, paymentMethod })
    });
    closeModal('payFineModal');
    showToast(`Payment successful! Official Receipt: ${res.data.receiptNumber}`, 'success');
    loadFines();
  } catch (err) {
    // Handled in apiCall
  }
}

async function waiveFine(txId) {
  const reason = prompt('Please enter administrative reason for waiving this fine:');
  if (!reason) return;

  try {
    const res = await apiCall(`/fines/${txId}/waive`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    });
    showToast(res.message, 'success');
    loadFines();
  } catch (err) {
    // Handled in apiCall
  }
}

// -------------------------------------------------------------
// TAB 5: Overdue Notifications (Module 9)
// -------------------------------------------------------------
async function loadNotifications() {
  try {
    const res = await apiCall('/notifications');
    renderNotificationsTable(res.data);
  } catch (err) {
    console.error(err);
  }
}

function renderNotificationsTable(list) {
  const tbody = document.getElementById('notificationsTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No overdue notifications recorded yet. Click "Run Automated Overdue Scan" to check.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((n) => {
      return `
      <tr>
        <td><strong>${n.memberId?.name || 'Member'}</strong></td>
        <td>${n.bookId?.title || 'Book'}</td>
        <td><span style="color: #dc2626; font-weight: 700;">${n.daysOverdue} days</span></td>
        <td><strong>₹${n.accruedFine}</strong></td>
        <td>${new Date(n.noticeDate).toLocaleDateString()}</td>
        <td style="font-size: 0.82rem; max-width: 320px;">${n.message}</td>
        <td><span class="status-pill pill-returned">${n.status}</span></td>
      </tr>`;
    })
    .join('');
}

async function runOverdueScan() {
  try {
    const res = await apiCall('/notifications/generate-overdue', {
      method: 'POST'
    });
    showToast(res.message, 'success');
    loadNotifications();
  } catch (err) {
    // Handled in apiCall
  }
}

// -------------------------------------------------------------
// TAB 6: Analytics & Reports (Module 12)
// -------------------------------------------------------------
async function loadReports() {
  try {
    // 1. Inventory Health
    const health = await apiCall('/reports/inventory-health');
    if (health.data) {
      document.getElementById('statTotalTitles').innerText = health.data.totalTitles;
      document.getElementById('statTotalCopies').innerText = health.data.totalCopies;
      document.getElementById('statIssuedCopies').innerText = health.data.issuedCopies;
    }

    // 2. Overdue Summary
    const overdue = await apiCall('/reports/overdue-summary');
    if (overdue.summary) {
      document.getElementById('statOverdueLoans').innerText = overdue.summary.totalOverdueItems;
    }

    // 3. Financials
    const fin = await apiCall('/reports/financials');
    if (fin.data) {
      document.getElementById('statFineRevenue').innerText = `₹${fin.data.totalCollected}`;
    }

    // 4. Most Borrowed Books
    const mostBorrowed = await apiCall('/reports/most-borrowed');
    renderMostBorrowedTable(mostBorrowed.data);
  } catch (err) {
    console.error(err);
  }
}

function renderMostBorrowedTable(list) {
  const tbody = document.getElementById('mostBorrowedTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No transaction data yet for ranking.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((b, idx) => {
      return `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>${b.title}</strong></td>
        <td>${b.author}</td>
        <td><span class="book-category-tag">${b.category}</span></td>
        <td><span style="font-weight: 800; color: #3b82f6;">${b.borrowCount} issues</span></td>
        <td>${b.availableCopies} / ${b.totalCopies}</td>
      </tr>`;
    })
    .join('');
}

// -------------------------------------------------------------
// TAB 7: Members & Quotas (Modules 7 & 13)
// -------------------------------------------------------------
async function loadMembers() {
  try {
    const res = await apiCall('/users');
    renderMembersTable(res.data);
  } catch (err) {
    console.error(err);
  }
}

function renderMembersTable(members) {
  const tbody = document.getElementById('membersTableBody');
  if (!members || members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No member records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = members
    .map((m) => {
      return `
      <tr>
        <td><code>${m.membershipId || 'N/A'}</code></td>
        <td>
          <strong>${m.name}</strong>
          <div style="font-size: 0.78rem; color: #64748b;">${m.email}</div>
        </td>
        <td><span class="user-badge badge-${m.role}">${m.role}</span></td>
        <td><span class="status-pill">${m.memberType || 'N/A'}</span></td>
        <td>${m.department || 'General'}</td>
        <td><strong>${m.maxBooksAllowed || 3} books</strong></td>
        <td>${m.loanPeriodDays || 14} days</td>
        <td>
          <span class="status-pill ${m.isActive ? 'pill-paid' : 'pill-lost'}">
            ${m.isActive ? 'Active' : 'Suspended'}
          </span>
        </td>
      </tr>`;
    })
    .join('');
}

// -------------------------------------------------------------
// Modal Interactions: Issue Book, Add Book, Adjust Stock
// -------------------------------------------------------------
async function openIssueModal(preselectedBookId) {
  // Populate books and members
  const booksRes = await apiCall('/books?availableOnly=true');
  const usersRes = await apiCall('/users?role=member');

  const bookSelect = document.getElementById('issueBookSelect');
  bookSelect.innerHTML = booksRes.data
    .map((b) => `<option value="${b._id}" ${b._id === preselectedBookId ? 'selected' : ''}>${b.title} (${b.availableCopies} available)</option>`)
    .join('');

  const memberSelect = document.getElementById('issueMemberSelect');
  memberSelect.innerHTML = usersRes.data
    .map((m) => `<option value="${m._id}">${m.name} (${m.membershipId} - ${m.memberType.toUpperCase()})</option>`)
    .join('');

  openModal('issueModal');
}

async function submitIssueBook() {
  const bookId = document.getElementById('issueBookSelect').value;
  const memberId = document.getElementById('issueMemberSelect').value;
  const remarks = document.getElementById('issueRemarks').value;

  try {
    const res = await apiCall('/transactions/issue', {
      method: 'POST',
      body: JSON.stringify({ bookId, memberId, remarks })
    });
    closeModal('issueModal');
    showToast(res.message, 'success');
    loadCatalog();
    loadCirculation();
  } catch (err) {
    // Handled in apiCall
  }
}

function openAddBookModal() {
  openModal('addBookModal');
}

async function submitAddBook() {
  const payload = {
    title: document.getElementById('newBookTitle').value,
    author: document.getElementById('newBookAuthor').value,
    isbn: document.getElementById('newBookIsbn').value,
    category: document.getElementById('newBookCategory').value,
    totalCopies: document.getElementById('newBookCopies').value,
    rackNumber: document.getElementById('newBookRack').value,
    price: document.getElementById('newBookPrice').value
  };

  try {
    const res = await apiCall('/books', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    closeModal('addBookModal');
    showToast(res.message, 'success');
    loadCatalog();
  } catch (err) {
    // Handled in apiCall
  }
}

function openAdjustInventory(bookId, escapedTitle) {
  document.getElementById('inventoryBookId').value = bookId;
  document.getElementById('inventoryBookTitle').innerText = unescape(escapedTitle);
  document.getElementById('invAddCopies').value = 0;
  document.getElementById('invDamagedCopies').value = 0;
  openModal('adjustInventoryModal');
}

async function submitAdjustInventory() {
  const bookId = document.getElementById('inventoryBookId').value;
  const addCopies = parseInt(document.getElementById('invAddCopies').value, 10) || 0;
  const damagedCopies = parseInt(document.getElementById('invDamagedCopies').value, 10) || 0;

  try {
    const res = await apiCall(`/books/${bookId}/inventory`, {
      method: 'PUT',
      body: JSON.stringify({ addCopies, damagedCopies })
    });
    closeModal('adjustInventoryModal');
    showToast(res.message, 'success');
    loadCatalog();
  } catch (err) {
    // Handled in apiCall
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  switchPersona('admin');
});
