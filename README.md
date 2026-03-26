# JSON to live CSV Worker

Cloudflare Worker, der Shopify-Produkt-JSON live als CSV ausgibt und auf der Startseite ein kleines Dashboard bereitstellt.

## Startseite

Die Root-URL zeigt ein Dashboard mit:

- Eingabefeld fuer eine oder mehrere Shopify-Produkt-JSON-URLs
- Vorschau-Button
- Download-Button fuer die CSV
- direkter Anzeige der generierten Feed-URL

Ohne Eingabe wird diese Standard-URL verwendet:

`https://kleineskraftwerk.de/products/deal-kleines-kraftwerk-xl-2000wp-quattro-mit-optionaler-halterung-und-anker-solarbank-3-e2700-pro.json`

## Direkter CSV-Feed

Die CSV selbst liegt unter `/feed.csv`.

Beispiel mit einer Produkt-URL:

```text
https://DEIN-WORKER.workers.dev/feed.csv?url=https://shop.de/products/produkt-a.json
```

Beispiel mit mehreren Produkt-URLs:

```text
https://DEIN-WORKER.workers.dev/feed.csv?url=https://shop.de/products/produkt-a.json&url=https://shop.de/products/produkt-b.json
```

## Vorschau-API

Fuer die Dashboard-Vorschau nutzt der Worker den JSON-Endpunkt `/api/products`.
