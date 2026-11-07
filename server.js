const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { db, initPromise } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Segredo JWT e Nome do Cookie (compatível com Vercel Serverless)
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'financas-silva-jwt-secret-2026';
const TOKEN_COOKIE_NAME = 'financas_silva_token';

// Middlewares essenciais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Confiança no Proxy (necessário para Vercel e proxies reversos HTTPS)
app.set('trust proxy', 1);

// Servir arquivos estáticos do front-end com caminhos absolutos seguros
app.use(express.static(path.join(__dirname, 'public')));

// Rotas explícitas de Favicon e Logo para garantir compatibilidade imediata no navegador
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});
app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});
app.get('/logo.jpeg', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logo.jpeg'));
});

// Garantir que a inicialização do banco Turso terminou antes de processar rotas da API
app.use(async (req, res, next) => {
  try {
    await initPromise;
    next();
  } catch (err) {
    console.error('Erro na inicialização do banco Turso:', err);
    res.status(500).json({ error: 'Erro de conexão com o banco de dados na nuvem.' });
  }
});

// Função auxiliar para extrair o token JWT de múltiplos canais (Header Bearer, Cookie, x-access-token, query)
function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && req.cookies[TOKEN_COOKIE_NAME]) {
    return req.cookies[TOKEN_COOKIE_NAME];
  }
  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'];
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

// Middleware de Proteção de Rota Baseado em JWT (Stateless - 100% Funcional na Vercel Serverless)
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Por favor, faça login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, email }
    req.session = { user: decoded }; // Mantém compatibilidade total
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
  }
}

// ----------------------------------------------------
// ROTAS DE AUTENTICAÇÃO (CADASTRO, LOGIN, SESSÃO, LOGOUT)
// ----------------------------------------------------

// 1. Cadastro de Novo Usuário (com criptografia bcryptjs e JWT persistente)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Por favor, informe seu nome completo.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Por favor, informe seu e-mail.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'E-mail em formato inválido.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verificar se o e-mail já está cadastrado no Turso
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [cleanEmail]
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }

    // Criptografar a senha com bcryptjs
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Inserir usuário no Turso
    const insertRes = await db.execute({
      sql: 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      args: [name.trim(), cleanEmail, hashedPassword]
    });

    const newUserId = Number(insertRes.lastInsertRowid);

    // Gerar Token JWT com validade de 30 dias
    const token = jwt.sign(
      { id: newUserId, name: name.trim(), email: cleanEmail },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Salvar em Cookie HTTP-only seguro
    res.cookie(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      token,
      user: {
        id: newUserId,
        name: name.trim(),
        email: cleanEmail
      }
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
});

// 2. Login de Usuário (verificação de senha com bcryptjs e geração de JWT)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Buscar usuário no Turso
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [cleanEmail]
    });

    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Comparar senha com o hash criptografado
    const match = bcrypt.compareSync(password, String(user.password));
    if (!match) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Gerar Token JWT com validade de 30 dias
    const token = jwt.sign(
      { id: Number(user.id), name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Salvar em Cookie HTTP-only seguro
    res.cookie(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

// 3. Obter Usuário Logado da Sessão / Token Atual
app.get('/api/auth/me', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Nenhum usuário autenticado.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ user: decoded, token });
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada ou token inválido.' });
  }
});

// 4. Logout (Encerrar Sessão e Limpar Cookie)
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    path: '/'
  });
  res.json({ message: 'Sessão encerrada com sucesso.' });
});

// ----------------------------------------------------
// ROTAS DE TRANSAÇÕES (EXCLUSIVAS POR USUÁRIO LOGADO)
// ----------------------------------------------------

