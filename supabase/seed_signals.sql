-- ============================================================
-- Market Intelligence AI — Señales de prueba (opcional)
-- Vincula señales a las noticias y activos ya sembrados en seed.sql
-- ============================================================

insert into signals (news_id, asset_id, impact, confidence, explanation, risks, suggested_research, status)
select n.id, a.id, v.impact, v.confidence, v.explanation, v.risks, v.suggested_research, v.status
from (values
  ('Bitcoin supera los $75,000 tras aprobación de nuevos ETFs spot en Europa', 'BTC',
   'Positivo', 85,
   'La aprobación de ETFs spot en Europa abre el acceso institucional a una base de inversores significativamente mayor.',
   'Alta volatilidad histórica del activo; posible corrección tras la euforia inicial.',
   'Analizar volumen de trading en ETFs spot europeos; revisar datos on-chain de wallets institucionales.',
   'Pendiente'),

  ('Apple reporta ganancias trimestrales superiores a las expectativas', 'AAPL',
   'Positivo', 78,
   'Los resultados de Apple superan el consenso en ingresos y márgenes operativos, impulsados por el crecimiento del iPhone en mercados emergentes.',
   'Saturación del mercado de smartphones premium; dependencia de la cadena de suministro en Asia.',
   'Comparar márgenes con competidores; revisar guía de gestión para próximo trimestre.',
   'Pendiente'),

  ('Petróleo WTI cae 3% por datos de inventarios en EE.UU.', 'WTI',
   'Negativo', 72,
   'El aumento inesperado de inventarios de crudo señala debilidad en la demanda o aumento de producción.',
   'Posible reducción de producción por parte de la OPEP+ que revierta la tendencia.',
   'Revisar datos de demanda China; monitorear reunión OPEP+ de agosto.',
   'Pendiente'),

  ('Tesla anuncia expansión de planta en México; acciones suben 4%', 'TSLA',
   'Positivo', 80,
   'La confirmación de inversión en la Gigafactory de México amplía la capacidad productiva de Tesla para el mercado latinoamericano.',
   'Posibles retrasos en construcción y permisos; riesgo cambiario USD/MXN.',
   'Analizar cronograma oficial de expansión; revisar el impacto en costos unitarios.',
   'Pendiente'),

  ('Oro alcanza $2,450 por onza ante debilidad del dólar y tensiones geopolíticas', 'GOLD',
   'Positivo', 76,
   'La combinación de un dólar débil y el aumento de tensiones geopolíticas crea condiciones favorables para activos de refugio como el oro.',
   'Estabilización geopolítica súbita; fortalecimiento inesperado del dólar.',
   'Monitorear evolución DXY; revisar posicionamiento de contratos futuros en COMEX.',
   'Pendiente'),

  ('Ethereum completa actualización Pectra; desarrolladores anticipan mayor escalabilidad', 'ETH',
   'Neutral', 61,
   'La actualización Pectra mejora la eficiencia técnica de la red Ethereum, pero su impacto en precio a corto plazo es incierto.',
   'Adopción lenta de mejoras L2; competencia de otras cadenas.',
   'Analizar métricas de adopción en L2; revisar TVL post-actualización.',
   'Pendiente')
) as v(news_title, asset_symbol, impact, confidence, explanation, risks, suggested_research, status)
join news n   on n.title = v.news_title
join assets a on a.symbol = v.asset_symbol
on conflict do nothing;
