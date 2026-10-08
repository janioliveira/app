# Credenciais de teste — Lany Infláveis

Semeadas por `cd /app/backend && python seed.py` (idempotente).
Senha única para todas as contas: `Lany@2026`

| Perfil | E-mail | Senha | Acesso |
|---|---|---|---|
| Administrador | `admin@lanyinflaveis.com.br` | `Lany@2026` | Tudo, inclusive financeiro, relatórios, auditoria e configurações |
| Funcionário | `equipe@lanyinflaveis.com.br` | `Lany@2026` | Dashboard, agenda, reservas, orçamentos, brinquedos, clientes, pagamentos, contratos, WhatsApp |
| Cliente | `cliente@exemplo.com.br` | `Lany@2026` | Apenas `/cliente` — somente os próprios dados (Mariana Alves Ribeiro) |

Login em `/login`. Após autenticar, o admin/funcionário cai em `/admin` e o cliente em `/cliente`.

## Notas para teste

- O fluxo público de reserva em `/reservar` **não exige login** — cria o cliente junto com a pré-reserva.
- Em `/pagamento/:id`, com o Mercado Pago em modo simulação, o botão
  `pix-simulate-button` ("Simular pagamento (demo)") dispara o mesmo caminho de
  aprovação do webhook real.
- Tentar abrir a reserva/contrato/pagamento de outro cliente logado como `cliente` deve
  retornar **403**.
- `/admin/financeiro`, `/admin/relatorios`, `/admin/auditoria` e `/admin/configuracoes`
  redirecionam o funcionário para `/admin` (são admin-only).