// 5. Listar transações do usuário logado com filtros
app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, category, search, month, sort } = req.query;

    let query = `
      SELECT 
        id, 
        user_id as userId, 
        description, 
        amount, 
        type, 
        category, 
        date, 
        payment_method as paymentMethod, 
        notes, 
        created_at as createdAt 
      FROM transactions 
      WHERE user_id = ?
    `;
    const params = [userId];

    if (type && type !== 'todas') {
      query += ` AND LOWER(type) = LOWER(?)`;
      params.push(type);
    }

    if (category && category !== 'todas') {
      query += ` AND LOWER(category) = LOWER(?)`;
      params.push(category);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(description) LIKE ? OR LOWER(notes) LIKE ? OR LOWER(payment_method) LIKE ?)`;
      params.push(term, term, term);
    }

    if (month && month.trim()) {
      query += ` AND date LIKE ?`;
      params.push(`${month.trim()}%`);
    }

    // Ordenação
    if (sort === 'amount-asc') {
      query += ` ORDER BY amount ASC`;
    } else if (sort === 'amount-desc') {
      query += ` ORDER BY amount DESC`;
    } else if (sort === 'date-asc') {
      query += ` ORDER BY date ASC, created_at ASC`;
    } else {
      // Padrão: mais recente primeiro
      query += ` ORDER BY date DESC, created_at DESC`;
    }

    const result = await db.execute({ sql: query, args: params });
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar transações:', err);
    res.status(500).json({ error: 'Erro ao buscar transações.' });
  }
});

// 6. Resumo Financeiro Consolidado (somente do usuário logado)
app.get('/api/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    // Buscar todas as transações do usuário para histórico mensal
    const allUserTxsRes = await db.execute({
      sql: `SELECT amount, type, category, date, description FROM transactions WHERE user_id = ?`,
      args: [userId]
    });
    const allUserTxs = allUserTxsRes.rows;

    const monthlyHistory = {};
    allUserTxs.forEach(t => {
      const m = (t.date || '').substring(0, 7);
      if (m) {
        if (!monthlyHistory[m]) {
          monthlyHistory[m] = { income: 0, expense: 0 };
        }
        if (t.type === 'receita') {
          monthlyHistory[m].income += Number(t.amount) || 0;
        } else if (t.type === 'despesa') {
          monthlyHistory[m].expense += Number(t.amount) || 0;
        }
      }
    });

    // Filtrar pelo mês selecionado (se informado)
    let filteredTxs = allUserTxs;
    if (month && month.trim()) {
      filteredTxs = allUserTxs.filter(t => t.date && t.date.startsWith(month.trim()));
    }

    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCategory = {};
    const incomeByCategory = {};
    let highestExpense = null;
    let highestIncome = null;
    const expenseDays = new Set();

    filteredTxs.forEach(t => {
      const val = Number(t.amount) || 0;
      if (t.type === 'receita') {
        totalIncome += val;
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + val;
        if (!highestIncome || val > highestIncome.amount) {
          highestIncome = { description: t.description, amount: val, date: t.date, category: t.category };
        }
      } else if (t.type === 'despesa') {
        totalExpense += val;
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + val;
        if (t.date) expenseDays.add(t.date);
        if (!highestExpense || val > highestExpense.amount) {
          highestExpense = { description: t.description, amount: val, date: t.date, category: t.category };
        }
      }
    });

    const daysCount = expenseDays.size || 1;
    const dailyAverageExpense = totalExpense > 0 ? Number((totalExpense / daysCount).toFixed(2)) : 0;

    // Formatar casas decimais
    for (const cat in expenseByCategory) {
      expenseByCategory[cat] = Number(expenseByCategory[cat].toFixed(2));
    }
    for (const cat in incomeByCategory) {
      incomeByCategory[cat] = Number(incomeByCategory[cat].toFixed(2));
    }
    for (const m in monthlyHistory) {
      monthlyHistory[m].income = Number(monthlyHistory[m].income.toFixed(2));
      monthlyHistory[m].expense = Number(monthlyHistory[m].expense.toFixed(2));
    }

    const totalBalance = totalIncome - totalExpense;

    res.json({
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      totalBalance: Number(totalBalance.toFixed(2)),
      count: filteredTxs.length,
      expenseByCategory,
      incomeByCategory,
      monthlyHistory,
      insights: {
        highestExpense,
        highestIncome,
        dailyAverageExpense
      }
    });
  } catch (err) {
    console.error('Erro no resumo:', err);
    res.status(500).json({ error: 'Erro ao gerar resumo financeiro.' });
  }
});

// 7. Obter transação por ID (verificando que pertence ao usuário)
app.get('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.execute({
      sql: `
        SELECT 
          id, 
          user_id as userId, 
          description, 
          amount, 
          type, 
          category, 
          date, 
          payment_method as paymentMethod, 
          notes, 
          created_at as createdAt 
        FROM transactions 
        WHERE id = ? AND user_id = ?
      `,
      args: [req.params.id, userId]
    });

    const tx = result.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Transação não encontrada ou você não tem permissão.' });
    }

    res.json(tx);
  } catch (err) {
    console.error('Erro ao carregar transação:', err);
    res.status(500).json({ error: 'Erro ao carregar transação.' });
  }
});

// 8. Criar nova transação para o usuário logado
app.post('/api/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { description, amount, type, category, date, paymentMethod, notes } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'A descrição é obrigatória.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'O valor deve ser maior que zero.' });
    }

    if (!['receita', 'despesa'].includes(type)) {
      return res.status(400).json({ error: 'O tipo deve ser receita ou despesa.' });
    }

    const newId = crypto.randomUUID();
    const cleanDate = date || new Date().toISOString().split('T')[0];
    const cleanCategory = category ? category.trim() : 'Outros';
    const cleanPayment = paymentMethod ? paymentMethod.trim() : 'Outro';
    const cleanNotes = notes ? notes.trim() : '';
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: `
        INSERT INTO transactions (id, user_id, description, amount, type, category, date, payment_method, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        newId,
        userId,
        description.trim(),
        Number(numAmount.toFixed(2)),
        type,
        cleanCategory,
        cleanDate,
        cleanPayment,
        cleanNotes,
        createdAt
      ]
    });

    res.status(201).json({
      id: newId,
      userId,
      description: description.trim(),
      amount: Number(numAmount.toFixed(2)),
      type,
      category: cleanCategory,
      date: cleanDate,
      paymentMethod: cleanPayment,
      notes: cleanNotes,
      createdAt
    });
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    res.status(500).json({ error: 'Erro ao cadastrar transação.' });
  }
});

