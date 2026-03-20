# SA Diagram Studio

A local web app that generates Shopify migration architecture diagrams from a project description, PDF scope document, or Google Drive file — powered by Claude Opus.

Built for Shopify Solution Architects to rapidly produce client-ready technical diagrams for enterprise platform migrations.

## What it does

Paste or upload a merchant's migration brief and get five Mermaid diagrams rendered instantly:

| Diagram | Description |
|---------|-------------|
| **Target Architecture** | Shopify target-state: storefront, core platform & enterprise systems |
| **Data Flow** | Product sync, order chain, inventory, customer events & analytics pipeline |
| **Integration Map** | Full integration topology — all third-party systems and connection types |
| **Migration Phases** | Programme roadmap from Discovery through Post-Launch Optimisation |
| **Order Sequence** | End-to-end order lifecycle: checkout → ERP/OMS → fulfillment → tracking |

All five diagrams are generated strictly from your input — only systems, integrations, data flows, and actors you explicitly describe will appear. Nothing is inferred or assumed. If you don't mention an OMS, there's no OMS in the sequence diagram.

The only additional context layered in automatically is Shopify reference terminology fetched from internal documentation (via MCP), which improves label accuracy (e.g. "GraphQL Admin API" instead of a generic "Shopify API") without adding systems you didn't describe.

## Input modes

- **Google Drive** — paste a Drive URL (Doc, Sheet, Slides, etc.) to attach it directly
- **Upload PDF** — drag and drop a scope doc, VTP, SOW, or RFP
- **Paste Text** — type or paste a project description freeform

## Requirements

- Python 3.9+
- **Shopify Dev MCP** — via the Shopify internal `devx` CLI (`devx mcp`). Used to query `vault_search` and `grokt_search` for internal Shopify documentation, enriching diagram labels with accurate API names and integration patterns.
- **Google Workspace MCP** — run via `~/.config/gworkspace-mcp/run-mcp.sh`. Used to fetch and read files from Google Drive when using the Drive input mode.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The app runs on [http://localhost:5001](http://localhost:5001).

## Usage

1. Choose your input mode (Google Drive, PDF, or Paste)
2. Provide the merchant's migration description or attach a document
3. Select the **Source Platform**, **Shopify Tier**, and **Storefront Architecture**
4. Click **Generate Diagrams** (or press `⌘↵`)
5. Each diagram renders as an interactive SVG with options to:
   - Export as high-resolution PNG
   - View or copy the raw Mermaid source
   - Toggle light/dark theme
6. Click **Save Project** to save all diagrams (`.mmd` + `.png`) to `diagrams/`

## Supported source platforms

SFCC, Magento / Adobe Commerce, Commercetools, SAP Hybris, HCL Commerce, Oracle ATG, Centra, BigCommerce, WooCommerce, Bespoke / Legacy

## Stack

- **Backend**: Python / Flask
- **AI**: Claude Opus 4.6 via Shopify's internal LLM proxy
- **Diagrams**: Mermaid.js (rendered client-side)
- **Context enrichment**: Shopify internal MCP (vault + grokt search)
- **Document input**: pypdf, Google Workspace MCP

---

Created by Philip Bloch, Staff Solutions Architect @ Shopify
