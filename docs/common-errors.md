# Common ZATCA Errors & How to Fix Them — BR-KSA Error Codes

> Free guide from the [Saudi VAT Pro Knowledge Center](https://saudivat.pro/knowledge/common-errors). If you use [Saudi VAT Pro](https://saudivat.pro), each rejection appears in your dashboard with a plain-language explanation and a one-click repair flow.

When ZATCA rejects an invoice, it returns one or more codes from the **BR-KSA** business-rule set (or an XSD/hash error). Here are the ones merchants hit most, with causes and fixes.

---

### `BR-KSA-F-04` — Invalid VAT registration number format

**Cause:** The seller or buyer VAT number is not exactly 15 digits, or doesn't start and end with `3`.

**Fix:** Verify the VAT number against your ZATCA registration certificate. It must be 15 digits, beginning with `3`. For B2B invoices, also validate the buyer's VAT number at capture time.

---

### `BR-KSA-69` — VAT exemption reason missing

**Cause:** A line uses VAT category `Z` (zero-rated) or `E` (exempt) but the required exemption reason code/text (`VATEX-SA-…`) is missing.

**Fix:** Every zero-rated or exempt line must carry a valid exemption reason code. For example, exports typically use `VATEX-SA-32`. See ZATCA's list of accepted VATEX codes.

---

### `BR-KSA-63` — Invalid buyer identification

**Cause:** A Standard (B2B) invoice is missing the buyer's VAT number or an accepted alternative ID (CR number, MOMRA license, etc.).

**Fix:** Collect the buyer's 15-digit VAT number at checkout for B2B orders. If the buyer has no VAT number, use one of ZATCA's accepted alternative ID schemes — or issue a Simplified invoice if the transaction qualifies as B2C.

---

### `BR-KSA-F-06-C28` — Invalid invoice type code

**Cause:** The invoice type code / subtype flags (e.g. `0100000` vs `0200000`) don't match the document contents — such as a credit note (381) submitted with invoice flags.

**Fix:** Use `388` for tax invoices, `381` for credit notes, `383` for debit notes, and set the subtype bitmask correctly (`01…` standard, `02…` simplified).

---

### `BR-KSA-EN16931-03` — Credit note missing billing reference

**Cause:** A credit note (381) doesn't reference the original invoice it corrects.

**Fix:** Include a `BillingReference` pointing to the original invoice number. Credit note amounts must be **positive** — the type code 381 is what marks it as a credit, not negative amounts.

---

### `XSD_ZATCA_INVALID` — XML schema validation failed

**Cause:** The invoice XML doesn't conform to the UBL 2.1 schema with ZATCA extensions — wrong element order, missing mandatory elements, or malformed values.

**Fix:** Validate your XML against ZATCA's published XSDs before submission. Element order matters in UBL — e.g. `BillingReference` must appear before `AdditionalDocumentReference`.

---

### `invalid-invoice-hash` — Invoice hash mismatch

**Cause:** The hash in the invoice (and QR tag 6) doesn't match the canonical XML actually submitted. Usually the XML was modified *after* hashing/signing, or canonicalization differs byte-for-byte.

**Fix:** Sign and hash the **final** XML — never touch it afterward. Canonicalization (C14N), whitespace, and namespace handling must be byte-exact.

---

### `BV-000001` — Generic validation failure

**Cause:** A catch-all for submission-level problems: malformed request envelope, wrong environment (sandbox vs production), or expired/invalid CSID.

**Fix:** Check that you're calling the right environment URL, your CSID certificate is valid and not expired, and the request body matches ZATCA's API spec.

---

## Stop debugging error codes

[Saudi VAT Pro](https://saudivat.pro) validates invoices before submission, explains any ZATCA rejection in plain language, and lets you repair and resubmit with one click.

**[→ Start your 60-day free trial](https://saudivat.pro/signup)** — no credit card required.

---

**Related guides:** [ZATCA Phase 2 overview](./zatca-phase-2.md) · [QR code explained](./qr-code-explained.md) · [Full Knowledge Center](https://saudivat.pro/knowledge)
