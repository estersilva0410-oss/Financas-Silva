const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares essenciais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Confiança no Proxy (necessário para Vercel e ambientes serverless HTTPS)
app.set('trust proxy', 1);

// Gerenciamento de Sessão de Usuário
app.use(session({
  name: 'financas_silva_sid',
  secret: process.env.SESSION_SECRET || 'financas-silva-segredo-criptografico-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Compatível com HTTP local e proxies da Vercel
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas de sessão
  }
}));

// Servir arquivos estáticos do front-end
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Proteção de Rota (Autenticação Obrigatória)
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Acesso não autorizado. Por favor, faça login.' });
  }
  next();
}

// ----------------------------------------------------
// ROTAS DE AUTENTICAÇÃO (CADASTRO, LOGIN, SESSÃO, LOGOUT)
// ----------------------------------------------------

// 1. Cadastro de Novo Usuário (com criptografia bcryptjs)
app.post('/api/auth/register', (req, res) => {
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

    // Verificar se o e-mail já está cadastrado
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }

    // Criptografar a senha com bcryptjs
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Inserir usuário no SQLite
    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, password)
      VALUES (?, ?, ?)
    `);
    const info = insertStmt.run(name.trim(), cleanEmail, hashedPassword);
    const newUserId = Number(info.lastInsertRowid);

    // Iniciar sessão automaticamente após o cadastro
    req.session.user = {
      id: newUserId,
      name: name.trim(),
      email: cleanEmail
    };

    res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
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

// 2. Login de Usuário (verificação de senha com bcryptjs)
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Buscar usuário no SQLite
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Comparar senha com o hash criptografado
    const match = bcrypt.compareSync(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Gerar sessão do usuário
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

// 3. Obter Usuário Logado da Sessão Atual
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ error: 'Nenhum usuário autenticado.' });
});

// 4. Logout (Encerrar Sessão)
app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
      }
      res.clearCookie('financas_silva_sid');
      return res.json({ message: 'Sessão encerrada com sucesso.' });
    });
  } else {
    res.json({ message: 'Sessão encerrada.' });
  }
});

// ----------------------------------------------------
// ROTAS DE TRANSAÇÕES (EXCLUSIVAS POR USUÁRIO LOGADO)
// ----------------------------------------------------

// 5. Listar transações do usuário logado com filtros
app.get('/api/transactions', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
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

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (err) {
    console.error('Erro ao listar transações:', err);
    res.status(500).json({ error: 'Erro ao buscar transações.' });
  }
});

// 6. Resumo Financeiro Consolidado (somente do usuário logado)
app.get('/api/summary', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { month } = req.query;

    // Buscar todas as transações do usuário para histórico mensal
    const allUserTxs = db.prepare(`
      SELECT amount, type, category, date
      FROM transactions
      WHERE user_id = ?
    `).all(userId);

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
app.get('/api/transactions/:id', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const tx = db.prepare(`
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
    `).get(req.params.id, userId);

    if (!tx) {
      return res.status(404).json({ error: 'Transação não encontrada ou você não tem permissão.' });
    }

    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar transação.' });
  }
});

// 8. Criar nova transação para o usuário logado
app.post('/api/transactions', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
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

    const insertStmt = db.prepare(`
      INSERT INTO transactions (id, user_id, description, amount, type, category, date, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
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
    );

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
app.put('/api/transactions/:id', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;
    const { description, amount, type, category, date, paymentMethod, notes } = req.body;

    // Verificar existência e propriedade
    const current = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
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

    const updateStmt = db.prepare(`
      UPDATE transactions
      SET description = ?, amount = ?, type = ?, category = ?, date = ?, payment_method = ?, notes = ?
      WHERE id = ? AND user_id = ?
    `);

    updateStmt.run(
      updatedDesc,
      Number(numAmount.toFixed(2)),
      updatedType,
      updatedCategory,
      updatedDate,
      updatedPayment,
      updatedNotes,
      id,
      userId
    );

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
app.delete('/api/transactions/:id', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    const current = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
    if (!current) {
      return res.status(404).json({ error: 'Transação não encontrada ou você não tem permissão.' });
    }

    db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);

    res.json({ message: 'Transação excluída com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir transação:', err);
    res.status(500).json({ error: 'Erro ao remover transação.' });
  }
});

