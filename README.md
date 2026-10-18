# Easypanel Control

Painel Next.js para observar e operar toda a API do Easypanel por um gateway seguro no servidor.

## Iniciar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000`. Use o modo demonstração ou conecte sua instância Easypanel pelo botão **Conectar servidor**. O token é criptografado no servidor e guardado somente em cookie HTTP-only.

## Docker (produção)

O `Dockerfile` cria somente a aplicação. O PostgreSQL continua externo: informe a URL do banco já existente por `DATABASE_URL` no ambiente do servidor.

```bash
docker build -t orbit-panel .
docker run -d --name orbit-panel --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  orbit-panel
```

Preencha no `.env` de produção ao menos `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `EASYPANEL_URL` e `EASYPANEL_API_KEY`. A imagem não inicia PostgreSQL: no início de cada container ela executa `prisma migrate deploy` contra o banco externo e, só então, inicia o painel.

## Atualizar o catálogo da API

```bash
npm run sync:api
```

O comando lê a especificação OpenAPI publicada na documentação oficial e regenera `src/data/endpoints.json`.

## Funcionalidades operacionais

- Dashboard alimentado por projetos, serviços e ações da instância conectada
- Criação e exclusão confirmada de projetos
- Listagem, busca e filtro de serviços
- Start, stop, restart e deploy conforme o tipo do serviço
- Gerenciamento de aplicações, Compose, Box, WordPress, PostgreSQL, MySQL, MariaDB, MongoDB e Redis
- Consoles dedicados para domínios, backups e métricas
- Explorador com todas as 375 operações oficiais e formulários gerados pelos schemas

## Segurança

- Defina `SESSION_SECRET` com pelo menos 32 caracteres em produção.
- Execute atrás de HTTPS.
- Ações destrutivas exigem confirmação explícita na interface.
- Nunca prefixe `EASYPANEL_TOKEN` com `NEXT_PUBLIC_`.
