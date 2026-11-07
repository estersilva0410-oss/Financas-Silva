# 🏛️ FINANÇAS SILVA - Controle Financeiro Multi-usuário

Aplicativo web completo, moderno e seguro para controle financeiro pessoal e familiar, desenvolvido em **Node.js**, **Express**, **SQLite** e criptografia **bcryptjs**, pronto para execução local ou **deploy na Vercel**.

---

## 🌟 Recursos do Sistema

1. **Dark Mode Minimalista**:
   - Paleta em tons de grafite escuro (`#0F172A`) e cartões em cinza escuro (`#1E293B`) com cantos arredondados de `16px`.
   - Logotipo em destaque no cabeçalho (~75px) e marca d'água suave no fundo.
2. **Autenticação Segura & Multi-usuário**:
   - Cadastro e Login com e-mail e senha.
   - Criptografia com `bcryptjs` (salt de 10 rounds).
   - Gerenciamento de sessão com `express-session` e cookies seguros.
   - **Isolamento Total**: cada usuário acessa, cria, edita e exclui exclusivamente os seus próprios lançamentos.
3. **Banco de Dados SQLite**:
   - Arquivo persistente local `data/financas_silva.db` e sincronização automática com `/tmp` na Vercel.
   - Chave estrangeira (`user_id`) e integridade relacional.
4. **Dashboard e Relatórios**:
   - Saldo atual, receitas, despesas e taxa de economia.
   - Gráficos de rosca (despesas por categoria) e barras (mensal) via Chart.js.
   - Filtros rápidos por tipo (Todas, Receitas, Despesas), busca textual, categoria, mês e ordenação.
   - Exportação de extrato em planilha CSV formatada.

---

## 🚀 Como Fazer o Deploy na Vercel

O projeto já está **100% configurado** para a Vercel com os arquivos [`vercel.json`](file:///c:/Users/Rebeca%20e%20Ester/OneDrive/Anexos/ERJ%20DEVS/vercel.json), [`api/index.js`](file:///c:/Users/Rebeca%20e%20Ester/OneDrive/Anexos/ERJ%20DEVS/api/index.js) e `.vercelignore`.

### Opção 1: Via GitHub (Recomendado)
1. Crie um repositório no seu GitHub (ex: `financas-silva`) e suba os arquivos do projeto:
   ```bash
   git init
   git add .
   git commit -m "feat: FINANCAS SILVA pronto para Vercel"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/financas-silva.git
   git push -u origin main
   ```
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New..." > "Project"**.
3. Selecione o repositório que você acabou de subir.
4. Clique em **"Deploy"**. A Vercel detectará automaticamente a configuração do `vercel.json` e o runtime Node.js 22.

### Opção 2: Via Vercel CLI (Direto do Terminal)
1. No terminal do projeto, execute:
   ```bash
   npx vercel
   ```
2. Siga as instruções no terminal (faça login na sua conta Vercel e confirme os prompts padrão pressionando `Enter`).
3. Ao finalizar, o link do seu aplicativo no ar será gerado imediatamente!

---

## 💻 Como Rodar Localmente

### Pré-requisitos
- Node.js 22 ou superior instalado.

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
├── data/
│   └── financas_silva.db      # Banco de dados SQLite inicial
├── public/
│   ├── css/
│   │   └── styles.css         # Dark Mode minimalista e marca d'água
│   ├── js/
│   │   └── app.js             # Lógica cliente (sessão, CRUD, filtros, gráficos)
│   ├── index.html             # Interface responsiva
│   └── logo fiunanças.jpeg    # Imagem do logotipo
├── .gitignore                 # Arquivos ignorados pelo Git
├── .vercelignore              # Arquivos ignorados no bundle da Vercel
├── db.js                      # Conexão SQLite (com suporte a /tmp na Vercel)
├── package.json               # Dependências e especificação Node >=22.x
├── server.js                  # Servidor Express e rotas da API
├── vercel.json                # Configuração de build e rotas da Vercel
└── README.md                  # Documentação completa
```
