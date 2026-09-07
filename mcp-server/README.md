# saudi-vat-pro-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for [Saudi VAT Pro](https://saudivatpro.com) — submit and manage ZATCA Phase 2 e-invoices from Claude Desktop, Cursor, Windsurf, and any MCP-compatible AI agent.

Ask your AI assistant things like:

- _"Create a ZATCA invoice for Acme Trading, VAT 310000000000006, 1500 SAR consulting fee"_
- _"Why did invoice inv\_abc123 fail? How do I fix it?"_
- _"Show me all failed invoices from this month"_
- _"Issue a credit note against invoice inv\_xyz for a full refund"_
- _"What's our ZATCA compliance status?"_

## Requirements

- Node.js 18+
- A Saudi VAT Pro account with an API key: [saudivatpro.com/settings](https://saudivatpro.com/settings)

## Claude Desktop setup

Add this to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "saudi-vat-pro": {
      "command": "npx",
      "args": ["saudi-vat-pro-mcp"],
      "env": {
        "SAUDI_VAT_PRO_API_KEY": "svp_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Cursor setup

In Cursor → Settings → MCP, add:

```json
{
  "saudi-vat-pro": {
    "command": "npx",
    "args": ["saudi-vat-pro-mcp"],
    "env": {
      "SAUDI_VAT_PRO_API_KEY": "svp_live_YOUR_KEY_HERE"
    }
  }
}
```

## Windsurf setup

In Windsurf → Cascade → MCP Servers, add the same config as Cursor above.

## Local development

Run directly from the source repository:

```bash
git clone https://github.com/Morouna1/SaudiVatPro
cd SaudiVatPro/mcp-server
npm install && npm run build
SAUDI_VAT_PRO_API_KEY=svp_live_... node dist/index.js
```

For Claude Desktop with a local build, use `node` with an absolute path instead of `npx`:

```json
{
  "mcpServers": {
    "saudi-vat-pro": {
      "command": "node",
      "args": ["/absolute/path/to/saudi-vat-pro-mcp/dist/index.js"],
      "env": {
        "SAUDI_VAT_PRO_API_KEY": "svp_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Custom base URL

The server defaults to `https://saudivatpro.com/api`. Override it for local testing:

```bash
SAUDI_VAT_PRO_API_KEY=svp_live_... node dist/index.js --base-url=http://localhost:5000/api
```

## Available tools

| Tool | Description |
|---|---|
| `list_invoices` | List invoices with filters (status, type, search, pagination) |
| `get_invoice` | Full invoice detail with line items, ZATCA status, and event timeline |
| `create_invoice` | Create an invoice and run the available ZATCA pipeline; always inspect the returned status and environment |
| `create_credit_note` | Issue an idempotent full or partial credit note within the remaining refundable balance |
| `retry_invoice` | Re-run the ZATCA pipeline for a failed invoice |
| `explain_invoice_error` | AI explanation of why an invoice failed with suggested fixes |
| `get_zatca_status` | Check ZATCA certificate (CSID) status and environment readiness |
| `get_merchant_profile` | Get business profile, VAT number, and default settings |
| `get_dashboard_summary` | Compliance health summary with invoice counts and VAT totals |

## How it works

1. The MCP server starts as a local process on your machine (via stdio transport).
2. When your AI agent calls a tool, the server forwards the request to the Saudi VAT Pro REST API (`https://saudivatpro.com/api`) using your API key.
3. Saudi VAT Pro handles UBL XML generation, digital signing with your CSID certificate, ZATCA clearance/reporting, and dashboard PDF generation.
4. Results are returned as structured JSON so your AI agent can reason about them.

## Authentication

Pass your `svp_live_...` API key via the `SAUDI_VAT_PRO_API_KEY` environment variable. The MCP process sends it as the `X-API-Key` header; it is not a Bearer token or a browser session cookie. Generate or manage API keys at [saudivatpro.com/settings](https://saudivatpro.com/settings).

The key remains in the local MCP process environment. Invoice requests and tool results are sent to the configured Saudi VAT Pro API endpoint over HTTPS and returned to your AI client.

## ZATCA safety rules for agents

- Call `get_zatca_status` before issuing invoices. A `sandbox` environment is for testing only; only `production` submissions count as live ZATCA submissions.
- Use `standard` for B2B tax invoices and provide the buyer name, 15-digit VAT number, and city. The VAT number must start and end with `3`.
- Use `simplified` only for eligible B2C transactions.
- For standard-rated lines, use VAT category `S` and `vatRate: 15`. Zero-rated (`Z`), exempt (`E`), and out-of-scope (`O`) lines require the correct ZATCA VATEX reason code.
- Discounts are fixed amounts for the whole line, not percentages or per-unit discounts.
- Always inspect the returned invoice status. `cleared` or `reported` means submitted; `generated`, `signed`, or `pending` is not final; `needs_data`, `awaiting_buyer_data`, or `failed` requires action.
- Reuse the same `idempotencyKey` when retrying one credit-note intent so a network retry cannot create a duplicate refund.

## Links

- [Saudi VAT Pro](https://saudivatpro.com) — get your API key
- [API Documentation](https://saudivatpro.com/docs) — full REST API reference
- [GitHub source](https://github.com/Morouna1/SaudiVatPro/tree/main/mcp-server)
- [npm package](https://www.npmjs.com/package/saudi-vat-pro-mcp)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.Morouna1%2Fsaudi-vat-pro)
- [ZATCA Fatoora Portal](https://fatoora.zatca.gov.sa) — official ZATCA portal

## License

MIT
