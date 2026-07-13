-- ============================================================
-- Market Intelligence AI — Seed inicial
-- Roles (literales del SRS §16.2) + Activos de prueba (is_test_data via asset)
-- + Noticias de prueba (is_test_data = true, RN-08)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. ROLES  (valores exactos del SRS §16.2)
-- ─────────────────────────────────────────────
insert into roles (name, description) values
  ('Administrador', 'Gestiona usuarios, roles, configuración de fuentes de datos y parámetros del sistema.'),
  ('Analista',      'Revisa noticias, valida señales generadas por IA, gestiona watchlists y alertas.'),
  ('Supervisor',    'Aprueba/escala briefings, revisa el trabajo de los analistas antes de compartir con clientes.'),
  ('Invitado',      'Acceso de solo lectura a noticias, señales y briefings públicos/demostrativos.')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────
-- 2. ACTIVOS DE PRUEBA  (SRS §16.4 — is_test_data implícito en contexto demo)
-- Tipos exactos: Acción / Cripto / ETF / Bono / Commodity / Divisa / Otro
-- ─────────────────────────────────────────────
insert into assets (symbol, name, type, sector) values
  ('AAPL',  'Apple Inc.',                  'Acción',    'Tecnología'),
  ('MSFT',  'Microsoft Corporation',       'Acción',    'Tecnología'),
  ('GOOGL', 'Alphabet Inc.',               'Acción',    'Tecnología'),
  ('AMZN',  'Amazon.com Inc.',             'Acción',    'Consumo'),
  ('TSLA',  'Tesla Inc.',                  'Acción',    'Automotriz'),
  ('JPM',   'JPMorgan Chase & Co.',        'Acción',    'Financiero'),
  ('XOM',   'Exxon Mobil Corporation',     'Acción',    'Energía'),
  ('BTC',   'Bitcoin',                     'Cripto',    'Criptoactivos'),
  ('ETH',   'Ethereum',                    'Cripto',    'Criptoactivos'),
  ('SOL',   'Solana',                      'Cripto',    'Criptoactivos'),
  ('SPY',   'SPDR S&P 500 ETF Trust',      'ETF',       'Índices'),
  ('QQQ',   'Invesco QQQ Trust',           'ETF',       'Tecnología'),
  ('GLD',   'SPDR Gold Shares',            'ETF',       'Commodities'),
  ('GOLD',  'Oro spot',                    'Commodity', 'Metales preciosos'),
  ('WTI',   'Petróleo crudo WTI',          'Commodity', 'Energía'),
  ('EURUSD','Euro / Dólar estadounidense', 'Divisa',    'Forex'),
  ('USDMXN','Dólar / Peso mexicano',       'Divisa',    'Forex'),
  ('TLT',   'iShares 20+ Year T-Bond ETF','Bono',       'Deuda pública')
on conflict (symbol) do nothing;

-- ─────────────────────────────────────────────
-- 3. NOTICIAS DE PRUEBA  (is_test_data = true, RN-08)
-- Al menos 2 fuentes distintas (RF-001, criterio HU-01)
-- ─────────────────────────────────────────────
insert into news (title, content, source, published_at, sector, is_test_data) values

-- Fuente 1: Feed de prueba A (simulado NewsAPI)
('La Fed mantiene tasas sin cambios en reunión de julio 2026',
 'La Reserva Federal de Estados Unidos decidió en su reunión de julio de 2026 mantener la tasa de fondos federales en el rango del 5.25%–5.50%, señalando que aún no existen condiciones suficientes para iniciar un ciclo de recortes. El presidente Jerome Powell indicó que la institución seguirá siendo dependiente de los datos y que la inflación, aunque moderada, sigue por encima del objetivo del 2%.',
 'Feed de prueba — NewsAPI Mock',
 now() - interval '2 hours',
 'Financiero',
 true),

('Bitcoin supera los $75,000 tras aprobación de nuevos ETFs spot en Europa',
 'El precio de Bitcoin alcanzó un nuevo máximo histórico de $75,200 USD luego de que reguladores europeos aprobaran el listado de tres nuevos ETFs spot en mercados de la Unión Europea. Los flujos institucionales hacia el activo digital se aceleraron durante la jornada.',
 'Feed de prueba — NewsAPI Mock',
 now() - interval '5 hours',
 'Criptoactivos',
 true),

