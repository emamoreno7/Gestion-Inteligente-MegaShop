# Registro de Errores y Soluciones

## 2026-09-01 — Error de clasificación de rubros (tildes)
- **Síntoma:** En la tabla de vista previa, productos de juguetería se mostraban como "bazar".
- **Causa raíz:** El `value` del `<select>` usaba `c.name.toLowerCase()` (ej. "juguetería" con tilde), mientras que el clasificador devolvía "jugueteria" sin tilde. El navegador no encontraba la opción y caía silenciosamente a la primera (Bazar).
- **Solución:** Se implementó `toSlug()` normalizando tildes. Se usó tanto en `value` como en las `option` del select.
- **Archivo:** `src/app/import/page.tsx`.

## 2026-09-01 — Costo unitario en 0
- **Síntoma:** El OCR no extraía precios unitarios.
- **Causa:** El prompt no especificaba claramente que la columna "Precio unit." debía mapearse a `cost_price` y normalizar formato.
- **Solución:** Se mejoró el prompt del OCR y se aplicó `normalizeNumber` en el frontend.
- **Estado:** Parcialmente resuelto; puede requerir revisión manual.

## 2026-09-01 — Tabla no mostraba inputs/selects
- **Síntoma:** La tabla aparecía vacía o solo texto, mientras el modal sí mostraba datos.
- **Causa:** Múltiples reemplazos parciales del archivo `page.tsx` dejaron versiones inconsistentes de la tabla.
- **Solución:** Se estandarizó la tabla con inputs controlados, key estable y `toSlug`.
- **Archivo:** `src/app/import/page.tsx`.

## 2026-09-01 — Modelo Groq descontinuado
- **Síntoma:** Error 400 "model_decommissioned" para `llama-3.2-90b-vision-preview` y `llama-3.2-11b-vision-preview`.
- **Causa:** Modelos fuera de servicio.
- **Solución:** Se cambió a `qwen/qwen3.8-27b` (visión) y `openai/gpt-oss-20b` para texto (luego `qwen/qwen3.8-27b` por límite de tokens).
- **Archivos:** `src/app/api/import/ocr/route.ts`, `src/app/api/import/classify/route.ts`.

