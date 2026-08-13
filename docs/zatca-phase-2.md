# ZATCA Phase 2 E-Invoicing Overview — Saudi Arabia

> Free guide from the [Saudi VAT Pro Knowledge Center](https://saudivat.pro/knowledge/zatca-phase-2). The platform at [saudivat.pro](https://saudivat.pro) automates everything described here.

ZATCA (Zakat, Tax and Customs Authority) Phase 2 — also called the **Integration Phase** or **Fatoora** — requires VAT-registered businesses in Saudi Arabia to generate, cryptographically sign, and submit e-invoices directly to ZATCA's systems. It builds on Phase 1 (the Generation Phase, mandatory since December 2021) and is being rolled out in waves based on annual revenue.

## Phase 1 vs Phase 2 at a glance

| Requirement | Phase 1 (Generation) | Phase 2 (Integration) |
|---|---|---|
| Invoice format | Any structured electronic format | UBL 2.1 XML per ZATCA schema |
| Submission to ZATCA | Not required | Required — real-time API integration |
| Digital signature | Not required | Required — ECDSA signature with CSID certificate |
| QR code | Basic 5-field TLV QR (B2C) | Extended QR with cryptographic tags 6–9 |
| Invoice chaining | Not required | Required — hash chain (PIH) + invoice counter (ICV) |
| B2B (Standard) invoices | Generated locally | **Cleared** by ZATCA before delivery to the buyer |
| B2C (Simplified) invoices | Generated locally | **Reported** to ZATCA within 24 hours |

## Who is affected?

All VAT-registered businesses in Saudi Arabia. ZATCA notifies each business of its wave and integration deadline (waves are grouped by annual taxable revenue, starting with the largest). Once your wave date passes, non-integrated invoices are non-compliant and subject to penalties.

## The Clearance flow (B2B — Standard invoices)

1. Your system generates a UBL 2.1 XML invoice.
2. The invoice is signed with your CSID certificate.
3. It is submitted to ZATCA's Clearance API **before** you give it to the buyer.
4. ZATCA validates it against 200+ business rules (the BR-KSA rule set).
5. ZATCA applies its own cryptographic stamp and returns the cleared invoice.
6. Only the **cleared** invoice is legally valid to send to your buyer.

If clearance fails, you get a BR-KSA error code — see [common ZATCA errors](./common-errors.md) for the most frequent ones and fixes.

## The Reporting flow (B2C — Simplified invoices)

1. Your system generates, signs, and gives the invoice (with QR code) to the customer immediately.
2. The signed invoice is reported to ZATCA's Reporting API **within 24 hours**.
3. ZATCA acknowledges receipt; warnings or errors appear in the response.

## CSID — your signing certificate

To sign invoices you need a **Cryptographic Stamp Identifier (CSID)**. Onboarding happens in two steps:

- **Compliance CSID (CCSID)** — a temporary certificate used to pass ZATCA's compliance checks (you must submit sample invoices of each type you plan to issue).
- **Production CSID (PCSID)** — the real certificate, issued after compliance checks pass, used to sign live invoices.

You can issue a CSID in about 5 minutes with the free [Saudi VAT Pro CSID Wizard](https://saudivat.pro/tools/csid) — no account required.

## Invoice chaining: ICV and PIH

Every Phase 2 invoice must carry:

- **ICV (Invoice Counter Value)** — a strictly increasing counter, unique per device/solution unit.
- **PIH (Previous Invoice Hash)** — the SHA-256 hash of the previous invoice's XML, creating a tamper-evident chain.

If the chain breaks (wrong PIH, reused ICV), submissions get rejected — and the fix must preserve chain integrity, which is one of the trickiest parts of self-built integrations.

## The easy way

[Saudi VAT Pro](https://saudivat.pro) handles all of the above automatically: CSID onboarding, XML generation, signing, chaining, clearance, reporting, and credit notes — for WooCommerce, Shopify, or any store via REST API.

**[→ Start your 60-day free trial](https://saudivat.pro/signup)** — no credit card required.

---

**Related guides:** [QR code explained](./qr-code-explained.md) · [Common ZATCA errors](./common-errors.md) · [Full Knowledge Center](https://saudivat.pro/knowledge)
