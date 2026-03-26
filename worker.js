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
    const productJsonUrls = getProductJsonUrls(requestUrl);

    try {
      const products = await Promise.all(productJsonUrls.map(fetchProduct));
      const csv = toCsv(products);

      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown worker error";

      return new Response(`Failed to generate CSV: ${message}\n`, {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
  },
};

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
  };
}

async function fetchShopifyProductJson(productJsonUrl) {
  const browserUrl = new URL(productJsonUrl);
  const attempts = [
    {
      accept: "application/json",
    },
    {
      accept: "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