// 11. Exportar CSV (apenas transações do usuário logado)
app.get('/api/export/csv', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const items = db.prepare(`
      SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC
    `).all(userId);

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
app.post('/api/load-sample', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;

    const sampleData = [
      [crypto.randomUUID(), userId, 'Salário Silva', 4800.00, 'receita', 'Salário', '2026-11-01', 'PIX', 'Recebimento salarial', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Aluguel Silva', 1300.00, 'despesa', 'Moradia', '2026-11-02', 'Boleto', 'Aluguel do mês', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Supermercado Silva', 650.00, 'despesa', 'Alimentação', '2026-11-03', 'Cartão de Crédito', 'Compras da semana', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Projeto Extra Silva', 950.00, 'receita', 'Serviços', '2026-11-04', 'PIX', 'Consultoria avulsa', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Energia Elétrica', 180.00, 'despesa', 'Moradia', '2026-11-04', 'Boleto', 'Conta de luz', new Date().toISOString()],
      [crypto.randomUUID(), userId, 'Combustível Automóvel', 200.00, 'despesa', 'Transporte', '2026-11-05', 'Cartão de Débito', 'Gasolina', new Date().toISOString()]
    ];

    const stmt = db.prepare(`
      INSERT INTO transactions (id, user_id, description, amount, type, category, date, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of sampleData) {
      stmt.run(...row);
    }

    res.json({ message: 'Dados de exemplo adicionados com sucesso!', count: sampleData.length });
  } catch (err) {
    console.error('Erro ao carregar exemplos:', err);
    res.status(500).json({ error: 'Erro ao carregar lançamentos de exemplo.' });
  }
});

// 13. Metas / Orçamentos por Categoria (Multi-usuário)
app.get('/api/budgets', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const budgets = db.prepare('SELECT category, amount FROM budgets WHERE user_id = ?').all(userId);

    const expenses = db.prepare(`
      SELECT category, SUM(amount) as spent
      FROM transactions
      WHERE user_id = ? AND type = 'despesa' AND date LIKE ?
      GROUP BY category
    `).all(userId, `${targetMonth}%`);

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
app.post('/api/budgets', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { category, amount } = req.body;

    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Categoria é obrigatória.' });
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ error: 'Informe um valor limite válido maior que zero.' });
    }

    const stmt = db.prepare(`
      INSERT INTO budgets (user_id, category, amount)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, category) DO UPDATE SET amount = excluded.amount
    `);
    stmt.run(userId, category.trim(), Number(num.toFixed(2)));

    res.json({ message: 'Meta salva com sucesso!', category: category.trim(), amount: Number(num.toFixed(2)) });
  } catch (err) {
    console.error('Erro ao salvar meta:', err);
    res.status(500).json({ error: 'Erro ao salvar meta.' });
  }
});

// 15. Remover Meta
app.delete('/api/budgets/:category', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    db.prepare('DELETE FROM budgets WHERE user_id = ? AND category = ?').run(userId, req.params.category);
    res.json({ message: 'Meta removida com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover meta.' });
  }
});

// 16. Atualizar Perfil do Usuário (Nome ou Senha)
app.put('/api/auth/profile', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    let updatedName = user.name;
    if (name && name.trim()) {
      updatedName = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Informe sua senha atual para definir uma nova.' });
      }
      const match = bcrypt.compareSync(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({ error: 'Senha atual incorreta.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
      }
      const salt = bcrypt.genSaltSync(10);
      const hashed = bcrypt.hashSync(newPassword, salt);
      db.prepare('UPDATE users SET name = ?, password = ? WHERE id = ?').run(updatedName, hashed, userId);
    } else {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(updatedName, userId);
    }

    req.session.user.name = updatedName;
    res.json({ message: 'Perfil atualizado com sucesso!', user: { id: userId, name: updatedName, email: user.email } });
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
    console.log(`🏛️  FINANÇAS SILVA - Sistema Multi-usuário SQLite`);
    console.log(`🚀 Servidor rodando com sucesso na porta: ${PORT}`);
    console.log(`🌐 Acesse no seu navegador: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
