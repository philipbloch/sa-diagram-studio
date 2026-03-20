import asyncio
import base64
import io
import json
import os
import subprocess
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()
import httpx
from flask import Flask, render_template, request, jsonify
from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters
from pypdf import PdfReader

app = Flask(__name__)

_ANTHROPIC_API_URL = "https://proxy.shopify.ai/vendors/anthropic/v1/messages"
_TOKEN_CMD = ["/opt/dev/bin/user/devx", "llm-gateway", "print-token", "--key"]


def _get_token() -> str:
    """Return a fresh token from devx."""
    try:
        return subprocess.check_output(_TOKEN_CMD, text=True).strip()
    except Exception as e:
        print(f"Token fetch failed: {e}")
        raise


def _call_claude(system: str, user: str, model: str = "claude-opus-4-6", max_tokens: int = 8192) -> str:
    """Call Claude via direct httpx (bypasses SDK header issues with the Shopify proxy)."""
    token = _get_token()
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    r = httpx.post(
        _ANTHROPIC_API_URL,
        headers={
            "x-api-key": token,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
        timeout=120,
    )
    if not r.is_success:
        raise RuntimeError(f"Claude API {r.status_code}: {r.text[:500]}")
    data = r.json()
    return data["content"][0]["text"]

SYSTEM_PROMPT = """You are a senior solutions architect specialising in enterprise migrations to Shopify Plus and Commerce Components by Shopify (CCS).

## CRITICAL RULE — Only diagram what is described
Only include systems, integrations, data flows, and actors that are **explicitly mentioned** in the project description. Do NOT infer, assume, or add typical systems that are not stated. If analytics is not mentioned, omit it. If a carrier is not named, omit it. If only one CRM is listed, show only that one. The diagrams must be a faithful representation of what was described — nothing more.

## Shopify Reference Terminology
Use these accurate names and patterns when labelling nodes and connections for Shopify-side components:

### Shopify Plus APIs
- **GraphQL Admin API** — primary integration surface for all admin operations (products, orders, inventory, customers, discounts, metafields, fulfilments, webhooks). Use this name; REST Admin API is in legacy mode as of Oct 2024.
- **Storefront API** — buyer-facing GraphQL API; used by Hydrogen, headless storefronts, mobile apps
- **Bulk Operations API** — async large-scale data sync (thousands of products/variants)
- **Web Pixel API / Custom Pixels** — sandboxed JS for analytics and tracking
- **Shopify Functions** — serverless logic at checkout; replaces Scripts
- **Checkout UI Extensions** — customise checkout UI; requires Shopify Plus
- **Fulfillment Orders API** — 3PL and OMS coordination
- **Carrier Service API** — real-time shipping rate calculation
- **Webhooks** — event-driven, async, with retry (HTTPS, Google Cloud Pub/Sub, or Amazon EventBridge)

### Shopify Plus Capabilities
- **Checkout Extensibility** — UI Extensions + Functions (not legacy Scripts or checkout.liquid)
- **Shopify Markets** — multi-currency, multi-language, geo-redirects within a store
- **Shopify Flow** — automation workflows
- **Shopify B2B** — company accounts, buyer portals, net terms, draft orders
- **Shopify POS Pro** — in-store point of sale
- **Hydrogen + Oxygen** — React-based headless framework + Shopify edge hosting

### Commerce Components by Shopify (CCS)
- **Full Platform** — complete Shopify stack with unthrottled APIs and dedicated infrastructure
- **Checkout Component** — standalone Shopify Checkout embedded in any storefront
- **Shop Component** (formerly SPCC) — Shop Pay accelerated checkout for non-Shopify platforms; JS SDK (Shop-JS) + Storefront API + Admin API
- **Storefront Component** — Storefront API + content management, independent of backend

### Integration Patterns (use these labels on connections)
1. **App Store Connector** — pre-built, vendor-certified App Store integration
2. **Admin API (Custom)** — direct GraphQL via custom app or middleware
3. **Webhook / Event-Driven** — real-time Shopify event to subscribed endpoint
4. **Custom Pixel** — sandboxed JS via Web Pixel API
5. **Plugin / Vendor Connector** — vendor-maintained connector, not on App Store
6. **Theme-Level** — Liquid/JS embed within Online Store theme

### Source Platform Migration Patterns
- **SFCC**: SFRA cartridges → Checkout Extensions + apps; OCAPI/SCAPI → Shopify Admin API
- **Magento / Adobe Commerce**: custom modules → Checkout Extensions/Functions; Magento REST → Admin API
- **Commercetools**: rewire frontend API calls from Commercetools → Shopify Storefront/Admin API
- **SAP Hybris**: complex pricing rules → Shopify Functions; B2B → Shopify B2B
- **HCL / WebSphere**: component-by-component API-first migration
- **Centra / headless bespoke**: rewire frontend to Shopify Storefront API; preserve surrounding stack

## Diagram Generation Rules
Generate exactly these five Mermaid diagrams using **only the systems and context from the project description**:

1. **target_architecture** — `graph TD` with subgraph blocks for each layer present in the description: storefront, Shopify core, and any enterprise systems mentioned. Only include subgraph blocks and nodes for systems explicitly described.

2. **data_flow** — `graph LR` showing only the data flows relevant to systems named in the description. Label each arrow with the sync mechanism (webhook / Admin API / Bulk Op / real-time / batch) based on what the described systems actually use.

3. **integration_map** — `graph TD` with Shopify at centre. Group only the described third-party systems by their domain. Label each connection with the applicable integration pattern from the list above.

4. **migration_phases** — `flowchart LR` showing the migration programme scoped to what is described: from source platform decommission through to go-live. Include only phases and deliverables relevant to the described scope.

5. **sequence** — `sequenceDiagram` showing the order lifecycle using only the systems named in the description (e.g. if no OMS is mentioned, route directly from Shopify Order to fulfilment/carrier if described).

## Output Rules
- Return raw Mermaid syntax only — no code fences, no markdown, no explanation
- Use the Shopify reference terminology above for all Shopify-side node labels
- Max ~18 nodes per diagram for readability
- Valid Mermaid syntax only
- Subgraph labels must use quoted strings
- Edge labels must be single-line — no newlines inside |"..."| labels
- Parentheses in edge labels must be inside quoted strings: |"Bulk Op (batch)"| not |Bulk Op (batch)|
- Never use raw parentheses, brackets, or special characters in unquoted edge labels"""


_SHOPIFY_DEV_PARAMS = StdioServerParameters(
    command="/opt/dev/bin/devx",
    args=["mcp"],
)

_GWORKSPACE_PARAMS = StdioServerParameters(
    command="/Users/philipbloch/.config/gworkspace-mcp/run-mcp.sh",
    args=[],
)


async def _query_shopify_mcp(queries: list[str]) -> str:
    """Spawn shopify-dev MCP server and run vault_search + grokt_search for each query."""
    results = []
    try:
        async with stdio_client(_SHOPIFY_DEV_PARAMS) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                for query in queries:
                    for tool in ("vault_search", "grokt_search"):
                        try:
                            result = await session.call_tool(tool, {"query": query, "top_k": 3})
                            for block in result.content:
                                text = getattr(block, "text", None)
                                if text and text.strip():
                                    # Truncate each result to 1500 chars to stay within token limits
                                    results.append(f"[{tool} — {query}]\n{text.strip()[:1500]}")
                        except Exception as e:
                            print(f"MCP {tool} failed for '{query}': {e}")
    except Exception as e:
        print(f"MCP session error: {e}")
    return "\n\n---\n\n".join(results)


def fetch_shopify_mcp_context(source_platform, shopify_tier, architecture_style, key_systems):
    """Build targeted queries from form inputs and fetch Shopify reference context via MCP."""
    queries = [
        f"{source_platform} to {shopify_tier} migration",
        f"{architecture_style} storefront {shopify_tier} integration",
    ]
    for system in key_systems[:3]:
        queries.append(f"{system} Shopify integration API")

    try:
        raw = asyncio.run(_query_shopify_mcp(queries))
    except Exception as e:
        print(f"MCP context fetch failed: {e}")
        return ""

    if not raw.strip():
        return ""
    # Cap total MCP context at 12,000 chars (~3,000 tokens) to stay within model limits
    raw = raw[:12000]
    return (
        "\n\n## Shopify Reference Context (fetched from internal MCP)\n"
        "Use the following Shopify documentation and code patterns to improve accuracy "
        "of API names, integration patterns, and migration guidance in the diagrams:\n\n"
        + raw
    )


async def _drive_search(query: str) -> list[dict]:
    """Search Google Drive via gworkspace MCP."""
    files = []
    try:
        safe_query = query.replace("'", "\\'")
        drive_query = f"name contains '{safe_query}' or fullText contains '{safe_query}'"
        async with stdio_client(_GWORKSPACE_PARAMS) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("search_drive", {"query": drive_query})
                for block in result.content:
                    text = getattr(block, "text", None)
                    if not text:
                        continue
                    # Try JSON first
                    try:
                        data = json.loads(text)
                        raw = data if isinstance(data, list) else data.get("files", [])
                        for f in raw:
                            files.append({
                                "id":        f.get("id", ""),
                                "name":      f.get("name", f.get("title", "Untitled")),
                                "mime_type": f.get("mimeType", f.get("mime_type", "")),
                                "modified":  f.get("modifiedTime", f.get("modified", "")),
                            })
                    except (json.JSONDecodeError, TypeError):
                        # Parse markdown table rows: | name | type | ... |
                        import re
                        for line in text.splitlines():
                            m = re.search(r'\[([^\]]+)\]\([^)]*[?&/](?:id=|d/)([a-zA-Z0-9_-]{20,})', line)
                            if m:
                                files.append({"id": m.group(2), "name": m.group(1), "mime_type": "", "modified": ""})
    except Exception as e:
        print(f"Drive search error: {e}")
    return files


async def _drive_fetch(file_id: str) -> str:
    """Fetch file content from Google Drive via gworkspace MCP."""
    try:
        async with stdio_client(_GWORKSPACE_PARAMS) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("read_file", {"file_id": file_id, "format": "text"})
                parts = [
                    getattr(block, "text", "").strip()
                    for block in result.content
                    if getattr(block, "text", "").strip()
                ]
                return "\n\n".join(parts)
    except Exception as e:
        print(f"Drive fetch error: {e}")
        return ""


@app.route("/drive-search", methods=["POST"])
def drive_search():
    data = request.json or {}
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400
    try:
        files = asyncio.run(_drive_search(query))
        return jsonify({"files": files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/drive-fetch", methods=["POST"])
def drive_fetch():
    data = request.json or {}
    file_id = data.get("file_id", "").strip()
    file_name = data.get("file_name", "Untitled")
    if not file_id:
        return jsonify({"error": "file_id is required"}), 400
    try:
        text = asyncio.run(_drive_fetch(file_id))
        if not text.strip():
            return jsonify({"error": "Could not extract text from this file. Try downloading and uploading as PDF."}), 400
        return jsonify({"text": text, "name": file_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/")
def index():
    prefill = {}

    # ?drive=<google-drive-url> — pre-fill drive URL so the app auto-loads it
    drive_url = request.args.get("drive", "").strip()
    if drive_url:
        prefill["drive_url"] = drive_url

    # ?pdf=/path/to/file.pdf — extract server-side and inject as pre-filled text
    if not prefill.get("drive_url"):
        pdf_path = request.args.get("pdf", "").strip()
        if pdf_path and os.path.isfile(pdf_path) and pdf_path.lower().endswith(".pdf"):
            try:
                reader = PdfReader(pdf_path)
                pages = [page.extract_text() or "" for page in reader.pages]
                text = "\n\n".join(p.strip() for p in pages if p.strip())
                if text.strip():
                    prefill["context"] = text
                    prefill["pdf_name"] = os.path.basename(pdf_path)
            except Exception as e:
                print(f"PDF pre-fill error: {e}")

    # ?context=... — plain text pre-fill
    if not prefill.get("context") and not prefill.get("drive_url"):
        ctx = request.args.get("context", "").strip()
        if ctx:
            prefill["context"] = ctx

    # Other params
    for key in ("source", "tier", "arch"):
        val = request.args.get(key, "").strip()
        if val:
            prefill[key] = val

    return render_template("index.html", prefill=prefill)


@app.route("/generate", methods=["POST"])
def generate():
    _SOURCE_LABELS = {
        "sfcc": "Salesforce Commerce Cloud (SFCC)",
        "magento": "Magento / Adobe Commerce",
        "commercetools": "Commercetools",
        "sap": "SAP Hybris / CX Commerce",
        "hcl": "HCL Commerce / WebSphere",
        "oracle": "Oracle ATG / CX Commerce",
        "centra": "Centra / Custom Headless",
        "bigcommerce": "BigCommerce",
        "woocommerce": "WooCommerce",
        "bespoke": "Bespoke / Legacy Platform",
        "other": "Other Platform",
    }
    _TIER_LABELS = {
        "plus": "Shopify Plus",
        "enterprise": "Shopify Enterprise (Commerce Components by Shopify)",
    }
    _ARCH_LABELS = {
        "headed": "Headed (Liquid / Online Store 2.0)",
        "hydrogen": "Headless — Hydrogen + Oxygen",
        "nextjs": "Headless — Next.js on Vercel + Shopify Storefront API",
        "nuxt": "Headless — NuxtJS + Shopify Storefront API",
        "blended": "Blended — Headed theme + Hydrogen headless sections",
    }

    data = request.json or {}
    description = data.get("description", "").strip()
    raw_source = data.get("source_platform", "")
    raw_tier   = data.get("shopify_tier", "")
    raw_arch   = data.get("architecture_style", "")
    source_platform    = _SOURCE_LABELS.get(raw_source, raw_source) or "Unknown platform"
    shopify_tier       = _TIER_LABELS.get(raw_tier, raw_tier)       or "Shopify Plus"
    architecture_style = _ARCH_LABELS.get(raw_arch, raw_arch)       or "Headed (Liquid theme)"
    key_systems = data.get("key_systems", [])

    if not description:
        return jsonify({"error": "Description is required"}), 400

    systems_str = ", ".join(key_systems) if key_systems else "to be determined"

    mcp_context = fetch_shopify_mcp_context(source_platform, shopify_tier, architecture_style, key_systems)

    user_message = f"""Generate Shopify migration architecture diagrams for this project.

**Source Platform (migrating FROM)**: {source_platform}
**Target Shopify Tier**: {shopify_tier}
**Storefront Architecture**: {architecture_style}
**Enterprise Systems in Scope**: {systems_str}

**Project Description**:
{description}

Generate all five diagrams (target_architecture, data_flow, integration_map, migration_phases, sequence) tailored precisely to this migration context. Use the actual systems mentioned and reflect the source platform's migration patterns.{mcp_context}"""

    system = SYSTEM_PROMPT + "\n\nReturn your response as a single JSON object with keys: target_architecture, data_flow, integration_map, migration_phases, sequence. Each value is the raw Mermaid syntax string. No prose, no code fences — just the JSON object."
    text = _call_claude(system, user_message)
    # Strip any accidental markdown code fences
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]
    diagrams = json.loads(text)
    return jsonify(diagrams)


@app.route("/extract-pdf", methods=["POST"])
def extract_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    reader = PdfReader(io.BytesIO(file.read()))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(p.strip() for p in pages if p.strip())

    if not text.strip():
        return jsonify({"error": "Could not extract text from this PDF — it may be scanned or image-based."}), 400

    return jsonify({"text": text, "pages": len(reader.pages)})


@app.route("/save", methods=["POST"])
def save():
    data = request.json or {}
    description = data.get("description", "").strip()
    diagrams = data.get("diagrams", [])
    project_name = data.get("project_name", "").strip()

    if not diagrams:
        return jsonify({"error": "No diagrams to save"}), 400

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in project_name).strip()
    folder_name = f"{safe_name}_{timestamp}" if safe_name else timestamp
    base_dir = os.path.dirname(os.path.abspath(__file__))
    save_dir = os.path.join(base_dir, "diagrams", folder_name)
    os.makedirs(save_dir, exist_ok=True)

    if description:
        with open(os.path.join(save_dir, "description.txt"), "w") as f:
            f.write(description)

    for diagram in diagrams:
        dtype = diagram.get("type", "diagram")
        mmd = diagram.get("mmd", "")
        png_base64 = diagram.get("png_base64", "")

        if mmd:
            with open(os.path.join(save_dir, f"{dtype}.mmd"), "w") as f:
                f.write(mmd)

        if png_base64:
            png_data = base64.b64decode(png_base64.split(",", 1)[-1])
            with open(os.path.join(save_dir, f"{dtype}.png"), "wb") as f:
                f.write(png_data)

    return jsonify({"path": save_dir, "timestamp": timestamp})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port)
