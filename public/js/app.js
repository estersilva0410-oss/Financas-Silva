/**
 * FINANÇAS SILVA - Frontend Multi-usuário (Dark Mode Minimalista)
 * Autenticação JWT Stateless (Vercel Serverless Ready) + Reatividade Dinâmica sem Reload
 */

// Estado da Aplicação
const state = {
  currentUser: null,
  transactions: [],
  summary: null,
  filters: {
    type: 'todas',
    category: 'todas',
    search: '',
    month: '',
    sort: 'date-desc'
  },
  editingId: null,
  deletingId: null,
  charts: {
    category: null,
    monthly: null
  }
};

// Metadados visuais de categorias em Dark Mode (#0F172A / #1E293B)
const CATEGORY_META = {
  'Alimentação': { icon: 'fa-utensils', color: '#f97316', bg: 'bg-orange-500/15 text-orange-400 border border-orange-500/25' },
  'Moradia': { icon: 'fa-house', color: '#38bdf8', bg: 'bg-sky-500/15 text-sky-400 border border-sky-500/25' },
  'Transporte': { icon: 'fa-car', color: '#facc15', bg: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' },
  'Saúde': { icon: 'fa-heart-pulse', color: '#f472b6', bg: 'bg-pink-500/15 text-pink-400 border border-pink-500/25' },
  'Lazer': { icon: 'fa-champagne-glasses', color: '#c084fc', bg: 'bg-purple-500/15 text-purple-400 border border-purple-500/25' },
  'Educação': { icon: 'fa-graduation-cap', color: '#22d3ee', bg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' },
  'Salário': { icon: 'fa-briefcase', color: '#34d399', bg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' },
  'Serviços': { icon: 'fa-wrench', color: '#818cf8', bg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' },
  'Investimentos': { icon: 'fa-chart-line', color: '#2dd4bf', bg: 'bg-teal-500/15 text-teal-400 border border-teal-500/25' },
  'Outros': { icon: 'fa-tag', color: '#94a3b8', bg: 'bg-slate-700/30 text-slate-300 border border-slate-600/30' }
};

// ----------------------------------------------------
// UTILITÁRIOS E FORMATAÇÃO
// ----------------------------------------------------
function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatMonthLabel(ym) {
  if (!ym) return ym;
  const [year, month] = ym.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthIdx = parseInt(month, 10) - 1;
  return `${months[monthIdx] || month}/${year}`;
}

function getInitials(name) {
  if (!name) return 'FS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ----------------------------------------------------
// GERENCIAMENTO DE TOKEN JWT & FETCH AUTENTICADO
// ----------------------------------------------------
function getAuthToken() {
  return localStorage.getItem('financas_silva_jwt') || '';
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem('financas_silva_jwt', token);
  } else {
    localStorage.removeItem('financas_silva_jwt');
  }
}

// Fetch autenticado com envio obrigatório de Token via Header + Cookies HTTP-only
async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  const token = getAuthToken();

  if (token && !(options.headers instanceof Headers)) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  // Enviar cookies para que funcione tanto via Cookie quanto via Header
  options.credentials = 'include';
  return fetch(url, options);
}

// ----------------------------------------------------
// TOAST NOTIFICATIONS (DARK THEME)
// ----------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast bg-[#1E293B] border border-slate-700 shadow-2xl text-slate-100 ${
    type === 'success' ? 'border-l-4 border-l-emerald-500' :
    type === 'error' ? 'border-l-4 border-l-rose-500' :
    'border-l-4 border-l-indigo-500'
  }`;

  const iconHtml = type === 'success' 
    ? '<i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>' 
    : type === 'error' 
    ? '<i class="fa-solid fa-triangle-exclamation text-rose-400 text-base"></i>'
    : '<i class="fa-solid fa-circle-info text-indigo-400 text-base"></i>';

  toast.innerHTML = `
    ${iconHtml}
    <div class="flex-1 text-xs font-semibold">${message}</div>
    <button class="text-slate-400 hover:text-white ml-2 transition-colors" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark text-xs"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ----------------------------------------------------
// GERENCIAMENTO DE TELAS (AUTH vs APP)
// ----------------------------------------------------
function switchView(isLoggedIn) {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');

  if (isLoggedIn) {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    appSection.classList.add('flex');

    if (state.currentUser) {
      document.getElementById('user-display-name').textContent = state.currentUser.name;
      document.getElementById('user-display-email').textContent = state.currentUser.email;
      document.getElementById('welcome-user-name').textContent = state.currentUser.name.split(' ')[0];
      document.getElementById('user-avatar').textContent = getInitials(state.currentUser.name);
    }
  } else {
    appSection.classList.add('hidden');
    appSection.classList.remove('flex');
    authSection.classList.remove('hidden');
    state.currentUser = null;
  }
}

// ----------------------------------------------------
// AUTENTICAÇÃO E SESSÃO STATELESS (JWT)
// ----------------------------------------------------
async function checkAuthSession() {
  try {
    const res = await authFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
      }
      state.currentUser = data.user;
      switchView(true);
      await initializeDashboard();
    } else {
      setAuthToken(null);
      switchView(false);
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    switchView(false);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-submit-login');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Acessando...</span>';

  try {
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao autenticar.');

    if (data.token) {
      setAuthToken(data.token);
    }
    state.currentUser = data.user;
    showToast(`Bem-vindo(a) ao FINANÇAS SILVA, ${data.user.name}!`, 'success');
    switchView(true);
    await initializeDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Acessar FINANÇAS SILVA</span> <i class="fa-solid fa-arrow-right text-xs"></i>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-password-confirm').value;
  const btn = document.getElementById('btn-submit-register');

  if (password !== confirmPassword) {
    showToast('As senhas digitadas não coincidem.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Criando conta...</span>';

  try {
    const res = await authFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao registrar.');

    if (data.token) {
      setAuthToken(data.token);
    }
    state.currentUser = data.user;
    showToast('Conta criada com sucesso! Bem-vindo(a) às FINANÇAS SILVA.', 'success');
    switchView(true);
    await initializeDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Criar Conta em FINANÇAS SILVA</span> <i class="fa-solid fa-check text-xs"></i>';
  }
}

async function handleLogout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error(err);
  } finally {
    setAuthToken(null);
    showToast('Você saiu do sistema.', 'info');
    switchView(false);
  }
}

// ----------------------------------------------------
// DADOS DO DASHBOARD E REATIVIDADE DINÂMICA
// ----------------------------------------------------
async function initializeDashboard() {
  await populateMonthDropdown();
  await reloadDashboardData();
}

async function fetchTransactions() {
  try {
    const params = new URLSearchParams();
    if (state.filters.type !== 'todas') params.append('type', state.filters.type);
    if (state.filters.category !== 'todas') params.append('category', state.filters.category);
    if (state.filters.search) params.append('search', state.filters.search);
    if (state.filters.month) params.append('month', state.filters.month);
    if (state.filters.sort) params.append('sort', state.filters.sort);

    const res = await authFetch(`/api/transactions?${params.toString()}`);
    if (res.status === 401) {
      switchView(false);
      return;
    }
    if (!res.ok) throw new Error('Erro ao carregar transações');

    const data = await res.json();
    state.transactions = data;
    renderTransactionsTable();
  } catch (err) {
    console.error('Erro ao buscar transações:', err);
    showToast('Falha ao sincronizar suas transações.', 'error');
  }
}

async function fetchSummary() {
  try {
    const params = new URLSearchParams();
    if (state.filters.month) params.append('month', state.filters.month);

    const res = await authFetch(`/api/summary?${params.toString()}`);
    if (res.status === 401) {
      switchView(false);
      return;
    }
    if (!res.ok) throw new Error('Erro no resumo');

    const summary = await res.json();
    state.summary = summary;
    renderSummaryCards(summary);
    renderCharts(summary);
  } catch (err) {
    console.error('Erro no resumo silencioso:', err);
  }
}

async function populateMonthDropdown() {
  try {
    const res = await authFetch('/api/transactions');
    if (!res.ok) return;
    const all = await res.json();
    const select = document.getElementById('filter-month');
    const currentVal = state.filters.month;

    const months = new Set();
    all.forEach(t => {
      if (t.date && t.date.length >= 7) {
        months.add(t.date.substring(0, 7));
      }
    });

    const sortedMonths = Array.from(months).sort().reverse();
    select.innerHTML = '<option value="">Todos os meses</option>';

    sortedMonths.forEach(ym => {
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = formatMonthLabel(ym);
      if (ym === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao popular meses:', err);
  }
}

// Recarrega silenciosamente os dados sem reload de página
async function reloadDashboardData() {
  await Promise.all([
    fetchTransactions(),
    fetchSummary()
  ]);
}

// Efeito de pulso nos cartões para confirmação visual instantânea
function pulseSummaryCards() {
  const elements = [
    document.getElementById('total-balance'),
    document.getElementById('total-income'),
    document.getElementById('total-expense'),
    document.getElementById('savings-rate')
  ];

  elements.forEach(el => {
    if (el) {
      el.classList.add('transition-transform', 'duration-300', 'scale-105');
      setTimeout(() => {
        el.classList.remove('scale-105');
      }, 400);
    }
  });
}

// ----------------------------------------------------
// RENDERIZAÇÃO DE CARDS E TABELA (DARK MODE)
// ----------------------------------------------------
function renderSummaryCards(summary) {
  if (!summary) return;

  const totalBalanceEl = document.getElementById('total-balance');
  const totalIncomeEl = document.getElementById('total-income');
  const totalExpenseEl = document.getElementById('total-expense');
  const savingsRateEl = document.getElementById('savings-rate');
  const balanceStatusEl = document.getElementById('balance-status');
  const totalCountTextEl = document.getElementById('total-count-text');
  const balanceIconBg = document.getElementById('balance-icon-bg');
  const balanceIcon = document.getElementById('balance-icon');

  totalBalanceEl.textContent = formatCurrency(summary.totalBalance);
  totalIncomeEl.textContent = formatCurrency(summary.totalIncome);
  totalExpenseEl.textContent = formatCurrency(summary.totalExpense);

  if (summary.totalBalance >= 0) {
    totalBalanceEl.className = 'text-2xl font-bold tracking-tight text-white';
    balanceIconBg.className = 'w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20';
    balanceIcon.className = 'fa-solid fa-arrow-trend-up text-sm';
    balanceStatusEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i> <span class="text-slate-300">Saldo positivo</span>`;
  } else {
    totalBalanceEl.className = 'text-2xl font-bold tracking-tight text-rose-400';
    balanceIconBg.className = 'w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20';
    balanceIcon.className = 'fa-solid fa-triangle-exclamation text-rose-400 text-[10px]';
    balanceStatusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 text-[10px]"></i> <span class="text-rose-300">Saldo negativo (Atenção)</span>`;
  }

  let savingsRate = 0;
  if (summary.totalIncome > 0) {
    savingsRate = Math.max(0, Math.round((summary.totalBalance / summary.totalIncome) * 100));
  }
  savingsRateEl.textContent = `${savingsRate}%`;
  totalCountTextEl.textContent = `${summary.count} lançamento(s)`;
}

function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-table-body');
  const emptyState = document.getElementById('empty-state');
  const listCounter = document.getElementById('list-counter');
  const badgeTotalItems = document.getElementById('badge-total-items');

  const count = state.transactions.length;
  badgeTotalItems.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
  listCounter.textContent = count === 0 
    ? 'Nenhum lançamento no momento' 
    : `Exibindo ${count} transação(ões) encontrada(s)`;

  if (count === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
    return;
  }

  emptyState.classList.add('hidden');
  emptyState.classList.remove('flex');

  tbody.innerHTML = state.transactions.map(t => {
    const isReceita = t.type === 'receita';
    const catMeta = CATEGORY_META[t.category] || CATEGORY_META['Outros'];
    const formattedAmount = isReceita ? `+ ${formatCurrency(t.amount)}` : `- ${formatCurrency(t.amount)}`;
    const amountColorClass = isReceita ? 'text-emerald-400' : 'text-rose-400';

    return `
      <tr class="hover:bg-slate-800/60 transition-colors group">
        <!-- Tipo Badge -->
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isReceita ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
          }">
            <i class="fa-solid ${isReceita ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]"></i>
            ${isReceita ? 'Receita' : 'Despesa'}
          </span>
        </td>

        <!-- Descrição e Categoria -->
        <td class="py-3 px-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${catMeta.bg}">
              <i class="fa-solid ${catMeta.icon} text-xs"></i>
            </div>
            <div>
              <div class="font-semibold text-white">${escapeHtml(t.description)}</div>
              <div class="flex items-center gap-2 text-xs text-slate-400">
                <span>${escapeHtml(t.category)}</span>
                ${t.notes ? `<span>&bull;</span> <span class="italic max-w-xs truncate text-slate-400" title="${escapeHtml(t.notes)}">${escapeHtml(t.notes)}</span>` : ''}
              </div>
            </div>
          </div>
        </td>

        <!-- Forma de Pagamento -->
        <td class="py-3 px-4 hidden sm:table-cell whitespace-nowrap">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-[#0F172A] text-slate-300 border border-slate-700/60">
            ${escapeHtml(t.paymentMethod || 'Outro')}
          </span>
        </td>

        <!-- Data -->
        <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-400 font-medium">
          ${formatDate(t.date)}
        </td>

        <!-- Valor -->
        <td class="py-3 px-4 whitespace-nowrap text-right font-bold text-sm ${amountColorClass}">
          ${formattedAmount}
        </td>

        <!-- Ações -->
        <td class="py-3 px-4 whitespace-nowrap text-center">
          <div class="inline-flex items-center gap-1 opacity-90 group-hover:opacity-100">
            <button onclick="openEditModal('${t.id}')" title="Editar lançamento" class="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="openDeleteModal('${t.id}')" title="Excluir lançamento" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ----------------------------------------------------
// GRÁFICOS (CHART.JS - TEMA ESCURO)
// ----------------------------------------------------
function renderCharts(summary) {
  renderCategoryChart(summary ? summary.expenseByCategory : {});
  renderMonthlyChart(summary ? summary.monthlyHistory : {});
}

function renderCategoryChart(expenseByCategory = {}) {
  const ctx = document.getElementById('categoryChart');
  const emptyEl = document.getElementById('empty-chart-category');
  if (!ctx) return;

  const categories = Object.keys(expenseByCategory).filter(c => expenseByCategory[c] > 0);
  const values = categories.map(c => expenseByCategory[c]);

  if (categories.length === 0) {
    if (state.charts.category) {
      state.charts.category.destroy();
      state.charts.category = null;
    }
    emptyEl.classList.remove('hidden');
    ctx.style.display = 'none';
    return;
  }

  emptyEl.classList.add('hidden');
  ctx.style.display = 'block';

  const colors = categories.map(c => (CATEGORY_META[c] && CATEGORY_META[c].color) || '#94a3b8');

  if (state.charts.category) {
    state.charts.category.destroy();
  }

  state.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#1E293B',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 10,
            color: '#CBD5E1',
            font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          titleColor: '#FFFFFF',
          bodyColor: '#E2E8F0',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: function(item) {
              const val = item.raw || 0;
              const total = values.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${item.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

function renderMonthlyChart(monthlyHistory = {}) {
  const ctx = document.getElementById('monthlyChart');
  const emptyEl = document.getElementById('empty-chart-monthly');
  if (!ctx) return;

  const months = Object.keys(monthlyHistory).sort();

  if (months.length === 0) {
    if (state.charts.monthly) {
      state.charts.monthly.destroy();
      state.charts.monthly = null;
    }
    emptyEl.classList.remove('hidden');
    ctx.style.display = 'none';
    return;
  }

  emptyEl.classList.add('hidden');
  ctx.style.display = 'block';

  const displayMonths = months.slice(-6);
  const labels = displayMonths.map(m => formatMonthLabel(m));
  const incomes = displayMonths.map(m => monthlyHistory[m].income);
  const expenses = displayMonths.map(m => monthlyHistory[m].expense);

  if (state.charts.monthly) {
    state.charts.monthly.destroy();
  }

  state.charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Receitas',
          data: incomes,
          backgroundColor: '#10B981',
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        },
        {
          label: 'Despesas',
          data: expenses,
          backgroundColor: '#F43F5E',
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            padding: 10,
            color: '#94A3B8',
            font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" }
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          titleColor: '#FFFFFF',
          bodyColor: '#E2E8F0',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: function(item) {
              return ` ${item.dataset.label}: ${formatCurrency(item.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#94A3B8',
            font: { size: 9 },
            callback: function(value) {
              return 'R$ ' + value.toLocaleString('pt-BR');
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        x: {
          ticks: { color: '#94A3B8', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

// ----------------------------------------------------
// MODAL DE CADASTRO E EDIÇÃO DE TRANSAÇÃO
// ----------------------------------------------------
function openAddModal() {
  state.editingId = null;
  document.getElementById('modal-title').textContent = 'Nova Transação';
  document.getElementById('modal-icon').className = 'fa-solid fa-plus text-base';
  document.getElementById('modal-icon-container').className = 'w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20';
  document.getElementById('btn-save-transaction').innerHTML = '<i class="fa-solid fa-check"></i> <span>Salvar Lançamento</span>';

  document.getElementById('form-id').value = '';
  document.getElementById('form-description').value = '';
  document.getElementById('form-amount').value = '';
  document.getElementById('form-category').value = 'Alimentação';
  document.getElementById('form-payment').value = 'PIX';
  document.getElementById('form-notes').value = '';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('form-date').value = today;

  const radioDespesa = document.querySelector('input[name="form-type"][value="despesa"]');
  if (radioDespesa) radioDespesa.checked = true;

  document.getElementById('transaction-modal').classList.remove('hidden');
  document.getElementById('form-description').focus();
}

async function openEditModal(id) {
  try {
    const res = await authFetch(`/api/transactions/${id}`);
    if (!res.ok) throw new Error('Transação não encontrada');
    const transaction = await res.json();

    state.editingId = id;
    document.getElementById('modal-title').textContent = 'Editar Transação';
    document.getElementById('modal-icon').className = 'fa-solid fa-pen-to-square text-base';
    document.getElementById('modal-icon-container').className = 'w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20';
    document.getElementById('btn-save-transaction').innerHTML = '<i class="fa-solid fa-check"></i> <span>Atualizar Lançamento</span>';

    document.getElementById('form-id').value = transaction.id;
    document.getElementById('form-description').value = transaction.description || '';
    document.getElementById('form-amount').value = transaction.amount || '';
    document.getElementById('form-category').value = transaction.category || 'Outros';
    document.getElementById('form-payment').value = transaction.paymentMethod || 'Outro';
    document.getElementById('form-date').value = transaction.date || '';
    document.getElementById('form-notes').value = transaction.notes || '';

    const radio = document.querySelector(`input[name="form-type"][value="${transaction.type}"]`);
    if (radio) radio.checked = true;

    document.getElementById('transaction-modal').classList.remove('hidden');
    document.getElementById('form-description').focus();
  } catch (err) {
    console.error(err);
    showToast('Não foi possível carregar o lançamento para edição.', 'error');
  }
}

function closeModal() {
  document.getElementById('transaction-modal').classList.add('hidden');
  state.editingId = null;
}

// ----------------------------------------------------
// MODAL DE EXCLUSÃO
// ----------------------------------------------------
function openDeleteModal(id) {
  state.deletingId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  state.deletingId = null;
}

async function confirmDelete() {
  if (!state.deletingId) return;

  try {
    const res = await authFetch(`/api/transactions/${state.deletingId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Erro ao deletar lançamento');

    showToast('Transação excluída com sucesso!', 'success');
    closeDeleteModal();

    // Reatividade silenciosa: atualiza dados e DOM imediatamente
    await reloadDashboardData();
    await populateMonthDropdown();
    pulseSummaryCards();
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir transação.', 'error');
  }
}

// ----------------------------------------------------
// SALVAR OU ATUALIZAR TRANSAÇÃO (REATIVIDADE DINÂMICA)
// ----------------------------------------------------
async function handleTransactionSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('form-id').value;
  const type = document.querySelector('input[name="form-type"]:checked').value;
  const description = document.getElementById('form-description').value.trim();
  const amount = parseFloat(document.getElementById('form-amount').value);
  const date = document.getElementById('form-date').value;
  const category = document.getElementById('form-category').value;
  const paymentMethod = document.getElementById('form-payment').value;
  const notes = document.getElementById('form-notes').value.trim();

  if (!description) {
    showToast('Informe a descrição do lançamento.', 'error');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast('Informe um valor válido maior que zero.', 'error');
    return;
  }
  if (!date) {
    showToast('Selecione uma data.', 'error');
    return;
  }

  const payload = {
    type,
    description,
    amount,
    date,
    category,
    paymentMethod,
    notes
  };

  const isEditing = Boolean(id);
  const url = isEditing ? `/api/transactions/${id}` : '/api/transactions';
  const method = isEditing ? 'PUT' : 'POST';

  const btnSubmit = document.getElementById('btn-save-transaction');
  const originalText = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Salvando...</span>';

  try {
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erro ao salvar transação');
    }

    // 1. Fechar a modal imediatamente
    closeModal();

    // 2. Notificação visual de sucesso
    showToast(isEditing ? 'Transação atualizada com sucesso!' : 'Lançamento adicionado às FINANÇAS SILVA!', 'success');

    // 3. Reatividade Instantânea SEM recarregar página:
    // Dispara nova busca silenciosa para atualizar saldos, despesas, receitas e tabela
    await reloadDashboardData();
    await populateMonthDropdown();

    // 4. Feedback visual sutil de atualização nos cards
    pulseSummaryCards();

  } catch (err) {
    console.error('Erro na gravação:', err);
    showToast(err.message || 'Erro ao processar lançamento.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalText;
  }
}

// ----------------------------------------------------
// CARREGAR EXEMPLOS NA CONTA
// ----------------------------------------------------
async function loadSampleData() {
  try {
    const res = await authFetch('/api/load-sample', { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao carregar exemplos');
    showToast('Lançamentos de exemplo adicionados com sucesso!', 'success');
    await reloadDashboardData();
    await populateMonthDropdown();
    pulseSummaryCards();
  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar exemplos.', 'error');
  }
}

// ----------------------------------------------------
// INICIALIZAÇÃO E EVENT LISTENERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Alternância entre Abas de Login e Cadastro (Dark Mode)
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all text-white bg-[#1E293B] shadow-sm border border-slate-700/80';
    tabRegister.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all text-slate-400 hover:text-slate-200';
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all text-white bg-[#1E293B] shadow-sm border border-slate-700/80';
    tabLogin.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all text-slate-400 hover:text-slate-200';
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  });

  // 2. Preencher com usuário Demo (Família Silva)
  document.getElementById('btn-use-demo').addEventListener('click', () => {
    document.getElementById('login-email').value = 'demo@silva.com';
    document.getElementById('login-password').value = '123456';
    showToast('Dados do usuário demo preenchidos!', 'info');
  });

  // 3. Exibir/Ocultar Senha
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash text-xs"></i>';
      } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fa-solid fa-eye text-xs"></i>';
      }
    });
  });

  // 4. Submissão de Login e Cadastro
  formLogin.addEventListener('submit', handleLogin);
  formRegister.addEventListener('submit', handleRegister);

  // 5. Logout
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // 6. Ações de Modais
  document.getElementById('btn-open-modal-add').addEventListener('click', openAddModal);
  document.getElementById('btn-empty-add').addEventListener('click', openAddModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);

  document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-backdrop').addEventListener('click', closeDeleteModal);
  document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);

  // 7. Formulário de Transação
  document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);

  // 8. Botões de Lançamentos de Exemplo
  document.getElementById('btn-quick-sample').addEventListener('click', loadSampleData);
  document.getElementById('btn-empty-sample').addEventListener('click', loadSampleData);

  // 9. Filtro por Tipo (Pills Dark Mode)
  document.querySelectorAll('.type-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      state.filters.type = type;

      document.querySelectorAll('.type-filter-btn').forEach(b => {
        b.className = 'type-filter-btn flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all duration-150 text-slate-400 hover:text-white';
      });
      btn.className = 'type-filter-btn flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all duration-150 bg-[#1E293B] text-white shadow-sm font-semibold border border-slate-700/70';

      fetchTransactions();
    });
  });

  // 10. Filtro de Busca com debounce
  let searchTimeout = null;
  document.getElementById('filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      fetchTransactions();
    }, 250);
  });

  // 11. Filtro de Categoria
  document.getElementById('filter-category').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    fetchTransactions();
  });

  // 12. Filtro de Mês
  document.getElementById('filter-month').addEventListener('change', (e) => {
    state.filters.month = e.target.value;
    reloadDashboardData();
  });

  // 13. Ordenação
  document.getElementById('filter-sort').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    fetchTransactions();
  });

  // 14. Limpar Filtros
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filters = {
      type: 'todas',
      category: 'todas',
      search: '',
      month: '',
      sort: 'date-desc'
    };

    document.getElementById('filter-search').value = '';
    document.getElementById('filter-category').value = 'todas';
    document.getElementById('filter-month').value = '';
    document.getElementById('filter-sort').value = 'date-desc';

    document.querySelectorAll('.type-filter-btn').forEach(b => {
      if (b.getAttribute('data-type') === 'todas') {
        b.className = 'type-filter-btn flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all duration-150 bg-[#1E293B] text-white shadow-sm font-semibold border border-slate-700/70';
      } else {
        b.className = 'type-filter-btn flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all duration-150 text-slate-400 hover:text-white';
      }
    });

    reloadDashboardData();
  });

  // 15. Exportar CSV com passagem dinâmica do Token
  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', (e) => {
      const token = getAuthToken();
      if (token) {
        btnExport.href = `/api/export/csv?token=${encodeURIComponent(token)}`;
      }
    });
  }

  // Fechar com ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });

  // Checar sessão do usuário ao iniciar
  checkAuthSession();
});