// 9. Atualizar transação existente (apenas se pertencer ao usuário logado)
app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { description, amount, type, category, date, paymentMethod, notes } = req.body;

    // Verificar existência e propriedade
    const currentRes = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, userId]
    });
    const current = currentRes.rows[0];

    if (!current) {
      return res.status(404).json({ error: 'Transação não encontrada ou acesso não autorizado.' });
    }

    if (description !== undefined && !description.trim()) {
      return res.status(400).json({ error: 'A descrição não pode ser vazia.' });
    }

    let numAmount = current.amount;
    if (amount !== undefined) {
      numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'O valor deve ser maior que zero.' });
      }
    }

    const updatedDesc = description !== undefined ? description.trim() : current.description;
    const updatedType = type !== undefined ? type : current.type;
    const updatedCategory = category !== undefined ? category.trim() : current.category;
    const updatedDate = date !== undefined ? date : current.date;
    const updatedPayment = paymentMethod !== undefined ? paymentMethod.trim() : current.payment_method;
    const updatedNotes = notes !== undefined ? notes.trim() : current.notes;

    await db.execute({
      sql: `
        UPDATE transactions
        SET description = ?, amount = ?, type = ?, category = ?, date = ?, payment_method = ?, notes = ?
        WHERE id = ? AND user_id = ?
      `,
      args: [
        updatedDesc,
        Number(numAmount.toFixed(2)),
        updatedType,
        updatedCategory,
        updatedDate,
        updatedPayment,
        updatedNotes,
        id,
        userId
      ]
    });

    res.json({
      id,
      userId,
      description: updatedDesc,
      amount: Number(numAmount.toFixed(2)),
      type: updatedType,
      category: updatedCategory,
      date: updatedDate,
      paymentMethod: updatedPayment,
      notes: updatedNotes
    });
  } catch (err) {
    console.error('Erro ao atualizar transação:', err);
    res.status(500).json({ error: 'Erro ao atualizar transação.' });
  }
});

// 10. Deletar transação (apenas se pertencer ao usuário logado)
app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const currentRes = await db.execute({
      sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, userId]
    });

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada ou você não tem permissão.' });
    }

    await db.execute({
      sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, userId]
    });

    res.json({ message: 'Transação excluída com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir transação:', err);
    res.status(500).json({ error: 'Erro ao remover transação.' });
  }
});

// 11. Exportar CSV (apenas transações do usuário logado)
app.get('/api/export/csv', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      args: [userId]
    });
    const items = result.rows;

    const headers = ['ID', 'Data', 'Tipo', 'Descrição', 'Categoria', 'Forma de Pagamento', 'Valor (R$)', 'Observações'];
    const rows = items.map(t => [
      `"${t.id}"`,
      `"${t.date || ''}"`,
      `"${t.type === 'receita' ? 'Receita' : 'Despesa'}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.payment_method || '').replace(/"/g, '""')}"`,
      `"${(Number(t.amount) || 0).toFixed(2).replace('.', ',')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="financas_silva.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('Erro ao exportar CSV:', err);
    res.status(500).send('Erro ao gerar CSV.');
  }
});

// 12. Carregar dados de exemplo na conta do usuário logado
app.post('/api/load-sample', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const sampleData = [
      [crypto.randomUUID(), userId, 'Salário Silva', 4800.00, 'receita', 'Salário', '2026-11-01', 'PIX', 'Recebimento salarial', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Aluguel Silva', 1300.00, 'despesa', 'Moradia', '2026-11-02', 'Boleto', 'Aluguel do mês', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Supermercado Silva', 650.00, 'despesa', 'Alimentação', '2026-11-03', 'Cartão de Crédito', 'Compras da semana', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Projeto Extra Silva', 950.00, 'receita', 'Serviços', '2026-11-04', 'PIX', 'Consultoria avulsa', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Energia Elétrica', 180.00, 'despesa', 'Moradia', '2026-11-04', 'Boleto', 'Conta de luz', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Combustível Automóvel', 200.00, 'despesa', 'Transporte', '2026-11-05', 'Cartão de Débito', 'Gasolina', new Date().toISOString()]
    ];

    for (const row of sampleData) {
      await db.execute({
        sql: `INSERT INTO transactions (id, user_id, description, amount, type, category, date, payment_method, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: row
      });
    }

    res.json({ message: 'Dados de exemplo adicionados com sucesso!', count: sampleData.length });
  } catch (err) {
    console.error('Erro ao carregar exemplos:', err);
    res.status(500).json({ error: 'Erro ao carregar lançamentos de exemplo.' });
  }
});

