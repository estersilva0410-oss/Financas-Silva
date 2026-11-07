const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'libsql://financas-silva-estersilva0410-oss.aws-sa-east-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTQwNzMzMTAsImlkIjoiMDFhMWI3MTctOTYwMS03MmFkLTk0OTQtZjVmNWMzNGRmNjExIiwia2lkIjoibjhicXJISU56dFgycGtGSFo5N21hN3pSdzItWDRZZlZnak9zZm1WdHl4SSIsInJpZCI6IjgzZjJjM2QxLWU0YzAtNDIwZC1hMTZhLTQyOGU0MWI1YzFjNyJ9.f6xARz5NTBNfl7QvS4O9goXg25jEQF5qczQJxx-WBJZv6-IWt9Kx_7XfNP0FP4h4_Y3s2hH1rA8XdtljNFJqBw';

const db = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN
});

// Inicialização das tabelas e semeadura automática no Turso
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        payment_method TEXT,
        notes TEXT,
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, category),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);`);

    // Verificar se já existe o usuário de demonstração padrão
    const checkUser = await db.execute('SELECT COUNT(*) as count FROM users');
    const count = Number(checkUser.rows[0].count) || 0;

    if (count === 0) {
      console.log('🌱 Inicializando usuário padrão da Família Silva no Turso...');
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('123456', salt);

      const userRes = await db.execute({
        sql: 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        args: ['Família Silva', 'demo@silva.com', hashedPassword]
      });

      const userId = Number(userRes.lastInsertRowid);

      const initialTransactions = [
        ['tx-1', userId, 'Salário Principal', 5200.00, 'receita', 'Salário', '2026-11-01', 'PIX', 'Salário mensal', '2026-11-01T08:00:00.000Z'],
        ['tx-2', userId, 'Aluguel do Apartamento', 1450.00, 'despesa', 'Moradia', '2026-11-02', 'Boleto', 'Vencimento dia 05', '2026-11-02T10:15:00.000Z'],
        ['tx-3', userId, 'Supermercado da Família', 720.50, 'despesa', 'Alimentação', '2026-11-03', 'Cartão de Crédito', 'Compras do mês', '2026-11-03T14:30:00.000Z'],
        ['tx-4', userId, 'Freelance Consultoria', 1350.00, 'receita', 'Serviços', '2026-11-04', 'PIX', 'Projeto Silva Dev', '2026-11-04T16:00:00.000Z'],
        ['tx-5', userId, 'Conta de Energia (Luz)', 195.40, 'despesa', 'Moradia', '2026-11-04', 'Boleto', 'Consumo residencial', '2026-11-04T18:20:00.000Z'],
        ['tx-6', userId, 'Abastecimento Veículo', 230.00, 'despesa', 'Transporte', '2026-11-05', 'Cartão de Débito', 'Gasolina comum', '2026-11-05T09:45:00.000Z'],
        ['tx-7', userId, 'Farmácia e Vitaminas', 88.90, 'despesa', 'Saúde', '2026-11-05', 'Cartão de Débito', 'Medicamentos Silva', '2026-11-05T11:10:00.000Z'],
        ['tx-8', userId, 'Pizzaria no Final de Semana', 165.00, 'despesa', 'Lazer', '2026-11-05', 'Cartão de Crédito', 'Jantar familiar', '2026-11-05T20:40:00.000Z'],
        ['tx-9', userId, 'Internet Fibra 600MB', 129.90, 'despesa', 'Moradia', '2026-11-06', 'Boleto', 'Plano residencial', '2026-11-06T08:30:00.000Z']
      ];

      for (const tx of initialTransactions) {
        await db.execute({
          sql: 'INSERT INTO transactions (id, user_id, description, amount, type, category, date, payment_method, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: tx
        });
      }

      await db.execute({
        sql: 'INSERT OR IGNORE INTO budgets (user_id, category, amount) VALUES (?, ?, ?)',
        args: [userId, 'Alimentação', 850.00]
      });
      await db.execute({
        sql: 'INSERT OR IGNORE INTO budgets (user_id, category, amount) VALUES (?, ?, ?)',
        args: [userId, 'Moradia', 1800.00]
      });
      await db.execute({
        sql: 'INSERT OR IGNORE INTO budgets (user_id, category, amount) VALUES (?, ?, ?)',
        args: [userId, 'Transporte', 400.00]
      });
      await db.execute({
        sql: 'INSERT OR IGNORE INTO budgets (user_id, category, amount) VALUES (?, ?, ?)',
        args: [userId, 'Lazer', 300.00]
      });
      await db.execute({
        sql: 'INSERT OR IGNORE INTO budgets (user_id, category, amount) VALUES (?, ?, ?)',
        args: [userId, 'Saúde', 250.00]
      });

      console.log('✅ Banco Turso conectado e semeado com sucesso!');
    }
  } catch (err) {
    console.error('Erro na inicialização do Turso:', err);
  }
}

const initPromise = initDb();

module.exports = { db, initPromise };
