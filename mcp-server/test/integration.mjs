import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const requests = [];
const api = createServer(async (req, res) => {
  let rawBody = "";
  for await (const chunk of req) rawBody += chunk;
  const body = rawBody ? JSON.parse(rawBody) : undefined;
  requests.push({ method: req.method, url: req.url, headers: req.headers, body });

  res.setHeader("content-type", "application/json");
  if (req.url === "/api/invoices/error") {
    res.statusCode = 422;
    res.end(JSON.stringify({ message: "Invoice validation failed", details: { field: "buyerVatNumber" } }));
    return;
  }
  res.end(JSON.stringify({ ok: true, method: req.method, path: req.url, body }));
});

await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const address = api.address();
assert(address && typeof address === "object");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js", `--base-url=http://127.0.0.1:${address.port}/api`],
  env: { ...process.env, SAUDI_VAT_PRO_API_KEY: "svp_test_integration" },
  stderr: "pipe",
});
const client = new Client({ name: "saudi-vat-pro-mcp-integration", version: "1.0.0" });

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.equal(tools.length, 9);
  assert.deepEqual(
    tools.map(({ name }) => name).sort(),
    [
      "create_credit_note",
      "create_invoice",
      "explain_invoice_error",
      "get_dashboard_summary",
      "get_invoice",
      "get_merchant_profile",
      "get_zatca_status",
      "list_invoices",
      "retry_invoice",
    ],
  );

  await client.callTool({
    name: "list_invoices",
    arguments: { status: "failed", invoiceType: "standard", search: "ACME", page: 2, pageSize: 10 },
  });
  await client.callTool({ name: "get_invoice", arguments: { id: "inv/encoded" } });
  await client.callTool({
    name: "create_invoice",
    arguments: {
      invoiceType: "standard",
      orderReference: "ORDER-1001",
      buyerName: "Acme Trading",
      buyerVatNumber: "310000000000003",
      buyerCity: "Riyadh",
      lines: [{ name: "Consulting", quantity: 2, unitPrice: 100, vatRate: 15, vatCategory: "S", discount: 10 }],
    },
  });
  await client.callTool({
    name: "create_credit_note",
    arguments: {
      invoiceId: "inv_parent",
      idempotencyKey: "refund-order-1001",
      reasonCode: "cancellation",
    },
  });
  await client.callTool({ name: "retry_invoice", arguments: { id: "inv_retry" } });
  await client.callTool({ name: "explain_invoice_error", arguments: { id: "inv_failed" } });
  await client.callTool({ name: "get_zatca_status", arguments: {} });
  await client.callTool({ name: "get_merchant_profile", arguments: {} });
  await client.callTool({ name: "get_dashboard_summary", arguments: {} });

  const expected = [
    ["GET", "/api/invoices?status=failed&invoiceType=standard&search=ACME&page=2&pageSize=10"],
    ["GET", "/api/invoices/inv%2Fencoded"],
    ["POST", "/api/invoices"],
    ["POST", "/api/invoices/inv_parent/credit-note"],
    ["POST", "/api/invoices/inv_retry/retry"],
    ["POST", "/api/invoices/inv_failed/explain"],
    ["GET", "/api/merchant/zatca-status"],
    ["GET", "/api/merchant/certificate"],
    ["GET", "/api/merchant"],
    ["GET", "/api/dashboard/summary"],
  ];
  assert.deepEqual(requests.map(({ method, url }) => [method, url]), expected);
  assert(requests.every(({ headers }) => headers["x-api-key"] === "svp_test_integration"));
  assert.deepEqual(requests[2].body.lines[0], {
    name: "Consulting",
    quantity: 2,
    unitPrice: 100,
    vatRate: 15,
    vatCategory: "S",
    discount: 10,
  });
  assert.equal(requests[3].body.idempotencyKey, "refund-order-1001");

  const requestCount = requests.length;
  const missingBuyer = await client.callTool({
    name: "create_invoice",
    arguments: { invoiceType: "standard", lines: [{ name: "Service", quantity: 1, unitPrice: 100 }] },
  });
  assert.equal(missingBuyer.isError, true);
  assert.match(JSON.stringify(missingBuyer.content), /buyerName/);

  const missingVatex = await client.callTool({
    name: "create_invoice",
    arguments: {
      invoiceType: "simplified",
      lines: [{ name: "Export", quantity: 1, unitPrice: 100, vatRate: 0, vatCategory: "Z" }],
    },
  });
  assert.equal(missingVatex.isError, true);
  assert.match(JSON.stringify(missingVatex.content), /vatexCode/);
  assert.equal(requests.length, requestCount, "locally invalid requests must not reach the API");

  const apiError = await client.callTool({ name: "get_invoice", arguments: { id: "error" } });
  assert.equal(apiError.isError, true);
  assert.match(JSON.stringify(apiError.content), /422/);
  assert.match(JSON.stringify(apiError.content), /buyerVatNumber/);

  console.log(`MCP integration passed: ${tools.length} tools, ${requests.length} API requests, validation and error handling verified.`);
} finally {
  await client.close().catch(() => {});
  await new Promise((resolve, reject) => api.close((error) => (error ? reject(error) : resolve())));
}