// 13. Metas / Orçamentos por Categoria (Multi-usuário)
app.get('/api/budgets', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const budgetsRes = await db.execute({
      sql: 'SELECT category, amount FROM budgets WHERE user_id = ?',
      args: [userId]
    });
    const budgets = budgetsRes.rows;

    const expensesRes = await db.execute({
      sql: `
        SELECT category, SUM(amount) as spent
        FROM transactions
        WHERE user_id = ? AND type = 'despesa' AND date LIKE ?
        GROUP BY category
      `,
      args: [userId, `${targetMonth}%`]
    });
    const expenses = expensesRes.rows;

    const spentMap = {};
    expenses.forEach(e => {
      spentMap[e.category] = Number(e.spent) || 0;
    });

    const result = budgets.map(b => {
      const spent = spentMap[b.category] || 0;
      const limit = Number(b.amount) || 0;
      const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return {
        category: b.category,
        limit: Number(limit.toFixed(2)),
        spent: Number(spent.toFixed(2)),
        remaining: Number((limit - spent).toFixed(2)),
        percentage
      };
    });

    res.json({ month: targetMonth, budgets: result });
  } catch (err) {
    console.error('Erro ao buscar metas:', err);
    res.status(500).json({ error: 'Erro ao carregar metas.' });
  }
});

// 14. Cadastrar ou Atualizar Meta
app.post('/api/budgets', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, amount } = req.body;

    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Categoria é obrigatória.' });
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ error: 'Informe um valor limite válido maior que zero.' });
    }

    await db.execute({
      sql: `
        INSERT INTO budgets (user_id, category, amount)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, category) DO UPDATE SET amount = excluded.amount
      `,
      args: [userId, category.trim(), Number(num.toFixed(2))]
    });

    res.json({ message: 'Meta salva com sucesso!', category: category.trim(), amount: Number(num.toFixed(2)) });
  } catch (err) {
    console.error('Erro ao salvar meta:', err);
    res.status(500).json({ error: 'Erro ao salvar meta.' });
  }
});

// 15. Remover Meta
app.delete('/api/budgets/:category', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await db.execute({
      sql: 'DELETE FROM budgets WHERE user_id = ? AND category = ?',
      args: [userId, req.params.category]
    });
    res.json({ message: 'Meta removida com sucesso!' });
  } catch (err) {
    console.error('Erro ao remover meta:', err);
    res.status(500).json({ error: 'Erro ao remover meta.' });
  }
});

// 16. Atualizar Perfil do Usuário (Nome ou Senha)
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, currentPassword, newPassword } = req.body;

    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId]
    });
    const user = userRes.rows[0];

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    let updatedName = user.name;
    if (name && name.trim()) {
      updatedName = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Informe sua senha atual para definir uma nova.' });
      }
      const match = bcrypt.compareSync(currentPassword, String(user.password));
      if (!match) {
        return res.status(400).json({ error: 'Senha atual incorreta.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
      }
      const salt = bcrypt.genSaltSync(10);
      const hashed = bcrypt.hashSync(newPassword, salt);

      await db.execute({
        sql: 'UPDATE users SET name = ?, password = ? WHERE id = ?',
        args: [updatedName, hashed, userId]
      });
    } else {
      await db.execute({
        sql: 'UPDATE users SET name = ? WHERE id = ?',
        args: [updatedName, userId]
      });
    }

    // Gerar novo token JWT atualizado
    const newToken = jwt.sign(
      { id: userId, name: updatedName, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie(TOKEN_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Perfil atualizado com sucesso!',
      token: newToken,
      user: { id: userId, name: updatedName, email: user.email }
    });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro ao atualizar dados do perfil.' });
  }
});

// Fallback SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor apenas se executado diretamente
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🏛️  FINANÇAS SILVA - Autenticação JWT Stateless (Vercel Ready)`);
    console.log(`🚀 Servidor rodando com sucesso na porta: ${PORT}`);
    console.log(`🌐 Acesse no seu navegador: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
