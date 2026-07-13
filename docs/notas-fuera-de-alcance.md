# Notas fuera de alcance del SRS

## Precio de commodities (oro/plata) — Metals-API

El SRS (sección 3.1, RF-013) no especifica una fuente de precios para
commodities. Para no dejar `GOLD`/`WTI` sin dato, `fetch-market-prices`
usa por defecto el precio del ETF **GLD** (SPDR Gold Shares) como proxy
del oro spot — es una aproximación razonable pero **no es idéntica** al
precio spot real (el ETF tiene un pequeño *tracking error* respecto al
metal físico).

Si se configura el secret `METALS_API_KEY` (plan gratuito en
[metals-api.com](https://metals-api.com)), la función usa esa fuente en
su lugar para `GOLD` (XAU) — no está integrada por defecto porque no
formaba parte del alcance original del SRS y no se contaba con esa key
al momento de implementar.

`WTI` (petróleo) no tiene proxy vía ETF configurado todavía; si falla la
única fuente disponible, cae al precio de prueba (`is_test_data = true`).
