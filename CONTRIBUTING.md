# Contributing to Saudi VAT Pro

Thanks for your interest in contributing! This repository contains the open-source pieces of the [Saudi VAT Pro](https://saudivat.pro) platform: the WooCommerce plugin, the ZATCA QR TLV helpers, and support documentation.

## Ways to contribute

- **Report a bug** — use the [bug report template](../../issues/new?template=bug_report.md)
- **Ask a support question** — use the [support question template](../../issues/new?template=support_question.md)
- **Improve the docs** — fixes to the guides in [`docs/`](./docs/) are always welcome
- **Submit code** — bug fixes and improvements to the WooCommerce plugin or QR helpers

## Submitting a pull request

1. Fork the repository and create a branch from `main`.
2. Make your changes. Keep the scope focused — one fix or feature per PR.
3. For the WooCommerce plugin, follow the [WordPress coding standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/).
4. For the QR helpers, keep the code dependency-free and browser-safe (no Node-only APIs like `Buffer`).
5. Open a pull request describing what you changed and why.

## What we can't accept here

- Changes to the Saudi VAT Pro platform itself (API server, web app) — that code is not in this repository. Platform issues should go to [saudivat.pro/support](https://saudivat.pro/support).
- New features that require ZATCA credentials or private platform APIs.

## Security issues

Please **do not** open a public issue for security vulnerabilities. Contact us via [saudivat.pro/support](https://saudivat.pro/support) instead.

## License

By contributing to the WooCommerce plugin you agree your contribution is licensed under [GPL v2](./LICENSE). Contributions to the QR helpers are licensed under MIT (see `zatca-qr-helpers/package.json`).
