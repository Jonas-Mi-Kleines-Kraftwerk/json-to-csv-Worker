const DEFAULT_PRODUCT_JSON_URL =
  "https://kleineskraftwerk.de/products/deal-kleines-kraftwerk-xl-2000wp-quattro-mit-optionaler-halterung-und-anker-solarbank-3-e2700-pro.json";

const PRODUCT_LINK_SUFFIX = "?pub=home-and-smart";
const CSV_HEADERS = [
  "Product ID",
  "Title",
  "SKU",
  "Price",
  "Compare At Price",
  "Image URL",
  "Product Link",
];

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);

    try {
      if (requestUrl.pathname === "/feed.csv") {
        const products = await fetchProducts(requestUrl);
        const csv = toCsv(products);

        return new Response(csv, {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "cache-control": "no-store",
            "content-disposition": 'attachment; filename="shopify-live-feed.csv"',
          },
        });
      }

      if (requestUrl.pathname === "/api/products") {
        const products = await fetchProducts(requestUrl);

        return Response.json(
          {
            count: products.length,
            products,
          },
          {
            headers: {
              "cache-control": "no-store",
            },
          }
        );
      }

      return new Response(renderDashboard(requestUrl), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown worker error";

      if (requestUrl.pathname === "/feed.csv" || requestUrl.pathname === "/api/products") {
        return new Response(`Failed to generate CSV: ${message}\n`, {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }

      return new Response(renderDashboard(requestUrl, message), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
  },
};

async function fetchProducts(requestUrl) {
  const productJsonUrls = getProductJsonUrls(requestUrl);
  return Promise.all(productJsonUrls.map(fetchProduct));
}

function getProductJsonUrls(requestUrl) {
  const urls = requestUrl.searchParams.getAll("url").filter(Boolean);
  return urls.length > 0 ? urls : [DEFAULT_PRODUCT_JSON_URL];
}

async function fetchProduct(productJsonUrl) {
  validateProductJsonUrl(productJsonUrl);

  const response = await fetchShopifyProductJson(productJsonUrl);

  if (!response.ok) {
    throw new Error(
      `Shopify fetch failed for ${productJsonUrl} with status ${response.status}`
    );
  }

  const payload = await response.json();
  const product = payload?.product;

  if (!product) {
    throw new Error(`Missing product data in ${productJsonUrl}`);
  }

  const firstVariant = product.variants?.[0] ?? {};
  const imageUrl =
    product.image?.src ?? product.images?.[0]?.src ?? product.images?.[0] ?? "";

  return {
    productId: product.id ?? "",
    title: product.title ?? "",
    sku: firstVariant.sku ?? "",
    price: firstVariant.price ?? "",
    compareAtPrice: firstVariant.compare_at_price ?? "",
    imageUrl,
    productLink: buildProductLink(productJsonUrl, product),
    sourceJsonUrl: productJsonUrl,
  };
}

async function fetchShopifyProductJson(productJsonUrl) {
  const browserUrl = new URL(productJsonUrl);
  const attempts = [
    {
      accept: "application/json",
    },
    {
      accept:
        "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      referer: `${browserUrl.origin}/`,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  ];

  let lastResponse = null;

  for (const headers of attempts) {
    const response = await fetch(productJsonUrl, {
      method: "GET",
      redirect: "follow",
      headers,
    });

    if (response.ok) {
      return response;
    }

    lastResponse = response;

    if (response.status !== 403) {
      return response;
    }
  }

  return lastResponse;
}

function validateProductJsonUrl(productJsonUrl) {
  const url = new URL(productJsonUrl);

  if (url.protocol !== "https:") {
    throw new Error(`Only HTTPS URLs are allowed: ${productJsonUrl}`);
  }

  if (!url.pathname.endsWith(".json")) {
    throw new Error(`URL must point to a Shopify product JSON: ${productJsonUrl}`);
  }
}

function buildProductLink(productJsonUrl, product) {
  if (typeof product.handle === "string" && product.handle.length > 0) {
    const sourceUrl = new URL(productJsonUrl);
    return `${sourceUrl.origin}/products/${product.handle}${PRODUCT_LINK_SUFFIX}`;
  }

  return productJsonUrl.replace(/\.json$/i, PRODUCT_LINK_SUFFIX);
}

function toCsv(products) {
  const rows = [
    CSV_HEADERS,
    ...products.map((product) => [
      product.productId,
      product.title,
      product.sku,
      product.price,
      product.compareAtPrice,
      product.imageUrl,
      product.productLink,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function renderDashboard(requestUrl, errorMessage = "") {
  const urls = getProductJsonUrls(requestUrl);
  const textareaValue = urls.join("\n");
  const baseUrl = requestUrl.origin;
  const initialFeedUrl = buildEndpointUrl(`${baseUrl}/feed.csv`, urls);
  const escapedTextareaValue = escapeHtml(textareaValue);
  const escapedErrorMessage = escapeHtml(errorMessage);
  const defaultUrlLabel = escapeHtml(DEFAULT_PRODUCT_JSON_URL);

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JSON to Live CSV</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe7;
        --panel: rgba(255, 252, 247, 0.92);
        --text: #1f1a17;
        --muted: #6f6257;
        --line: rgba(87, 66, 47, 0.14);
        --accent: #0f766e;
        --accent-strong: #115e59;
        --shadow: 0 24px 70px rgba(57, 41, 26, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(210, 243, 238, 0.8), transparent 30%),
          radial-gradient(circle at top right, rgba(255, 224, 188, 0.65), transparent 30%),
          linear-gradient(180deg, #f8f5ef, var(--bg));
      }

      .wrap {
        width: min(1040px, calc(100% - 32px));
        margin: 40px auto;
      }

      .hero {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .hero-top {
        padding: 28px 28px 12px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(2rem, 6vw, 4rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 20px;
        padding: 20px 28px 28px;
      }

      .card {
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 22px;
      }

      label {
        display: block;
        font-weight: 700;
        margin-bottom: 10px;
      }

      textarea,
      input {
        width: 100%;
        border: 1px solid rgba(87, 66, 47, 0.18);
        border-radius: 16px;
        padding: 14px 16px;
        font: inherit;
        color: var(--text);
        background: rgba(255, 255, 255, 0.96);
      }

      textarea {
        min-height: 220px;
        resize: vertical;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
      }

      button,
      .button-link {
        appearance: none;
        border: none;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
      }

      button:hover,
      .button-link:hover {
        transform: translateY(-1px);
      }

      .primary {
        color: white;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      }

      .secondary {
        color: var(--text);
        background: rgba(16, 185, 129, 0.12);
      }

      .ghost {
        color: var(--text);
        background: rgba(255, 255, 255, 0.86);
        border: 1px solid var(--line);
      }

      .hint,
      .small {
        color: var(--muted);
        font-size: 0.94rem;
      }

      .small {
        margin-top: 12px;
      }

      .error {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(185, 28, 28, 0.18);
        background: rgba(254, 226, 226, 0.92);
        color: #991b1b;
      }

      .feed-box {
        margin-top: 14px;
      }

      .status {
        min-height: 24px;
        margin-top: 14px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
        font-size: 0.95rem;
      }

      th,
      td {
        text-align: left;
        vertical-align: top;
        padding: 12px 10px;
        border-bottom: 1px solid var(--line);
      }

      th {
        color: var(--muted);
        font-size: 0.82rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      code {
        font-family: "SFMono-Regular", "Menlo", monospace;
        font-size: 0.9em;
      }

      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
          padding: 16px;
        }

        .hero-top {
          padding: 22px 18px 8px;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <div class="hero-top">
          <h1>JSON to Live CSV</h1>
          <p>Fuege eine oder mehrere Shopify-Produkt-JSON-URLs ein, pruefe die Daten als Vorschau und erzeuge dann einen direkten CSV-Feed zum Download oder Einbinden.</p>
        </div>
        <div class="grid">
          <section class="card">
            <label for="urls">Shopify Produkt-JSON URLs</label>
            <textarea id="urls" placeholder="Eine URL pro Zeile">${escapedTextareaValue}</textarea>
            <div class="toolbar">
              <button class="primary" id="previewButton" type="button">Vorschau laden</button>
              <a class="button-link secondary" id="downloadButton" href="${escapeHtml(
                initialFeedUrl
              )}">CSV herunterladen</a>
              <a class="button-link ghost" id="feedButton" href="${escapeHtml(
                initialFeedUrl
              )}" target="_blank" rel="noreferrer">Feed URL oeffnen</a>
            </div>
            <p class="small">Standardwert: <code>${defaultUrlLabel}</code></p>
            ${
              errorMessage
                ? `<div class="error">${escapedErrorMessage}</div>`
                : ""
            }
          </section>
          <aside class="card">
            <label for="feedUrl">Generierte CSV-URL</label>
            <div class="feed-box">
              <input id="feedUrl" value="${escapeHtml(initialFeedUrl)}" readonly />
            </div>
            <p class="small">Direkter CSV-Endpunkt: <code>/feed.csv</code></p>
            <div class="status hint" id="status">Bereit fuer Vorschau oder Download.</div>
            <div id="preview"></div>
          </aside>
        </div>
      </section>
    </main>
    <script>
      const textarea = document.getElementById("urls");
      const feedUrlInput = document.getElementById("feedUrl");
      const downloadButton = document.getElementById("downloadButton");
      const feedButton = document.getElementById("feedButton");
      const previewButton = document.getElementById("previewButton");
      const preview = document.getElementById("preview");
      const status = document.getElementById("status");

      function getUrls() {
        return textarea.value
          .split(/\\n+/)
          .map((value) => value.trim())
          .filter(Boolean);
      }

      function buildUrl(pathname) {
        const url = new URL(pathname, window.location.origin);
        const urls = getUrls();

        if (urls.length === 0) {
          urls.push(${JSON.stringify(DEFAULT_PRODUCT_JSON_URL)});
        }

        for (const value of urls) {
          url.searchParams.append("url", value);
        }

        return url.toString();
      }

      function updateLinks() {
        const feedUrl = buildUrl("/feed.csv");
        feedUrlInput.value = feedUrl;
        downloadButton.href = feedUrl;
        downloadButton.setAttribute("download", "shopify-live-feed.csv");
        feedButton.href = feedUrl;
      }

      function renderPreview(products) {
        if (!products.length) {
          preview.innerHTML = "<p class='hint'>Keine Produkte gefunden.</p>";
          return;
        }

        const rows = products
          .map((product) => \`
            <tr>
              <td>\${escapeHtml(product.title || "")}</td>
              <td>\${escapeHtml(product.price || "")}</td>
              <td>\${escapeHtml(product.sku || "")}</td>
            </tr>
          \`)
          .join("");

        preview.innerHTML = \`
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Price</th>
                <th>SKU</th>
              </tr>
            </thead>
            <tbody>\${rows}</tbody>
          </table>
        \`;
      }

      async function loadPreview() {
        updateLinks();
        status.textContent = "Vorschau wird geladen...";
        preview.innerHTML = "";

        try {
          const response = await fetch(buildUrl("/api/products"));

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Preview request failed");
          }

          const data = await response.json();
          status.textContent = \`\${data.count} Produkt(e) erfolgreich geladen.\`;
          renderPreview(data.products || []);
        } catch (error) {
          status.textContent = error.message;
          preview.innerHTML = "";
        }
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      textarea.addEventListener("input", updateLinks);
      previewButton.addEventListener("click", loadPreview);
      updateLinks();
    </script>
  </body>
</html>`;
}

function buildEndpointUrl(baseUrl, urls) {
  const url = new URL(baseUrl);
  const inputUrls = urls.length > 0 ? urls : [DEFAULT_PRODUCT_JSON_URL];

  for (const value of inputUrls) {
    url.searchParams.append("url", value);
  }

  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
