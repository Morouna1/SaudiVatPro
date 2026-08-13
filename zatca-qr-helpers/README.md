# saudivatpro-qrtool

Free TypeScript utilities for encoding, decoding, and validating **ZATCA Phase 1 & 2 QR codes** (TLV base64 format).

Works in **browsers** (uses `TextEncoder` / `atob` / `btoa`) and **Node.js 18+** (no native `Buffer` dependency).

Part of the [Saudi VAT Pro](https://saudivat.pro) free developer toolkit.

---

## Install

```bash
npm install saudivatpro-qrtool
# or
pnpm add saudivatpro-qrtool
```

---

## Quick start

```ts
import { encodeTlvPhaseOne, decodeTlv, validateQr } from 'saudivatpro-qrtool';

// Generate a Phase 1 QR base64 string
const qr = encodeTlvPhaseOne({
  sellerName: 'شركة المثال التجارية',
  vatNumber: '300075588700003',
  timestamp: '2024-11-20T12:30:00Z',
  invoiceTotal: '115.00',
  vatAmount: '15.00',
});
console.log(qr); // base64 string ready for QR rendering

// Decode any ZATCA QR (Phase 1 or 2)
const parsed = decodeTlv(qr);
console.log(parsed.phase);       // 1 or 2
console.log(parsed.sellerName);  // "شركة المثال التجارية"
console.log(parsed.vatNumber);   // "300075588700003"
console.log(parsed.fields);      // ParsedField[] with all tags

// Validate
const result = validateQr(qr);
console.log(result.valid);   // true
console.log(result.errors);  // []
```

---

## API

### `encodeTlvPhaseOne(fields: PhaseOneFields): string`

Encodes Phase 1 invoice fields into a ZATCA-compliant TLV base64 QR string.

```ts
interface PhaseOneFields {
  sellerName: string;    // Tag 1: Seller name (UTF-8)
  vatNumber: string;     // Tag 2: 15-digit VAT registration number
  timestamp: string;     // Tag 3: ISO 8601 invoice timestamp
  invoiceTotal: string;  // Tag 4: Invoice total incl. VAT (e.g. "115.00")
  vatAmount: string;     // Tag 5: VAT amount (e.g. "15.00")
}
```

### `decodeTlv(base64: string): ParsedQR`

Decodes any ZATCA TLV base64 QR string (Phase 1 or Phase 2).

```ts
interface ParsedQR {
  phase: 1 | 2;               // Detected from presence of tags 6–9
  fields: ParsedField[];      // All decoded fields
  byTag: Record<number, string>; // Raw value by tag number
  sellerName?: string;         // Tag 1
  vatNumber?: string;          // Tag 2
  timestamp?: string;          // Tag 3
  invoiceTotal?: string;       // Tag 4
  vatAmount?: string;          // Tag 5
  invoiceHash?: string;        // Tag 6 (Phase 2, base64)
  digitalSignature?: string;   // Tag 7 (Phase 2, base64)
  publicKey?: string;          // Tag 8 (Phase 2, base64)
  certSignature?: string;      // Tag 9 (Phase 2, base64)
}
```

### `validateQr(base64: string): ValidationResult`

Validates a ZATCA Phase 1 QR string.

```ts
interface ValidationResult {
  valid: boolean;
  phase: 1 | 2;
  errors: string[];  // Human-readable error messages
}
```

Checks performed:
- All 5 required tags (1–5) are present
- Tag 2 (VAT number) is exactly 15 digits and starts with `"3"`
- Tag 3 (timestamp) is valid ISO 8601
- Tag 4 (invoice total) is a positive non-zero decimal
- Tag 5 (VAT amount) is non-negative and ≤ invoice total
- Tag 1 (seller name) is non-empty

---

## ZATCA TLV format reference

| Tag | Field                   | Phase |
|-----|------------------------|-------|
|  1  | Seller name            |   1   |
|  2  | VAT registration no.   |   1   |
|  3  | Invoice timestamp      |   1   |
|  4  | Invoice total w/VAT    |   1   |
|  5  | VAT amount             |   1   |
|  6  | Invoice hash           |   2   |
|  7  | ECDSA digital signature|   2   |
|  8  | Signer public key      |   2   |
|  9  | Certificate signature  |   2   |

---

## License

MIT © [Saudi VAT Pro](https://saudivat.pro)
