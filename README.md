# SA Diagram Studio

A local web app that generates Shopify migration architecture diagrams from a project description, PDF scope document, or Google Drive file — powered by Claude Opus.

Built for Shopify Solution Architects to rapidly produce client-ready technical diagrams for enterprise platform migrations.

![SA Diagram Studio](static/shopify-bag.png)

## What it does

Paste or upload a merchant's migration brief and get five Mermaid diagrams rendered instantly:

| Diagram | Description |
|---------|-------------|
| **Target Architecture** | Shopify target-state: storefront, core platform & enterprise systems |
| **Data Flow** | Product sync, order chain, inventory, customer events & analytics pipeline |
| **Integration Map** | Full integration topology — all third-party systems and connection types |
| **Migration Phases** | Programme roadmap from Discovery through Post-Launch Optimisation |
| **Order Sequence** | End-to-end order lifecycle: checkout → ERP/OMS → fulfillment → tracking |

Each diagram uses accurate Shopify API names, integration patterns, and source platform migration terminology — no hallucinated or generic labels.

## Input modes

- **Google Drive** — paste a Drive URL (Doc, Sheet, Slides, etc.) to attach it directly
- **Upload PDF** — drag and drop a scope doc, VTP, SOW, or RFP
- **Paste Text** — type or paste a project description freeform

## Requirements

- Python 3.9+
- Shopify internal `devx` CLI (for Claude API token)
- Google Workspace MCP server (for Google Drive integration)

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

## URL parameters

Pre-fill the form via query parameters:

| Parameter | Description |
|-----------|-------------|
| `?drive=<url>` | Auto-attach a Google Drive file |
| `?pdf=/path/to/file.pdf` | Extract and pre-fill from a local PDF |
| `?context=...` | Pre-fill the description text |
| `?source=sfcc` | Pre-select source platform |
| `?tier=plus` | Pre-select Shopify tier |
| `?arch=hydrogen` | Pre-select storefront architecture |

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
