# Lany Infláveis — SPEC

Sistema de gestão para empresa de locação de brinquedos infláveis e atrações para
festas infantis. Interface integralmente em **pt-BR**, moeda **BRL**, datas `DD/MM/AAAA`.

## Stack real (ambiente)

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui (base-nova) |
| Backend | FastAPI async, todas as rotas em `api_router` sob `/api` |
| Banco | MongoDB via motor (ids `uuid4` string) |
| Pagamento | Mercado Pago **PIX exclusivamente** (sem cartão/boleto/outros gateways) |
| WhatsApp | Meta WhatsApp Cloud API + fallback `wa.me` |
| Auth | Sessão em cookie **httpOnly** (`lany_session`), PBKDF2-SHA256 |

> Desvio consciente do pedido original: o ambiente é FastAPI+MongoDB, não
> Next.js/Vercel/Firebase/Firestore. A arquitetura foi espelhada em camadas de
> serviço equivalentes (ver `README_LANY.md`), com o cliente ciente e de acordo.

## Modelo de dados (coleções MongoDB)

- `users` — id, name, email, password_hash, role (`admin|funcionario|cliente`), customer_id, active
- `sessions` — token, user_id, expires_at (índice TTL)
- `customers` — nome, CPF/CNPJ, phone/whatsapp em **E.164 +55**, endereço completo, notes
- `toys` — nome, categoria, foto, dimensões (width/length/height_m), capacity, age_range, daily_price, quantity, status (`disponivel|manutencao|inativo`)
- `reservations` — code `RES-*`, customer_id, items[{toy_id,toy_name,quantity,unit_price}], event_date `YYYY-MM-DD`, start_time/end_time `HH:MM`, subtotal/discount/delivery_fee/total, status, payment_id, contract_id
- `quotes` — number `ORC-*`, mesmos itens, status do ciclo comercial, reservation_id após conversão
- `payments` — reservation_id, amount, method `pix`, status (`pending|approved|expired|cancelled|refunded|rejected`), mp_payment_id, qr_code (BR Code), qr_code_base64, expires_at, simulation
- `contracts` — number `CT-*`, reservation_id (**único**), body, status (`pendente|aceito|cancelado`), accepted_at/accepted_by/accepted_ip/signature_name/version
- `financial_entries` — kind (`entrada|saida`), category, amount, date, reservation_id, payment_id
- `notifications`, `whatsapp_messages`, `audit_logs`, `webhook_events`, `settings`

## Status das reservas

`pre_reserva` → `aguardando_pagamento` → `confirmada` → `finalizada`
(desvios: `cancelada`, `expirada`)

Status que **bloqueiam** o slot do brinquedo: `pre_reserva`, `aguardando_pagamento`,
`confirmada`, `finalizada`.

## Fluxos-chave

1. **Disponibilidade / conflito** (`POST /api/reservations/availability`): valida no
   servidor por `toy_id` + `event_date` + sobreposição de `start_time`/`end_time`,
   comparando `booked + quantidade solicitada` contra `toy.quantity`. Reserva
   conflitante **ou acima do estoque restante** → **409**.
2. **PIX** (`POST /api/payments/pix`): valor sempre vem do total da reserva no servidor.
   Sem `MERCADOPAGO_ACCESS_TOKEN` o serviço entra em **modo simulação** e gera um BR Code
   EMV válido + QR PNG base64 localmente.
3. **Webhook** (`POST /api/webhooks/mercadopago`): valida HMAC-SHA256 quando há
   `MERCADOPAGO_WEBHOOK_SECRET`, deduplica por `event_key` em `webhook_events`, consulta
   o status oficial e então aprova. `approve_payment()` é o **único caminho de aprovação**
   e é idempotente: reserva → `confirmada`, lançamento financeiro (guardado por
   `payment_id`), contrato (índice único por reserva), notificação e WhatsApp (dedupe_key).
4. **Expiração**: `expire_stale_reservations()` roda nos caminhos de leitura — PIX vencido
   vira `expired`, reserva vira `expirada` e o brinquedo é liberado.
5. **Contrato**: gerado automaticamente após aprovação; aceite registra nome, data/hora,
   IP e versão, e move a reserva para `finalizada`.

## RBAC

- **admin**: acesso total (financeiro, relatórios, auditoria, configurações, usuários).
  Backend: `/financial/*`, `/reports/*` e `/audit/*` exigem `require_admin`.
- **funcionario**: dashboard, agenda, reservas, orçamentos, brinquedos, clientes, pagamentos, contratos, WhatsApp
- **cliente**: somente os próprios dados — `/cliente`; toda query de cliente é filtrada por
  `customer_id` no backend e acesso cruzado retorna **403**

## Manutenção

- `python seed.py` — dados de demonstração (idempotente)
- `python cleanup_orphans.py` — remove pagamentos/contratos/lançamentos/mensagens/notificações
  cujas reservas foram excluídas (lançamentos com `payment_id` são protegidos na API)

## Rotas do frontend

Públicas: `/`, `/brinquedos`, `/reservar`, `/pagamento/:id`, `/contrato/:id`, `/login`, `/cadastro`
Cliente: `/cliente`
Equipe: `/admin`, `/admin/agenda`, `/admin/reservas`, `/admin/orcamentos`, `/admin/brinquedos`,
`/admin/clientes`, `/admin/pagamentos`, `/admin/contratos`, `/admin/whatsapp`, `/admin/notificacoes`
Admin: `/admin/financeiro`, `/admin/relatorios`, `/admin/auditoria`, `/admin/configuracoes`

## Dados semeados (`cd /app/backend && python seed.py`, idempotente)

- Empresa: **Lany Infláveis**, Instagram **@lanyinflaveis**, chave PIX `contato@lanyinflaveis.com.br`
- 6 brinquedos: Futebol de Sabão (8×4m), Cama Elástica 3,05m (qtd 2), Tobogã Inflável 5m,
  Pula-Pula Castelo 3x3m (qtd 3), Piscina de Bolinhas (qtd 2), Carrinho Pipoca & Algodão Doce
  (status `manutencao`)
- 3 clientes: Mariana Alves Ribeiro, Condomínio Jardim das Acácias, Rafael Monteiro Dias
- 6 reservas `RES-DEMO-001..006` cobrindo confirmada, finalizada, aguardando_pagamento,
  pre_reserva e cancelada; pagamentos aprovados, contratos e lançamentos financeiros
  correspondentes; 5 despesas operacionais

Credenciais em `memory/test_credentials.md`.

## Variáveis de ambiente (`backend/.env`)

`MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `APP_URL`, `COOKIE_SECURE`,
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_ENVIRONMENT`,
`WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`

Todos os segredos permanecem no backend; nenhum token é devolvido ao navegador
(o painel mostra apenas um preview mascarado).
