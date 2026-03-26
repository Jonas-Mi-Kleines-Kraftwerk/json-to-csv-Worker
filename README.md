# JSON to live CSV Worker

Cloudflare Worker, der Shopify-Produkt-JSON live als CSV ausgibt.

## Default-Aufruf

Ohne Query-Parameter wird diese URL verwendet:

`https://kleineskraftwerk.de/products/deal-kleines-kraftwerk-xl-2000wp-quattro-mit-optionaler-halterung-und-anker-solarbank-3-e2700-pro.json`

## Mehrere Produkte

Mehrere Shopify-Produkt-JSON-URLs kannst du per `url`-Parameter übergeben:

```text
https://DEIN-WORKER.workers.dev/?url=https://shop.de/products/produkt-a.json&url=https://shop.de/products/produkt-b.json
```

Der Worker antwortet immer mit einer CSV-Datei im Format `text/csv; charset=utf-8`.
