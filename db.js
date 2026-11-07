const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
// Na Vercel (Linux Serverless), os.tmpdir() aponta para /tmp (único diretório com permissão de escrita)
const DATA_DIR = isVercel ? os.tmpdir() : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'financas_silva.db');

// Em ambiente Serverless da Vercel, o sistema de arquivos fora de /tmp é somente leitura.
// Copiamos o banco inicial pré-semeado de data/ para /tmp para permitir leitura e escrita.
if (isVercel) {
  const seedDbFile = path.join(__dirname, 'data', 'financas_silva.db');
  if (fs.existsSync(seedDbFile) && !fs.existsSync(DB_FILE)) {
    try {
      fs.copyFileSync(seedDbFile, DB_FILE);
      console.log('📦 Banco SQLite inicial sincronizado com /tmp na Vercel.');
    } catch (err) {
      console.warn('Aviso ao sincronizar banco com /tmp na Vercel:', err);
    }
  }
}

const db = new DatabaseSync(DB_FILE);

// Ativar chaves estrangeiras e modo WAL para performance
db.exec('PRAGMA foreign_keys = ON;');

// Criação das tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
`);

// Função para semear o usuário de demonstração se o banco estiver vazio
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('🌱 Inicializando usuário padrão da Família Silva...');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('123456', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password)
      VALUES (?, ?, ?)
    `);
    insertUser.run('Família Silva', 'demo@silva.com', hashedPassword);

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@silva.com');
    const userId = user.id;

    // Inserir lançamentos iniciais da Família Silva
    const insertTransaction = db.prepare(`
      INSERT INTO transactions (id, user_id, description, amount, type, category, date, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

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
      insertTransaction.run(...tx);
    }

    // Inserir metas/orçamentos padrão para a Família Silva
    const insertBudget = db.prepare(`
      INSERT OR IGNORE INTO budgets (user_id, category, amount)
      VALUES (?, ?, ?)
    `);
    insertBudget.run(userId, 'Alimentação', 850.00);
    insertBudget.run(userId, 'Moradia', 1800.00);
    insertBudget.run(userId, 'Transporte', 400.00);
    insertBudget.run(userId, 'Lazer', 300.00);
    insertBudget.run(userId, 'Saúde', 250.00);

    console.log('✅ Banco SQLite semeado com sucesso!');
  }
}

seedInitialData();

module.exports = db;

