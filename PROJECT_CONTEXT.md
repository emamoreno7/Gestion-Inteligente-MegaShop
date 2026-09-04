# Contexto del Proyecto — Mega Shop Rivadavia

## Estado actual (última actualización: 2026-09-01)

### Completado
- Esquema de base de datos en Supabase (todas las tablas, roles, permisos, ubicación piloto, RLS temporal).
- Autenticación con Supabase Auth (login funcional, usuario de prueba `admin@megashop.com`).
- Middleware de protección de rutas (redirige a `/login` si no hay sesión).
- Dashboard básico con botón de logout y enlaces a Catálogo e Importar.
- Página de catálogo (`/catalog`) con listado y alta manual de productos.
- Página de importación (`/import`) con pestañas CSV/Excel y Foto (OCR).
- Integración con Groq para OCR (modelo de visión `qwen/qwen3.8-27b`) y clasificación de rubros.
- Clasificación híbrida: preclasificador por palabras clave (`src/lib/classify.ts`) + IA para casos ambiguos.
- Endpoints `/api/import/classify`, `/api/import/ocr` y `/api/import/save`.
- Función SQL atómica `import_products` con lógica de roles y actualización de stock.
- Modal de auditoría rápida con checkboxes para omitir productos, resumen por rubro y aceptación obligatoria.
- Carpeta `supabase/migrations` versionada.
- Commit y push a GitHub; deploy en Vercel configurado.
- Variables de entorno agregadas en Vercel: `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `GROQ_TEXT_MODEL`.
- Bug de tildes en rubros corregido: `toSlug` para normalizar categorías y que el `select` de la tabla funcione correctamente.
- Tabla de vista previa reorganizada y funcional: Cant. | Producto | Código | Rubro | Costo unit.
- Carga masiva CSV/Excel robusta con detección de columnas en español y normalización de moneda.
- Módulo de Punto de Venta (POS) con carrito, búsqueda y creación de ventas.
- Función SQL `create_sale` que valida stock, registra venta, ítems, pago y movimientos.
- Separación catálogo (`products`) / datos comerciales por sucursal (`product_location_data`).
- Margen por rubro con override por sucursal (`category_margins`).
- Pantalla `/pending` con dos colas: Asignar Rubro y Agregar Costo.
- Recálculo masivo de precios pendientes con rubro + costo + margen.
- POS actualizado para leer precios desde `product_location_data` y bloquear productos sin precio.
- Función `create_sale` actualizada para leer precios/costos desde `product_location_data`.
- `sale_items` con columnas `cost_price`, `original_price`, `modified_by`, `modified_at`.
- Venta completada end-to-end en POS con validación de stock y precio congelado.
- Anulación de ventas (`void_sale`) con motivo obligatorio, control de autoanulación y umbral de monto.
- Devolución parcial (`create_return`) con validación contra lo vendido y lo ya devuelto.
- Historial de ventas (`/sales/history`) con detalle de pagos, devoluciones y anulaciones.
- Fix de visualización de nombres de productos y usuarios en historial.
- Módulo de caja con apertura, cierre y movimientos manuales.
- Integración de caja con ventas en efectivo (trigger `record_cash_sale_on_payment`).
- Pantalla `/cash` con resumen y arqueo simple.
- Flujo de Mercado Pago con venta pendiente y confirmación manual (demo).
- Rediseño visual integral de todo el sistema con estilo glassmorphism táctil.
- Dashboard iPadOS, POS ágil, Stock con KPIs, Pendientes con colas visuales.
- Catálogo con buscador, Importación con zonas drop y OCR, Ventas con tickets detallados.
- Caja con tablero financiero, Configuración tipo Shopify, Login premium.
- RPCs blindadas con autenticación, autorización por permisos, auditoría y manejo de concurrencia:
  - Ventas: create_sale, create_pending_sale, confirm_pending_sale, void_sale, create_return, cancel_pending_sale.
  - Importación: import_products, approve_bulk_import, reject_bulk_import.
  - Caja: open_cash_session, close_cash_session, register_cash_movement.
  - Pendientes: resolve_pending_product, resolve_pending_cost, bulk_assign_categories, recalculate_pending_prices.
- Se agregó auditoría inmutable en `audit_logs` con función `private.log_audit_event`.
- Se aplicaron reglas estrictas de stock, precios y control de pérdidas.
- Módulo de inventario profesional:
  - Conteos físicos (record_stock_count) sin modificar stock.
  - Ajustes de conteo separados (apply_stock_count_adjustment) con verificación de stock sin cambios.
  - Ajustes manuales (manual_stock_adjustment) con tipo, motivo e idempotencia.
  - Stock mínimo por producto (min_stock) y estados visuales.
- RPCs de inventario blindadas con autenticación, permisos y auditoría.
- Endpoints de inventario: /api/inventory/count, /api/inventory/apply-count, /api/inventory/adjust.
- Página /inventory con pestañas Stock, Conteos y Ajustes, y buscador moderno de productos.

### En progreso / parcialmente funcional
- OCR de remitos/fotos: extrae productos, cantidades y costos; la clasificación automática ya funciona bien, pero puede requerir revisión manual en algunos casos.
- Carga masiva CSV/Excel: funcional, falta probar con archivo real de gran volumen.

## Próximos pasos inmediatos
1. Pruebas integrales de inventario (conteo → ajuste → verificación).
2. Reportes ejecutivos: ventas, ticket promedio, productos más vendidos, diferencias de caja.
3. Integración real de Mercado Pago con webhook y QR.
4. Dashboard ejecutivo con métricas en tiempo real.

## Decisiones técnicas relevantes
- Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase + Vercel.
- Base de datos: PostgreSQL en Supabase. RLS habilitado con políticas temporales (`true` para autenticados) — se refinarán según roles.
- Cliente de Supabase en `src/lib/supabase/client.ts` y middleware con `@supabase/ssr`.
- Multi-local embebido en la BD (`location_id` en todas las tablas operativas).
- OCR con Groq usando `qwen/qwen3.8-27b`.
- Clasificación híbrida: `src/lib/classify.ts` con palabras clave + IA para ambiguos.
- Función SQL `import_products` para inserción atómica de productos, movimientos de stock y actualización de stock.
- Normalización de categorías con `toSlug` para evitar mismatch de tildes.

## Reglas no negociables (recordatorio)
- Toda tabla operativa tiene `location_id`.
- Ningún movimiento de stock sin `performed_by`.
- Roles y permisos son datos, no código.
- Atributos de producto en `attributes jsonb`.
- Conteos físicos generan evento propio.
- Idempotencia en carga masiva: columna `source_hash`, restricción única y validación en `import_products`.
- Mejoras de UX en importación: botón claro para cargar archivo/imagen y errores visibles en modal.
- Políticas RLS server-side para roles y location.
- Funciones helper de autorización (`current_role_name`, `current_location_id`, `is_owner_admin`, `has_permission`).
- Trigger `apply_stock_movement` que recalcula `stock_levels` desde `stock_movements`.
- Idempotencia en carga masiva (`source_hash` + restricción única + validación en `import_products`).
- Funciones de aprobación/rechazo de cargas (`approve_bulk_import`, `reject_bulk_import`).
- Página `/approvals` con detalle expandible, confirmación de acciones y navbar global.
- Navbar reutilizable con enlaces y cierre de sesión.
- Banner de pendientes en dashboard.

## RPCs blindadas (auditoría y control de pérdidas)

Todas las funciones críticas usan `auth.uid()` interno, autorización por permisos, bloqueos de fila y auditoría en `audit_logs` vía `private.log_audit_event`.

- Ventas: create_sale, create_pending_sale, confirm_pending_sale, void_sale, create_return, cancel_pending_sale
- Importación: import_products, approve_bulk_import, reject_bulk_import
- Caja: open_cash_session, close_cash_session, register_cash_movement
- Pendientes: resolve_pending_product, resolve_pending_cost, bulk_assign_categories, recalculate_pending_prices
- Inventario: record_stock_count, apply_stock_count_adjustment, manual_stock_adjustment

Reglas aplicadas:
- Stock nunca se modifica sin `performed_by` real.
- Precio/costo siempre desde `product_location_data`, no desde el cliente.
- Pagos externos no se anulan sin confirmación de reembolso.
- Conteos y ajustes separados; ajustar exige que el stock no haya cambiado.
- Idempotencia con `idempotency_key` en operaciones financieras y de stock.