('Apple reporta ganancias trimestrales superiores a las expectativas',
 'Apple Inc. (AAPL) publicó resultados del tercer trimestre fiscal 2026 con ingresos de $98.2 mil millones, superando el consenso de analistas de $94.5 mil millones. Las ventas del iPhone crecieron 8% interanual, impulsadas por mercados emergentes en Asia y Latinoamérica. El margen operativo se expandió al 31.4%.',
 'Feed de prueba — NewsAPI Mock',
 now() - interval '1 day',
 'Tecnología',
 true),

('Tesla anuncia expansión de planta en México; acciones suben 4%',
 'Tesla Inc. confirmó la inversión de $2,000 millones de dólares para ampliar su Gigafactory en Monterrey, México. La planta producirá el modelo Cybertruck para mercados latinoamericanos a partir del primer trimestre de 2027. Las acciones de TSLA subieron un 4.2% tras el anuncio.',
 'Feed de prueba — NewsAPI Mock',
 now() - interval '3 hours',
 'Automotriz',
 true),

('Petróleo WTI cae 3% por datos de inventarios en EE.UU.',
 'Los precios del petróleo crudo WTI cayeron un 3.1% tras la publicación del informe semanal de la EIA que mostró un aumento inesperado en los inventarios de crudo de 4.2 millones de barriles. Las expectativas del mercado apuntaban a una reducción de 1.5 millones de barriles.',
 'Feed de prueba — NewsAPI Mock',
 now() - interval '6 hours',
 'Energía',
 true),

-- Fuente 2: Feed de prueba B (simulado Yahoo Finance RSS)
('JPMorgan eleva perspectivas del S&P 500 para cierre de 2026',
 'Estrategas de JPMorgan Chase elevaron su objetivo de precio del S&P 500 a 5,800 puntos para finales de 2026, citando resiliencia económica, moderación de la inflación y solidez de las ganancias corporativas. El banco indicó que el sector tecnológico y el financiero liderarán el crecimiento.',
 'Feed de prueba — Yahoo Finance RSS Mock',
 now() - interval '4 hours',
 'Financiero',
 true),

('El peso mexicano se fortalece ante expectativas de recorte de tasas Banxico',
 'El par USD/MXN operó en mínimos de seis meses, por debajo de 17.20, luego de que funcionarios del Banco de México señalaran la posibilidad de un recorte de 25 puntos base en la reunión de agosto. Analistas del mercado anticipan tres recortes adicionales antes de fin de año.',
 'Feed de prueba — Yahoo Finance RSS Mock',
 now() - interval '8 hours',
 'Forex',
 true),

('Ethereum completa actualización Pectra; desarrolladores anticipan mayor escalabilidad',
 'La red Ethereum completó exitosamente la actualización Pectra, que introduce mejoras significativas en el manejo de blobs de datos y reduce costos de transacción en capas L2. Los desarrolladores esperan un aumento del 40% en la capacidad de procesamiento de la red principal.',
 'Feed de prueba — Yahoo Finance RSS Mock',
 now() - interval '12 hours',
 'Criptoactivos',
 true),

('Microsoft integra Copilot en Office 365; analistas proyectan crecimiento de ingresos cloud',
 'Microsoft anunció la integración completa de Copilot AI en toda la suite Office 365 sin costo adicional para suscriptores Enterprise. Los analistas de Wall Street proyectan un impacto positivo en la retención de clientes y esperan un crecimiento del segmento Intelligent Cloud de entre 18% y 22% para el ejercicio 2027.',
 'Feed de prueba — Yahoo Finance RSS Mock',
 now() - interval '2 days',
 'Tecnología',
 true),

('Oro alcanza $2,450 por onza ante debilidad del dólar y tensiones geopolíticas',
 'El precio del oro spot superó los $2,450 por onza troy, alcanzando su nivel más alto en tres meses. La debilidad del índice DXY, que cedió un 0.8%, y el aumento de tensiones en la región del Mar Rojo impulsaron la demanda de activos de refugio. Los ETFs respaldados por oro registraron entradas netas de $1.2 mil millones en la semana.',
 'Feed de prueba — Yahoo Finance RSS Mock',
 now() - interval '18 hours',
 'Metales preciosos',
 true);
