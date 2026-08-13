=== Saudi VAT Pro — ZATCA Phase 2 WooCommerce Integration ===
Contributors: saudiatpro
Tags: woocommerce, zatca, vat, saudi arabia, e-invoicing, phase 2, tax invoice, b2b, b2c, compliance
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 8.0
WC requires at least: 7.0
WC tested up to: 9.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Automatic ZATCA Phase 2 e-invoicing for WooCommerce. Every paid order generates a ZATCA-compliant invoice instantly.

== Description ==

**Saudi VAT Pro** connects your WooCommerce store to Saudi Arabia's ZATCA e-invoicing system (Phase 2 — Fatoorah) so you never have to create an invoice manually again.

= What it does =

* **Every paid order → ZATCA invoice** automatically. Standard (B2B) invoices are cleared with ZATCA before delivery. Simplified (B2C) invoices are reported within 24 hours.
* **B2B detection at checkout.** An optional "Company VAT Number" field appears at checkout. When a business buyer enters their VAT number, the order automatically becomes a Standard (B2B) invoice — no manual override required.
* **Refunds → Credit notes.** When an order is refunded in WooCommerce, Saudi VAT Pro creates the corresponding ZATCA credit note automatically.
* **Invoice download link** appears in My Account → Orders and in the order confirmation email sent to the buyer.
* **Admin retry.** If a submission fails, use the "Retry Saudi VAT Pro submission" action from the order admin page.

= How B2B detection works =

95% of your buyers are consumers — they skip the VAT field and get a Simplified invoice. The 5% who are businesses enter their 15-digit Saudi VAT number. The plugin validates the format instantly, saves it to the order, and the correct invoice type is created on the Saudi VAT Pro side.

= Requirements =

* A [Saudi VAT Pro](https://saudivat.pro) account (free trial available)
* WooCommerce 7.0 or later
* PHP 8.0 or later

= Setup (2 minutes) =

1. Install and activate this plugin.
2. In WooCommerce → Settings → Saudi VAT Pro, paste your **Webhook URL** and **API Key** from the Saudi VAT Pro dashboard.
3. Done — every paid order will now generate a ZATCA invoice automatically.

For full setup instructions, see the [Saudi VAT Pro documentation](https://saudivat.pro/knowledge).

== Installation ==

1. Upload the `saudi-vat-pro-woocommerce` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Go to **WooCommerce → Settings → Saudi VAT Pro** and enter your API credentials.

== Frequently Asked Questions ==

= What is ZATCA Phase 2? =

ZATCA (Zakat, Tax and Customs Authority) mandates that all VAT-registered businesses in Saudi Arabia submit e-invoices electronically. Phase 2 (Fatoorah) requires integration-level compliance — every invoice must be digitally signed and submitted to ZATCA in real time. This plugin automates that process for WooCommerce stores.

= Does this work for both B2B and B2C orders? =

Yes. B2C orders (no buyer VAT number) produce a Simplified Invoice, reported to ZATCA within 24 hours. B2B orders (buyer entered a VAT number at checkout) produce a Standard Invoice, cleared with ZATCA before delivery.

= What happens if ZATCA rejects an invoice? =

The failure appears as an issue in your Saudi VAT Pro dashboard with a plain-language explanation and suggested fix. You can also use the **Retry Saudi VAT Pro submission** action on the WooCommerce order page.

= Does the plugin store any customer data outside my server? =

Order data (items, totals, buyer name/address, VAT number if provided) is sent to Saudi VAT Pro for invoice generation and ZATCA submission. Saudi VAT Pro's privacy policy applies to this data. No data is shared with any other third party.

= Can I test this in ZATCA's sandbox before going live? =

Yes — Saudi VAT Pro supports both the ZATCA sandbox and production environments. Switch environments from the Saudi VAT Pro dashboard.

= Is this plugin compatible with High-Performance Order Storage (HPOS)? =

Yes. The plugin declares full HPOS compatibility.

== Screenshots ==

1. The optional VAT Number field at WooCommerce checkout — collapsed by default, zero friction for consumers.
2. B2B buyers expand it and enter their 15-digit VAT number.
3. The Download Tax Invoice link in My Account → Order details.
4. Saudi VAT Pro settings page under WooCommerce → Settings.

== Changelog ==

= 1.0.0 =
* Initial release.
* Automatic invoice creation on order payment.
* Checkout VAT number field for B2B detection.
* Refund → credit note automation.
* Invoice download link in My Account and order emails.
* Admin retry action for failed submissions.

== Upgrade Notice ==

= 1.0.0 =
First release.
