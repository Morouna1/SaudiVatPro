/**
 * saudivatpro-qrtool
 * Free utilities for ZATCA Phase 1 & 2 QR code encoding, decoding, and validation.
 * Browser-safe (TextEncoder/atob/btoa) and Node.js 18+ compatible.
 *
 * ZATCA TLV format per field:
 *   1 byte  tag
 *   1 byte  length (0–255 bytes)
 *   N bytes value (UTF-8 for text tags; raw bytes for binary tags 6–9)
 *
 * Phase 1 tags (invoice QR):
 *   1 = Seller name
 *   2 = VAT registration number (15-digit string, starts with "3")
 *   3 = Invoice timestamp (ISO 8601)
 *   4 = Invoice total incl. VAT (decimal string)
 *   5 = VAT amount (decimal string)
 *
 * Phase 2 adds cryptographic tags:
 *   6 = Invoice hash (base64-encoded SHA-256 of canonical XML)
 *   7 = ECDSA digital signature (base64)
 *   8 = Signer public key (DER-encoded ECDSA public key)
 *   9 = Signing certificate signature (ECDSA)
 */

export interface PhaseOneFields {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  invoiceTotal: string;
  vatAmount: string;
}

export interface ParsedField {
  tag: number;
  label: string;
  rawValue: string;
  isBinary: boolean;
}

export interface ParsedQR {
  phase: 1 | 2;
  fields: ParsedField[];
  byTag: Record<number, string>;
  sellerName?: string;
  vatNumber?: string;
  timestamp?: string;
  invoiceTotal?: string;
  vatAmount?: string;
  invoiceHash?: string;
  digitalSignature?: string;
  publicKey?: string;
  certSignature?: string;
}

export interface ValidationResult {
  valid: boolean;
  phase: 1 | 2;
  errors: string[];
}

const BINARY_TAGS = new Set([6, 7, 8, 9]);

export const TAG_LABELS: Record<number, string> = {
  1: "Seller Name",
  2: "VAT Registration Number",
  3: "Invoice Timestamp",
  4: "Invoice Total (incl. VAT)",
  5: "VAT Amount",
  6: "Invoice Hash",
  7: "Digital Signature",
  8: "Public Key",
  9: "Certificate Signature",
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64.trim());
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function buildField(tag: number, value: string): Uint8Array {
  const v = new TextEncoder().encode(value);
  if (v.length > 255) throw new Error(`Tag ${tag} value too long (${v.length} bytes, max 255)`);
  const out = new Uint8Array(2 + v.length);
  out[0] = tag;
  out[1] = v.length;
  out.set(v, 2);
  return out;
}

/**
 * Encode Phase 1 invoice fields into a ZATCA-compliant TLV base64 QR string.
 */
export function encodeTlvPhaseOne(fields: PhaseOneFields): string {
  const parts = [
    buildField(1, fields.sellerName),
    buildField(2, fields.vatNumber),
    buildField(3, fields.timestamp),
    buildField(4, fields.invoiceTotal),
    buildField(5, fields.vatAmount),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return toBase64(out);
}

/**
 * Decode a ZATCA TLV base64 QR string.
 * Returns structured ParsedQR with phase detection and named fields.
 * Binary tags (6–9) are returned as their base64 representation.
 */
export function decodeTlv(base64: string): ParsedQR {
  const bytes = fromBase64(base64);
  const fields: ParsedField[] = [];
  const byTag: Record<number, string> = {};
  let i = 0;

  while (i < bytes.length) {
    if (i + 1 >= bytes.length) break;
    const tag = bytes[i]!;
    const len = bytes[i + 1]!;
    i += 2;
    if (i + len > bytes.length) {
      throw new Error(`Truncated TLV at tag ${tag}: expected ${len} bytes, only ${bytes.length - i} remain`);
    }
    const chunk = bytes.slice(i, i + len);
    const isBinary = BINARY_TAGS.has(tag);
    const rawValue = isBinary ? toBase64(chunk) : new TextDecoder().decode(chunk);
    fields.push({ tag, label: TAG_LABELS[tag] ?? `Unknown Tag ${tag}`, rawValue, isBinary });
    byTag[tag] = rawValue;
    i += len;
  }

  const hasPhase2Tags = fields.some((f) => f.tag >= 6);
  const phase: 1 | 2 = hasPhase2Tags ? 2 : 1;

  return {
    phase,
    fields,
    byTag,
    sellerName: byTag[1],
    vatNumber: byTag[2],
    timestamp: byTag[3],
    invoiceTotal: byTag[4],
    vatAmount: byTag[5],
    invoiceHash: byTag[6],
    digitalSignature: byTag[7],
    publicKey: byTag[8],
    certSignature: byTag[9],
  };
}

/**
 * Validate a ZATCA TLV base64 QR string.
 * Checks structure, required tags (1–5 for Phase 1), VAT number format,
 * positive non-zero amounts, and timestamp parseability.
 */
export function validateQr(base64: string): ValidationResult {
  const errors: string[] = [];
  let parsed: ParsedQR;
  try {
    parsed = decodeTlv(base64);
  } catch (e) {
    return { valid: false, phase: 1, errors: [`Decode error: ${(e as Error).message}`] };
  }

  const { byTag, phase } = parsed;

  for (let t = 1; t <= 5; t++) {
    if (!(t in byTag)) errors.push(`Missing required tag ${t} (${TAG_LABELS[t]})`);
  }

  const vatNum = byTag[2];
  if (vatNum !== undefined) {
    if (!/^\d{15}$/.test(vatNum)) {
      errors.push(`Tag 2: VAT number must be exactly 15 digits; got "${vatNum}"`);
    } else if (!vatNum.startsWith("3")) {
      errors.push(`Tag 2: VAT number must start with "3"; got "${vatNum}"`);
    }
  }

  const ts = byTag[3];
  if (ts !== undefined && isNaN(Date.parse(ts))) {
    errors.push(`Tag 3: timestamp is not valid ISO 8601; got "${ts}"`);
  }

  const total = byTag[4];
  const vat = byTag[5];

  if (total !== undefined) {
    if (!/^\d+(\.\d+)?$/.test(total)) {
      errors.push(`Tag 4: invoice total must be a positive decimal number; got "${total}"`);
    } else if (parseFloat(total) <= 0) {
      errors.push(`Tag 4: invoice total must be greater than zero; got "${total}"`);
    }
  }
  if (vat !== undefined) {
    if (!/^\d+(\.\d+)?$/.test(vat)) {
      errors.push(`Tag 5: VAT amount must be a positive decimal number; got "${vat}"`);
    } else if (parseFloat(vat) < 0) {
      errors.push(`Tag 5: VAT amount must not be negative; got "${vat}"`);
    }
  }
  if (total && vat && /^\d+(\.\d+)?$/.test(total) && /^\d+(\.\d+)?$/.test(vat)) {
    if (parseFloat(vat) > parseFloat(total)) {
      errors.push(`Tag 5: VAT amount (${vat}) cannot exceed tag 4 invoice total (${total})`);
    }
  }

  if (byTag[1] !== undefined && byTag[1].trim().length === 0) {
    errors.push("Tag 1: seller name must not be empty");
  }

  return { valid: errors.length === 0, phase, errors };
}
