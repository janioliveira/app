# Lany Infláveis — Sistema de Gestão de Locação de Brinquedos

Aplicação completa para administrar a locação de brinquedos infláveis e atrações
para festas infantis: catálogo, agenda com controle de conflito, orçamentos,
reservas, **pagamento exclusivamente por PIX via Mercado Pago**, contratos
digitais com aceite, financeiro, relatórios, notificações, integração WhatsApp,
auditoria e RBAC.

Empresa: **Lany Infláveis** — Instagram [@lanyinflaveis](https://instagram.com/lanyinflaveis)

---

## 1. Nota importante sobre a arquitetura

O pedido original especificava **Next.js + Vercel + Firebase/Firestore**. Este
ambiente de execução provê um stack fixo e já instrumentado:

```text
React 19 + TypeScript + Tailwind v4   (frontend, porta 3000)
            ↓  /api  (proxy)
FastAPI async + Pydantic v2           (backend, porta 8001)
            ↓
MongoDB (motor)
```

A aplicação foi construída **neste stack**, com a mesma separação de camadas
exigida no pedido, de modo que a migração para Next.js/Firebase seja um porte de
adaptadores — e não uma reescrita. Equivalências:

| Pedido | Implementado aqui | Porte |
|---|---|---|
| Next.js Route Handlers | `backend/routers/*.py` (um `APIRouter` por recurso) | 1 rota ⇢ 1 Route Handler |
| Firebase Auth | `backend/lib/auth.py` — sessão httpOnly + PBKDF2 + RBAC | trocar por `signInWithEmailAndPassword` + custom claims |
| Firestore | `backend/lib/db.py` (motor) — coleções já nomeadas como no pedido | trocar o handle por `firebase-admin` |
| Firestore Security Rules | RBAC server-side em `require_roles()` + filtro por `customer_id` | regras `.rules` espelhando as mesmas condições |
| Firebase Storage | campo `image_url`/`logo_url` por URL | trocar por upload assinado |
| Vercel Env Vars | `backend/.env` lido via `os.environ` | mesmas chaves no painel da Vercel |

As coleções (`users`, `customers`, `toys`, `reservations`, `quotes`, `payments`,
`contracts`, `financialEntries` → `financial_entries`, `notifications`,
`whatsappMessages` → `whatsapp_messages`, `auditLogs` → `audit_logs`, `settings`)
seguem a nomenclatura pedida, facilitando o porte direto para o Firestore.

---

## 2. Requisitos

- Python 3.11+ (venv do pod já configurada; `python` resolve para ela)
- Node 24 + Yarn
- MongoDB em execução (no pod roda como serviço `mongodb`)

## 3. Instalação e desenvolvimento

```bash
# backend
cd backend
python -m pip install -r requirements.txt
python seed.py                 # dados de demonstração (idempotente)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# frontend
cd frontend
yarn install
yarn dev                       # http://localhost:3000
```

No pod, tudo roda sob supervisor:

```bash
sudo supervisorctl restart frontend backend
```

## 4. Variáveis de ambiente

Copie `.env.example` para `backend/.env` e preencha. **Nunca** versione `.env`.

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=app
CORS_ORIGINS=*
APP_URL=https://seu-dominio
COOKIE_SECURE=true

# Mercado Pago — somente backend
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_ENVIRONMENT=sandbox

# WhatsApp Cloud API — somente backend
WHATSAPP_PROVIDER=meta_cloud_api
WHATSAPP_API_URL=https://graph.facebook.com/v23.0
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
```

Regra absoluta: **nenhum segredo é exposto ao navegador**. O painel de
configurações devolve apenas um preview mascarado (`APP_US••••1234`).

## 5. Autenticação e RBAC

- Sessão em cookie **httpOnly** `lany_session` (7 dias, TTL no Mongo), senha com
  PBKDF2-SHA256 (120k iterações).
- Rotas: `POST /api/auth/login`, `/register`, `/logout`, `GET /api/auth/me`,
  `POST /api/auth/password-reset` (+ `/confirm`).
- Perfis: **admin** (total), **funcionario** (operação), **cliente** (apenas os
  próprios dados). Toda consulta de cliente é filtrada por `customer_id` no
  servidor; acesso cruzado responde **403**.

## 6. Mercado Pago — PIX

```text
Reserva → pré-reserva → POST /api/payments/pix → QR Code + copia e cola
   → cliente paga → webhook → validação → Firestore/Mongo
   → pagamento aprovado → reserva confirmada → contrato → WhatsApp
```

`services/mercadopago_service.py` (`MercadoPagoService`):

- `create_pix_charge()` — `POST /v1/payments` com `payment_method_id: "pix"` e
  `X-Idempotency-Key`
- `get_payment()` / `cancel_payment()` / `refund_payment()`
- `validate_signature()` — HMAC-SHA256 sobre `id:<data.id>;request-id:<id>;ts:<ts>;`

**Modo simulação**: sem `MERCADOPAGO_ACCESS_TOKEN`, o serviço gera um BR Code EMV
válido (com CRC16) e o QR PNG localmente, permitindo exercitar todo o fluxo —
inclusive expiração e idempotência. O valor cobrado **sempre** vem do total da
reserva calculado no servidor, nunca do cliente.

### Webhook

`POST /api/webhooks/mercadopago` executa, em ordem: recebe → valida assinatura →
identifica o pagamento → consulta o status oficial no Mercado Pago → atualiza o
pagamento → atualiza a reserva → cria o lançamento financeiro → gera a
notificação → registra a auditoria.

**Idempotência em três camadas**: `webhook_events.event_key` (único),
`approve_payment()` retorna cedo se já aprovado, e índices únicos em
`contracts.reservation_id` + guarda por `payment_id` no financeiro. Um webhook
duplicado nunca duplica pagamento, reserva, lançamento, notificação ou contrato.

## 7. WhatsApp

`services/whatsapp_service.py` (`WhatsAppService`): envia pela Meta Cloud API
(`POST /{PHONE_NUMBER_ID}/messages`), normaliza o telefone para **E.164 +55**,
registra cada tentativa em `whatsapp_messages` com status
`pendente|enviando|enviado|entregue|lido|falhou|cancelado`, e expõe
`POST/GET /api/webhooks/whatsapp` para os recibos de entrega (dedupe por `wamid`).

Sem Access Token, a mensagem é registrada como **pendente** com um link `wa.me`
pronto para envio manual — nada é perdido. Templates editáveis em
**Configurações → WhatsApp**: nova reserva, PIX gerado, pagamento confirmado,
pagamento expirado, contrato, lembrete do evento e cancelamento
(variáveis `{NOME}`, `{DATA}`, `{HORARIO}`).

## 8. Agenda e conflitos

`services/reservation_service.check_availability()` é a autoridade: para cada
`toy_id`, soma as quantidades já reservadas no mesmo `event_date` com sobreposição
de faixa horária (`start_a < end_b && start_b < end_a`) entre reservas em estado
bloqueante, e compara com `toy.quantity`. Conflito ⇒ **409** antes de qualquer
confirmação.

`expire_stale_reservations()` roda nos caminhos de leitura: PIX vencido vira
`expired`, a reserva vira `expirada` e o brinquedo volta à agenda.

## 9. Contratos

Gerados automaticamente após a aprovação do PIX
(`services/contract_service.generate_for_reservation()`, idempotente) com dados da
empresa e do cliente, data, horário, local, equipamentos, valores e cláusulas
brasileiras de locação (responsabilidades, danos, segurança, clima, cancelamento,
reagendamento). O aceite registra **nome, data, hora, IP, versão e id da reserva**
e move a reserva para `finalizada`. PDF via impressão do navegador
(`window.print()`), com `@media print` dedicado. A arquitetura isola o aceite num
único endpoint, pronto para plugar ZapSign/Clicksign no futuro.

## 10. Relatórios

`GET /api/reports/{tipo}` e `GET /api/reports/{tipo}/export.csv` (CSV com BOM,
separador `;` — abre direto no Excel pt-BR). Tipos: reservas, faturamento,
clientes, brinquedos, pagamentos, contratos, cancelamentos, whatsapp. PDF pela
impressão da tela de relatórios.

## 11. Segurança

- Sessão httpOnly, sem token no frontend e sem `localStorage`
- RBAC em todas as rotas (`require_staff`, `require_admin`) + isolamento por `customer_id`
- Validação automática de payload pelo Pydantic v2 (**422** antes do handler)
- Validação HMAC do webhook + idempotência por `event_key`
- Preço e total sempre recalculados no servidor
- Auditoria (`audit_logs`) com usuário, ação, entidade, detalhes e IP
- Segredos apenas em variáveis de ambiente, mascarados no painel

## 12. Git / GitHub / Vercel

```text
Código → Git → GitHub → Vercel → Aplicação online
```

```bash
git init
git add .
git commit -m "feat: sistema de gestão Lany Infláveis"
git remote add origin git@github.com:<usuario>/lanyinflaveis.git
git push -u origin main
```

Commits sugeridos: `feat: adiciona módulo de reservas`,
`feat: integra Mercado Pago PIX`, `feat: adiciona integração WhatsApp`,
`fix: corrige conflito de reservas`, `fix: corrige webhook Mercado Pago`.

`.gitignore` já cobre `.env*`, `node_modules`, `.next`, `__pycache__` e `dist`.
Nunca comite `.env`, tokens, senhas ou credenciais — use **Vercel Environment
Variables** nos três ambientes (Development, Preview, Production) e configure o
webhook do Mercado Pago apontando para `https://<dominio>/api/webhooks/mercadopago`.

## 13. Dados de demonstração

```bash
cd /app/backend && python seed.py
```

Cria a empresa Lany Infláveis, 6 brinquedos (Futebol de Sabão 8×4m, Cama Elástica
3,05m, Tobogã Inflável 5m, Pula-Pula Castelo 3x3m, Piscina de Bolinhas, Carrinho
Pipoca & Algodão Doce), 3 clientes, 6 reservas em estados variados com pagamentos,
contratos e lançamentos financeiros, e 5 despesas. Os registros são marcados com
`is_demo: true` / código `RES-DEMO-*`.

**Credenciais** (senha `Lany@2026`):

| Perfil | E-mail |
|---|---|
| Administrador | `admin@lanyinflaveis.com.br` |
| Funcionário | `equipe@lanyinflaveis.com.br` |
| Cliente | `cliente@exemplo.com.br` |

## 14. Testes

```bash
cd /app/backend && pytest        # backend (pytest + httpx contra o uvicorn ativo)
cd /app/frontend && yarn typecheck   # fronteira Pydantic ↔ TypeScript
```

Cobertura pretendida dos fluxos: login, cadastro, cliente, brinquedo,
disponibilidade, conflito de reservas, orçamento, reserva, geração de PIX,
webhook, idempotência, confirmação de pagamento, contrato, financeiro, WhatsApp e
permissões — inclusive os casos de erro (pagamento/webhook duplicado, reserva
conflitante, PIX expirado, usuário sem permissão, cliente acessando dados de
outro cliente).
