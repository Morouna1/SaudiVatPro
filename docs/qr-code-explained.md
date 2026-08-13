# ZATCA QR Code Fields Explained — TLV Tags

> Free guide from the [Saudi VAT Pro Knowledge Center](https://saudivat.pro/knowledge/qr-code-explained). Try the interactive [ZATCA QR Tool](https://saudivat.pro/zatca-qr/) to decode or generate QR codes live — or use the open-source [`zatca-qr-helpers`](../zatca-qr-helpers/) library in this repo.

Every ZATCA e-invoice QR code is a **base64-encoded TLV (Tag-Length-Value)** structure. Understanding it takes about five minutes.

## What is TLV?

Each field in the QR payload is encoded as three parts:

- **Tag** (1 byte) — which field this is (1 = seller name, 2 = VAT number, …)
- **Length** (1 byte) — how many bytes the value occupies (0–255)
- **Value** (N bytes) — the field content: UTF-8 text for tags 1–5, raw binary for tags 6–9

All fields are concatenated and the whole byte array is base64-encoded. That base64 string is what's rendered as the QR image on the invoice.

## The QR fields

| Tag | Field | Content | Example |
|---|---|---|---|
| `0x01` | Seller name | The seller's registered business name | Riyadh Gadgets Trading Co. |
| `0x02` | VAT registration number | 15 digits, starts with 3 | 310000000000006 |
| `0x03` | Invoice timestamp | ISO 8601 date-time | 2024-01-15T10:30:00Z |
| `0x04` | Invoice total (incl. VAT) | Decimal string | 1725.00 |
| `0x05` | VAT amount | Decimal string | 225.00 |
| `0x06` | Invoice hash | SHA-256 of the canonical invoice XML (binary) | *(Phase 2 only)* |
| `0x07` | Digital signature | ECDSA signature (binary) | *(Phase 2 only)* |
| `0x08` | Public key | Signer's ECDSA public key, DER-encoded | *(Phase 2 only)* |
| `0x09` | Certificate signature | ZATCA's signature over the signing certificate | *(Phase 2 simplified invoices)* |

**Phase 1** QR codes contain tags 1–5 only. **Phase 2** QR codes add the cryptographic tags 6–9, which let anyone verify the invoice was signed by a genuine, ZATCA-registered device.

## Tag 5 — VAT amount

The VAT amount must match the `TaxTotal` in the invoice XML exactly (2 decimal places). A mismatch between the QR and the XML is one of the most common clearance failures.

## Tags 6–9 — the cryptographic proof

Tag 6 is the SHA-256 hash of the exact canonical XML that was signed. Tag 7 is the ECDSA signature over that hash, produced with the private key belonging to the CSID certificate. Tag 8 lets a verifier check the signature without fetching the certificate; tag 9 proves the certificate itself was issued by ZATCA.

This is why you cannot "just regenerate" a QR code: the QR is bound to the signed XML byte-for-byte.

## Decode a QR yourself

Four ways, easiest first:

1. **[ZATCA QR Tool](https://saudivat.pro/zatca-qr/)** — paste the base64, see every field decoded and validated (free, no account).
2. **[`zatca-qr-helpers`](../zatca-qr-helpers/)** — the open-source TypeScript library in this repo (`decodeTlv`, `validateQr`).
3. Any QR scanner app gives you the base64 string; then decode it with option 1 or 2.
4. A few lines of Python:

```python
import base64

qr_b64 = "YOUR_QR_STRING_HERE"
raw = base64.b64decode(qr_b64)
i = 0
while i < len(raw):
    tag = raw[i]; length = raw[i+1]
    value = raw[i+2 : i+2+length]
    print(f"Tag {tag:02x}: {value.decode('utf-8', errors='replace')}")
    i += 2 + length
```

## Generate compliant QR codes automatically

[Saudi VAT Pro](https://saudivat.pro) generates signed Phase 2 invoices — QR code included — for every order in your store.

**[→ Start your 60-day free trial](https://saudivat.pro/signup)** — no credit card required.

---

**Related guides:** [ZATCA Phase 2 overview](./zatca-phase-2.md) · [Common ZATCA errors](./common-errors.md) · [Full Knowledge Center](https://saudivat.pro/knowledge)
