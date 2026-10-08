"""ContractService — automatic generation after PIX approval + digital acceptance."""

from datetime import datetime, timezone
from typing import Any

from lib.db import db
from models.schemas import Contract
from services.settings_service import get_company

DEFAULT_TERMS = """1. OBJETO: A LOCADORA cede em locação ao LOCATÁRIO os equipamentos descritos neste
contrato, para uso exclusivo no endereço, data e horário indicados.

2. ENTREGA E RETIRADA: A entrega, montagem e desmontagem dos equipamentos são de
responsabilidade da LOCADORA. O LOCATÁRIO deve garantir local plano, limpo, com acesso
adequado e ponto de energia elétrica (110v/220v) a no máximo 20 metros do local de montagem.

3. RESPONSABILIDADES DO LOCATÁRIO: Manter supervisão permanente de adulto responsável
durante todo o uso dos brinquedos; respeitar a capacidade máxima e a faixa etária indicadas;
proibir o uso de calçados, objetos cortantes, alimentos, bebidas e animais sobre os
equipamentos; não permitir o uso por pessoas sob efeito de álcool.

4. DANOS: O LOCATÁRIO responde por danos causados aos equipamentos por uso indevido,
vandalismo, furto ou negligência, obrigando-se ao ressarcimento integral do reparo ou
reposição.

5. SEGURANÇA: Em caso de ventos fortes, chuva, tempestade ou qualquer risco à integridade
física dos usuários, os equipamentos devem ser imediatamente desligados e desocupados.

6. CONDIÇÕES CLIMÁTICAS: Em caso de chuva, o evento poderá ser reagendado uma única vez,
sem custo adicional, mediante comunicação com antecedência mínima de 12 horas, conforme
disponibilidade de agenda.

7. CANCELAMENTO: Cancelamentos com mais de 7 (sete) dias de antecedência geram crédito
integral para uso futuro. Cancelamentos com menos de 48 horas de antecedência implicam
retenção de 50% do valor pago, a título de reserva de agenda e logística.

8. REAGENDAMENTO: Permitido mediante disponibilidade de agenda, com solicitação registrada
no sistema.

9. PAGAMENTO: O pagamento é realizado exclusivamente via PIX, processado pelo Mercado Pago.
A reserva é confirmada somente após a aprovação automática do pagamento.

10. ACEITE: O aceite eletrônico deste instrumento, com registro de data, hora, identificação
do usuário e endereço IP, tem plena validade jurídica nos termos do art. 10, §2º da MP
2.200-2/2001."""


def _fmt_money(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(iso: str) -> str:
    try:
        y, m, d = iso.split("-")
        return f"{d}/{m}/{y}"
    except Exception:
        return iso


async def build_contract_body(reservation: dict[str, Any], customer: dict[str, Any]) -> str:
    company = await get_company()
    terms = company.contract_terms or DEFAULT_TERMS
    items = "\n".join(
        f"  • {i.get('toy_name', '')} — {i.get('quantity', 1)}x — {_fmt_money(i.get('unit_price', 0))}"
        for i in reservation.get("items", [])
    )
    address = ", ".join(
        p for p in [reservation.get("address", ""), reservation.get("district", ""), reservation.get("city", "")] if p
    )
    customer_address = ", ".join(
        p
        for p in [
            customer.get("street", ""),
            customer.get("number", ""),
            customer.get("district", ""),
            customer.get("city", ""),
            customer.get("state", ""),
        ]
        if p
    )
    return f"""CONTRATO DE LOCAÇÃO DE BRINQUEDOS E EQUIPAMENTOS PARA EVENTOS

LOCADORA
Nome: {company.trade_name or company.name}
Razão social: {company.legal_name or company.name}
CNPJ: {company.document or 'não informado'}
Telefone/WhatsApp: {company.whatsapp or company.phone or 'não informado'}
E-mail: {company.email or 'não informado'}
Instagram: {company.instagram}
Endereço: {', '.join(p for p in [company.address, company.city, company.state] if p) or 'não informado'}

LOCATÁRIO
Nome: {customer.get('name', '')}
CPF/CNPJ: {customer.get('document') or 'não informado'}
Telefone/WhatsApp: {customer.get('whatsapp') or customer.get('phone') or 'não informado'}
E-mail: {customer.get('email') or 'não informado'}
Endereço: {customer_address or 'não informado'}

DADOS DO EVENTO
Reserva: {reservation.get('code', '')}
Data: {_fmt_date(reservation.get('event_date', ''))}
Horário: {reservation.get('start_time', '')} às {reservation.get('end_time', '')}
Local de instalação: {address or 'não informado'}

EQUIPAMENTOS LOCADOS
{items or '  • nenhum item'}

VALORES
Subtotal: {_fmt_money(reservation.get('subtotal', 0))}
Desconto: {_fmt_money(reservation.get('discount', 0))}
Taxa de deslocamento: {_fmt_money(reservation.get('delivery_fee', 0))}
TOTAL: {_fmt_money(reservation.get('total', 0))}
Forma de pagamento: PIX (Mercado Pago) — pagamento aprovado

CLÁUSULAS E CONDIÇÕES
{terms}
"""


async def generate_for_reservation(
    reservation: dict[str, Any], customer: dict[str, Any]
) -> dict[str, Any]:
    """Idempotent: one contract per reservation (enforced by a unique index too)."""
    existing = await db["contracts"].find_one({"reservation_id": reservation["id"]}, {"_id": 0})
    if existing:
        return existing

    count = await db["contracts"].count_documents({})
    contract = Contract(
        reservation_id=reservation["id"],
        customer_id=reservation["customer_id"],
        number=f"CT-{datetime.now(timezone.utc).year}-{count + 1:04d}",
        body=await build_contract_body(reservation, customer),
        status="pendente",
    )
    doc = contract.model_dump()
    await db["contracts"].insert_one(dict(doc))
    await db["reservations"].update_one(
        {"id": reservation["id"]}, {"$set": {"contract_id": contract.id}}
    )
    doc.pop("_id", None)
    return doc
