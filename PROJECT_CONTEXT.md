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

### En progreso / parcialmente funcional
- OCR de remitos/fotos: extrae productos, cantidades y costos; la clasificación automática ya funciona bien, pero puede requerir revisión manual en algunos casos.
- Carga masiva CSV/Excel: funcional, falta probar con archivo real de gran volumen.

## Próximos pasos inmediatos
1. Probar flujo completo con CSV/Excel de ejemplo (columnas name, sku, quantity, cost_price, category).
2. Crear vista de stock (`/stock`) que muestre `stock_levels` por local.
3. Implementar gestión de pendientes: pantalla para que owner/encargado aprueben cargas `pending_approval` hechas por depósito.
4. Ajustar input de costo unitario para evitar salto de cursor (guardar string crudo de edición y formatear onBlur).
5. Mejorar auditoría visual del modal: agregar campo de costo unitario editable y total en tiempo real.
6. Evaluar si conviene mover la clasificación al servidor para desacoplar frontend y evitar futuros conflictos.

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