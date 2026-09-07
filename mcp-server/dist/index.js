#!/usr/bin/env node
/**
 * Saudi VAT Pro MCP Server
 * Lets AI agents (Claude Desktop, Cursor, Windsurf, …) create, submit,
 * and manage ZATCA-compliant invoices via the Saudi VAT Pro REST API.
 *
 * Usage:
 *   SAUDI_VAT_PRO_API_KEY=svp_live_… npx saudi-vat-pro-mcp
 *   SAUDI_VAT_PRO_API_KEY=svp_live_… npx saudi-vat-pro-mcp --base-url=https://saudivatpro.com/api
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// ── Config ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const baseUrlFlag = args.find((a) => a.startsWith("--base-url="));
const BASE_URL = baseUrlFlag
    ? baseUrlFlag.split("=").slice(1).join("=").replace(/\/$/, "")
    : (process.env.SAUDI_VAT_PRO_BASE_URL ?? "https://saudivatpro.com/api");
const API_KEY = process.env.SAUDI_VAT_PRO_API_KEY ?? "";
const REQUEST_TIMEOUT_MS = 60_000;
try {
    const parsedBaseUrl = new URL(BASE_URL);
    const isLocal = parsedBaseUrl.hostname === "localhost" || parsedBaseUrl.hostname === "127.0.0.1";
    if (parsedBaseUrl.protocol !== "https:" && !isLocal) {
        throw new Error("The Saudi VAT Pro API base URL must use HTTPS (except localhost for development).");
    }
}
catch (error) {
    process.stderr.write(`Error: invalid API base URL: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
}
if (!API_KEY) {
    process.stderr.write([
        "Error: SAUDI_VAT_PRO_API_KEY environment variable is required.",
        "Get your API key from: https://saudivatpro.com/settings",
        "",
        "Example (Claude Desktop config):",
        '  "env": { "SAUDI_VAT_PRO_API_KEY": "svp_live_..." }',
        "",
    ].join("\n"));
    process.exit(1);
}
// ── HTTP helper ───────────────────────────────────────────────────────────────
async function apiCall(method, path, body) {
    const url = `${BASE_URL}${path}`;
    let res;
    try {
        res = await fetch(url, {
            method,
            headers: {
                "X-API-Key": API_KEY,
                "Content-Type": "application/json",
                "User-Agent": "saudi-vat-pro-mcp/1.0.0",
            },
            body: body != null ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            throw new Error(`Saudi VAT Pro API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Check the invoice in the dashboard before retrying a create operation.`);
        }
        throw new Error(`Could not reach the Saudi VAT Pro API: ${error instanceof Error ? error.message : String(error)}`);
    }
    // PDF and other binary responses — return a description
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf")) {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: PDF download failed`);
        }
        return { type: "pdf", message: "PDF downloaded successfully. Check the dashboard to access it." };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const payload = json;
        const message = payload.message ?? payload.error ?? `HTTP ${res.status}`;
        const details = payload.details ?? payload.errors;
        const suffix = details ? ` Details: ${JSON.stringify(details)}` : "";
        throw new Error(`Saudi VAT Pro API ${res.status}: ${String(message)}${suffix}`);
    }
    return json;
}
function formatResult(data) {
    return JSON.stringify(data, null, 2);
}
// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "saudi-vat-pro",
    version: "1.0.0",
});
// ── Tool: list_invoices ───────────────────────────────────────────────────────
server.tool("list_invoices", "List ZATCA invoices with optional filters. Returns paginated invoice summaries including status, totals, and ZATCA submission results.", {
    status: z
        .string()
        .optional()
        .describe("Filter by status, for example: pending, pending_submission, generated, signed, reported, cleared, failed, needs_data, or awaiting_buyer_data"),
    invoiceType: z
        .string()
        .optional()
        .describe("Filter by type. Use 'standard' for B2B or 'simplified' for B2C (consumer) invoices"),
    search: z.string().optional().describe("Search by invoice number, buyer name, or order reference"),
    page: z.number().int().min(1).optional().describe("Page number (default: 1)"),
    pageSize: z.number().int().min(1).max(100).optional().describe("Results per page (default: 20, max: 100)"),
}, async ({ status, invoiceType, search, page, pageSize }) => {
    const params = new URLSearchParams();
    if (status)
        params.set("status", status);
    if (invoiceType)
        params.set("invoiceType", invoiceType);
    if (search)
        params.set("search", search);
    if (page)
        params.set("page", String(page));
    if (pageSize)
        params.set("pageSize", String(pageSize));
    const qs = params.toString();
    const data = await apiCall("GET", `/invoices${qs ? `?${qs}` : ""}`);
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: get_invoice ─────────────────────────────────────────────────────────
server.tool("get_invoice", "Get full invoice detail including line items, ZATCA submission status, error messages, QR code, and the event timeline showing every step of the compliance pipeline.", {
    id: z.string().describe("Invoice ID (e.g. inv_8f7d6e5c)"),
}, async ({ id }) => {
    const data = await apiCall("GET", `/invoices/${encodeURIComponent(id)}`);
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: create_invoice ──────────────────────────────────────────────────────
const InvoiceLineSchema = z.object({
    name: z.string().describe("Line item description"),
    quantity: z.number().finite().positive().describe("Quantity (must be positive)"),
    unitPrice: z.number().finite().positive().describe("Positive unit price before VAT in SAR"),
    vatRate: z.number().min(0).max(100).optional().describe("VAT rate as a percentage (e.g. 15 for standard, 0 for zero-rated). Defaults to merchant default."),
    vatCategory: z
        .enum(["S", "Z", "E", "O"])
        .optional()
        .describe("ZATCA VAT category: S=Standard, Z=Zero-rated, E=Exempt, O=Out-of-scope. Use S with 15% VAT. Z, E, and O require a valid VATEX reason."),
    vatexCode: z.string().optional().describe("ZATCA VATEX exemption reason code (for example VATEX-SA-32). Required for Z, E, or O; overrides the merchant default."),
    discount: z.number().finite().min(0).optional().describe("Fixed discount amount for the entire line in SAR (not per unit and not a percentage). Must be less than quantity × unitPrice."),
});
server.tool("create_invoice", "Create a Saudi e-invoice and run the available ZATCA pipeline. Before calling, use get_zatca_status and confirm environment='production' for a legally submitted invoice; sandbox submissions are tests only. Standard (B2B) invoices require buyerName, buyerVatNumber, and buyerCity and normally clear; simplified invoices normally report. Always inspect the returned status: cleared/reported means submitted, generated/signed/pending means not yet submitted, needs_data/awaiting_buyer_data requires correction, and failed requires action.", {
    invoiceType: z
        .enum(["standard", "simplified"])
        .describe("ZATCA invoice profile: 'standard' for B2B tax invoices (buyer name, VAT number, and city required); 'simplified' for eligible B2C transactions"),
    lines: z.array(InvoiceLineSchema).min(1).describe("Invoice line items (at least one required)"),
    orderReference: z.string().optional().describe("Your order/invoice reference. Should be unique per invoice to avoid ZATCA duplicate errors (BV-000001)."),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Issue date in YYYY-MM-DD format (for example 2026-09-07). Defaults to today."),
    buyerName: z.string().optional().describe("Buyer company or person name. Required for standard (B2B) invoices."),
    buyerVatNumber: z
        .string()
        .optional()
        .describe("Buyer VAT registration number. Required for standard (B2B) invoices. Must be 15 digits starting and ending with 3 (e.g. 310000000000006)."),
    buyerCity: z.string().optional().describe("Buyer city. Required for standard (B2B) invoices."),
    buyerStreet: z.string().optional().describe("Buyer street address. Optional for B2B invoices."),
    buyerPostalCode: z.string().optional().describe("Buyer postal code. Optional for B2B invoices."),
    paymentMeans: z
        .string()
        .optional()
        .describe("UNTDID 4461 payment means code: 10=cash, 30=credit transfer, 42=bank account, 48=bank card. Optional."),
    note: z.string().optional().describe("Human-readable note or memo (e.g. credit note reason). Optional."),
    currency: z.string().regex(/^[A-Z]{3}$/).optional().describe("Uppercase ISO 4217 currency code (default: SAR)."),
}, async ({ invoiceType, lines, orderReference, issueDate, buyerName, buyerVatNumber, buyerCity, buyerStreet, buyerPostalCode, paymentMeans, note, currency, }) => {
    if (invoiceType === "standard") {
        const missing = [
            !buyerName?.trim() && "buyerName",
            !buyerVatNumber?.trim() && "buyerVatNumber",
            !buyerCity?.trim() && "buyerCity",
        ].filter(Boolean);
        if (missing.length > 0) {
            throw new Error(`Standard invoices require ${missing.join(", ")} before ZATCA submission.`);
        }
        if (!/^3\d{13}3$/.test(buyerVatNumber)) {
            throw new Error("buyerVatNumber must be 15 digits and start and end with 3.");
        }
    }
    for (const [index, line] of lines.entries()) {
        const gross = line.quantity * line.unitPrice;
        if ((line.discount ?? 0) >= gross) {
            throw new Error(`Line ${index + 1} discount must be less than quantity × unitPrice.`);
        }
        if ((line.vatCategory === "Z" || line.vatCategory === "E" || line.vatCategory === "O") &&
            !line.vatexCode) {
            throw new Error(`Line ${index + 1} requires vatexCode when vatCategory is ${line.vatCategory}.`);
        }
        if (line.vatCategory === "S" && line.vatRate !== undefined && line.vatRate !== 15) {
            throw new Error(`Line ${index + 1} with vatCategory S must use vatRate 15.`);
        }
        if ((line.vatCategory === "Z" || line.vatCategory === "E" || line.vatCategory === "O") &&
            line.vatRate !== undefined &&
            line.vatRate !== 0) {
            throw new Error(`Line ${index + 1} with vatCategory ${line.vatCategory} must use vatRate 0.`);
        }
    }
    const body = {
        invoiceType,
        lines,
        ...(orderReference !== undefined ? { orderReference } : {}),
        ...(issueDate !== undefined ? { issueDate } : {}),
        ...(buyerName !== undefined ? { buyerName } : {}),
        ...(buyerVatNumber !== undefined ? { buyerVatNumber } : {}),
        ...(buyerCity !== undefined ? { buyerCity } : {}),
        ...(buyerStreet !== undefined ? { buyerStreet } : {}),
        ...(buyerPostalCode !== undefined ? { buyerPostalCode } : {}),
        ...(paymentMeans !== undefined ? { paymentMeans } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(currency !== undefined ? { currency } : {}),
    };
    const data = await apiCall("POST", "/invoices", body);
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: create_credit_note ──────────────────────────────────────────────────
server.tool("create_credit_note", "Issue a ZATCA credit note (document type 381) against a cleared or reported invoice. Omit lines for the remaining full refundable balance, or provide positive partial-refund lines that do not exceed the parent's remaining quantities and amounts. Supply a stable idempotencyKey so agent/network retries cannot create a duplicate credit note.", {
    invoiceId: z.string().describe("ID of the parent invoice to credit (must be in 'cleared' or 'reported' status)"),
    reasonCode: z
        .enum(["return", "cancellation", "price_correction"])
        .optional()
        .describe("Reason for the credit note. Default: 'return'"),
    note: z.string().optional().describe("Additional note explaining the reason"),
    idempotencyKey: z
        .string()
        .min(8)
        .max(128)
        .describe("Stable unique key for this refund intent. Reuse the same value when retrying the same request; use a new value for a different refund."),
    lines: z
        .array(z.object({
        name: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().finite().positive().describe("Must be positive — credit note amounts are always positive"),
        vatRate: z.number().min(0).max(100).optional(),
        vatCategory: z.enum(["S", "Z", "E", "O"]).optional(),
        vatexCode: z.string().optional().describe("ZATCA VATEX exemption reason code (e.g. VATEX-SA-32). Required when vatCategory is Z, E, or O."),
        discount: z.number().finite().min(0).optional().describe("Fixed discount amount for the entire credited line"),
    }))
        .optional()
        .describe("Lines to credit. Omit for a full refund of all parent invoice lines."),
}, async ({ invoiceId, reasonCode, note, idempotencyKey, lines }) => {
    for (const [index, line] of (lines ?? []).entries()) {
        const gross = line.quantity * line.unitPrice;
        if ((line.discount ?? 0) >= gross) {
            throw new Error(`Credit line ${index + 1} discount must be less than quantity × unitPrice.`);
        }
        if ((line.vatCategory === "Z" || line.vatCategory === "E" || line.vatCategory === "O") &&
            !line.vatexCode) {
            throw new Error(`Credit line ${index + 1} requires vatexCode when vatCategory is ${line.vatCategory}.`);
        }
        if (line.vatCategory === "S" && line.vatRate !== undefined && line.vatRate !== 15) {
            throw new Error(`Credit line ${index + 1} with vatCategory S must use vatRate 15.`);
        }
        if ((line.vatCategory === "Z" || line.vatCategory === "E" || line.vatCategory === "O") &&
            line.vatRate !== undefined &&
            line.vatRate !== 0) {
            throw new Error(`Credit line ${index + 1} with vatCategory ${line.vatCategory} must use vatRate 0.`);
        }
    }
    const body = {
        ...(reasonCode !== undefined ? { reasonCode } : {}),
        ...(note !== undefined ? { note } : {}),
        idempotencyKey,
        ...(lines !== undefined ? { lines } : {}),
    };
    const data = await apiCall("POST", `/invoices/${encodeURIComponent(invoiceId)}/credit-note`, body);
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: retry_invoice ───────────────────────────────────────────────────────
server.tool("retry_invoice", "Re-run the ZATCA compliance pipeline for a failed invoice after correcting it in the Saudi VAT Pro dashboard. Returns the updated status; always inspect it rather than assuming submission succeeded.", {
    id: z.string().describe("Invoice ID to retry"),
}, async ({ id }) => {
    const data = await apiCall("POST", `/invoices/${encodeURIComponent(id)}/retry`);
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: explain_invoice_error ───────────────────────────────────────────────
server.tool("explain_invoice_error", "Get an AI-generated plain-language explanation of why an invoice failed ZATCA validation, along with specific suggested actions to fix it. Most useful for 'failed' or 'needs_data' invoices.", {
    id: z.string().describe("Invoice ID to explain"),
}, async ({ id }) => {
    const data = await apiCall("POST", `/invoices/${encodeURIComponent(id)}/explain`);
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: get_zatca_status ────────────────────────────────────────────────────
server.tool("get_zatca_status", "Check certificate (CSID) enrollment, expiry, environment, and readiness before creating invoices. environment='sandbox' is test-only and does not constitute legal ZATCA submission; confirm environment='production' for live invoices.", {}, async () => {
    const [status, cert] = await Promise.all([
        apiCall("GET", "/merchant/zatca-status"),
        apiCall("GET", "/merchant/certificate"),
    ]);
    return {
        content: [
            {
                type: "text",
                text: formatResult({ zatcaStatus: status, certificate: cert }),
            },
        ],
    };
});
// ── Tool: get_merchant_profile ────────────────────────────────────────────────
server.tool("get_merchant_profile", "Get the merchant's business profile including business name, VAT number, address, default invoice settings, and subscription plan.", {}, async () => {
    const data = await apiCall("GET", "/merchant");
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Tool: get_dashboard_summary ───────────────────────────────────────────────
server.tool("get_dashboard_summary", "Get a compliance health summary: total invoices, counts by status (cleared, failed, pending), VAT totals for the current period, and any outstanding issues requiring attention.", {}, async () => {
    const data = await apiCall("GET", "/dashboard/summary");
    return { content: [{ type: "text", text: formatResult(data) }] };
});
// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map