## 2026-09-01 — Deploy falla por falta de env vars
- **Síntoma:** Build error en Vercel: `GROQ_API_KEY is missing`.
- **Causa:** Variables de entorno no configuradas en Vercel.
- **Solución:** Agregar `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `GROQ_TEXT_MODEL` en Vercel → Settings → Environment Variables.
- **Referencia:** Deploy exitoso tras agregarlas.
## 2026-09-01 — Falta de feedback visual en carga/importación
- **Síntoma:** Al guardar un archivo duplicado no aparecía mensaje de error; el input de archivo era poco visible.
- **Causa:** El mensaje de error se renderizaba fuera del modal, por lo que no era visible; el input nativo no tenía estilos ni etiqueta clara.
- **Solución:** Se movió el error al modal y se reemplazó el input por un label con estilo de botón.
- **Archivo:** `src/app/import/page.tsx`.

## 2026-09-01 — Idempotencia de carga masiva
- **Síntoma:** Un mismo remito podía importarse dos veces, duplicando stock.
- **Causa:** No existía validación de duplicados en la carga masiva.
- **Solución:** Se agregó columna `source_hash` a `bulk_imports`, restricción única y verificación en `import_products`.
- **Archivos:** `bulk_imports`, función `import_products`, endpoint `/api/import/save`, frontend.
## 2026-09-01 — Error de clave duplicada al aprobar cargas
- **Síntoma:** `duplicate key value violates unique constraint "products_sku_key"` al aprobar una carga pendiente.
- **Causa:** Productos con SKU repetido dentro de la misma carga o de cargas anteriores.
- **Solución:** Se reescribió `approve_bulk_import` para agrupar por SKU/nombre, sumar cantidades y reutilizar productos existentes.
- **Archivo:** función `approve_bulk_import`.

## 2026-09-01 — Error de columna `updated_at` inexistente en `bulk_imports`
- **Síntoma:** `column "updated_at" of relation "bulk_imports" does not exist` al aprobar.
- **Causa:** La tabla no tiene columna `updated_at`; se intentaba actualizar en la función de aprobación.
- **Solución:** Se eliminó la actualización de `updated_at` de la función.
- **Archivo:** función `approve_bulk_import`.

## 2026-09-01 — Error de tipos en `or` dentro de función SQL
- **Síntoma:** `argument of OR must be type boolean, not type text`.
- **Causa:** Uso incorrecto de `or` entre textos en vez de `coalesce`.
- **Solución:** Se reemplazó por `coalesce` para elegir el primer valor no nulo.
- **Archivo:** función `approve_bulk_import`.
## 2026-09-01 — Error al leer archivos CSV/XLSX
- **Síntoma:** "Error al leer el archivo" al subir CSV/XLSX.
- **Causa:** `classifyByKeywords` recibía `name` undefined por columnas en español o mayúsculas.
- **Solución:** Se normalizaron columnas con detección flexible y se robusteció la función de clasificación.
- **Archivos:** `src/app/import/page.tsx`, `src/lib/classify.ts`.

## 2026-09-01 — Valores de costo/venta en 0 en carga masiva
- **Síntoma:** No se veían precios al importar CSV/XLSX.
- **Causa:** Candidatos de columnas insuficientes y `normalizeNumber` no manejaba formato AR.
- **Solución:** Ampliación de candidatos y normalización robusta de moneda.
- **Archivo:** `src/app/import/page.tsx`.
## 2026-09-02 — Error en /api/pending por filtros anidados
- **Síntoma:** GET /api/pending devolvía 500.
- **Causa:** Uso de `.not('product', ...)` sobre relaciones en Supabase JS.
- **Solución:** Se reemplazó por `!inner` en el select y filtrado en JS.
- **Archivo:** `src/app/api/pending/route.ts`.

## 2026-09-02 — Productos sin precio no aparecían en pendientes
- **Síntoma:** POS mostraba artículos sin precio, pero /pending decía que no había nada.
- **Causa:** Faltaba una cola para productos con rubro y costo pero `price_status='pending'`.
- **Solución:** Se agregó recálculo masivo con `recalculate_pending_prices`.
- **Archivos:** RPC en Supabase, `src/app/api/pending/recalculate/route.ts`, `src/app/pending/page.tsx`.
## 2026-09-02 — Venta con precios congelados
- **Síntoma:** El POS usaba unit_price enviado por el frontend, sin validar contra product_location_data.
- **Causa:** Función create_sale desactualizada tras migrar precios a product_location_data.
- **Solución:** Se reescribió create_sale para leer precios/costos desde product_location_data y congelarlos en sale_items.
- **Archivos:** función SQL `create_sale`, tabla `sale_items`.
## 2026-09-02 — Nombres genéricos en historial de ventas
- **Síntoma:** "Producto" o "Usuario" en vez de nombres reales.
- **Causa:** Joins embebidos de Supabase devolvían arrays; no se mapeaban correctamente.
- **Solución:** Se cargaron productos y usuarios por separado y se mapearon con Map.
- **Archivos:** `src/app/sales/history/page.tsx`.

## 2026-09-02 — Validación de devolución
- **Síntoma:** Se necesitaba verificar que create_return rechazara productos que no están en la venta.
- **Causa:** Se validó comparando product_id del movimiento con sale_items.
- **Solución:** Confirmado correcto; no se requirió cambio.
- **Archivos:** función SQL `create_return`.
## 2026-09-02 — Función no encontrada en schema cache
- **Síntoma:** Error "Could not find the function public.confirm_pending_sale(p_sale_id) in the schema cache".
- **Causa:** Sobrecarga con parámetros default no resuelta por PostgREST.
- **Solución:** Se creó `confirm_pending_sale(uuid)` con un solo parámetro.
- **Archivos:** función SQL, endpoint `/api/sales/confirm`.
## 2026-09-03 — Rediseño visual integral
- **Síntoma:** Ninguno, pero se realizó cambio masivo de UI.
- **Causa:** Mejora estética y de experiencia de usuario.
- **Solución:** Se aplicó glassmorphism en todos los módulos manteniendo lógica de negocio intacta.
- **Archivos:** Todos los `page.tsx` de `/app`, componentes globales.