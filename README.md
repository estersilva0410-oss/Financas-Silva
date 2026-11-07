# 🏛️ FINANÇAS SILVA - Controle Financeiro Multi-usuário na Nuvem

Aplicativo web completo, moderno e seguro para controle financeiro pessoal e familiar, desenvolvido em **Node.js**, **Express**, banco na nuvem **Turso (LibSQL)** com **@libsql/client** e criptografia **bcryptjs**, pronto para execução local ou **deploy na Vercel**.

---

## 🌟 Recursos do Sistema

1. **Persistência Definitiva no Turso Cloud**:
   - Conexão nativa com `@libsql/client` (LibSQL / SQLite distribuído).
   - Dados de usuários, transações e metas persistidos de forma perene no ambiente serverless da Vercel.
2. **Dark Mode Minimalista**:
   - Paleta em tons de grafite escuro (`#0F172A`) e cartões em cinza escuro (`#1E293B`) com cantos arredondados de `16px`.
   - Logotipo em destaque no cabeçalho (~75px–80px) e marca d'água suave no fundo (`body::before`).
   - Modais com contraste otimizado (overlay `z-index: 1000` e caixa `z-index: 1001`).
3. **Autenticação Segura JWT & Multi-usuário**:
   - Cadastro e Login com e-mail e senha.
   - Criptografia com `bcryptjs` (salt de 10 rounds).
   - Sessão stateless com **JWT (JSON Web Token)** armazenado em Cookie HTTP-only e `localStorage` (100% resiliente no ambiente Serverless da Vercel).
   - **Isolamento Total**: cada usuário acessa, cria, edita e exclui exclusivamente os seus próprios lançamentos e metas.
4. **Dashboard e Relatórios**:
   - Saldo atual, receitas, despesas, taxa de economia e média diária de gastos.
   - Gráficos de rosca (despesas por categoria) e barras (mensal) via Chart.js.
   - Metas de orçamento com barras de progresso dinâmicas.
   - Filtros rápidos por tipo (Todas, Receitas, Despesas), busca textual, categoria, mês e ordenação.
   - Exportação de extrato em planilha CSV formatada.

---

## 🚀 Como Fazer o Deploy na Vercel

O projeto já está **100% configurado** para a Vercel com os arquivos [`vercel.json`](vercel.json), [`api/index.js`](api/index.js), `.vercelignore` e `.env.example`.

### Opção 1: Via GitHub (Recomendado)
1. Crie um repositório no seu GitHub (ex: `financas-silva`) e suba os arquivos do projeto:
   ```bash
   git init
   git add .
   git commit -m "feat: FINANCAS SILVA com Turso e Vercel"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/financas-silva.git
   git push -u origin main
   ```
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New..." > "Project"**.
3. Selecione o repositório que você subiu.
4. *(Opcional)* Em **Environment Variables**, você pode definir:
   - `TURSO_DATABASE_URL`: `https://financas-silva-estersilva0410-oss.aws-sa-east-1.turso.io`
   - `TURSO_AUTH_TOKEN`: *(Seu token de autenticação Turso)*
   - `SESSION_SECRET`: *(Uma chave de sua preferência)*
   *(Nota: O código já possui fallback integrado para suas credenciais do Turso caso não defina as variáveis).*
5. Clique em **"Deploy"**. A Vercel executará o deploy automaticamente!

### Opção 2: Via Vercel CLI (Direto do Terminal)
1. No terminal do projeto, execute:
   ```bash
   npx vercel
   ```
2. Siga as instruções no terminal (faça login na sua conta Vercel e confirme os prompts padrão pressionando `Enter`).
3. Ao finalizar, o link de produção será exibido.

---

## 💻 Como Rodar Localmente

### Pré-requisitos
- Node.js 20 ou superior instalado.

### 1. Iniciar o Servidor
```bash
npm start
```
*(ou `node server.js`)*

### 2. Acessar no Navegador
Abra:
```
http://localhost:3000
```

### 3. Credenciais da Conta de Demonstração
- **E-mail:** `demo@silva.com`
- **Senha:** `123456`
*(Ou clique no botão "Preencher com Usuário Demo" na tela de login).*

---

## 📂 Estrutura de Arquivos

```
ERJ DEVS/
├── api/
│   └── index.js               # Handler Serverless para a Vercel
├── public/
│   ├── css/
│   │   └── styles.css         # Dark Mode minimalista e marca d'água
│   ├── js/
│   │   └── app.js             # Lógica cliente (sessão, CRUD, filtros, gráficos)
│   ├── index.html             # Interface responsiva
│   └── logo fiunanças.jpeg    # Imagem do logotipo
├── .env.example               # Exemplo das variáveis de ambiente Turso
├── .gitignore                 # Arquivos ignorados pelo Git
├── .vercelignore              # Arquivos ignorados no bundle da Vercel
├── db.js                      # Conexão Turso Cloud (@libsql/client) e inicialização das tabelas
├── package.json               # Dependências e scripts
├── README.md                  # Documentação completa
├── server.js                  # Servidor Express assíncrono com Turso e rotas da API
└── vercel.json                # Configuração de build e rotas da Vercel
```
