# Contexto del Proyecto — Mega Shop Rivadavia

## Estado actual (última actualización: 2026-09-01)

### Completado
- Esquema de base de datos en Supabase (todas las tablas, roles, permisos, ubicación piloto, RLS temporal).
- Autenticación con Supabase Auth (login funcional, usuario de prueba `admin@megashop.com`).
- Middleware de protección de rutas (redirige a `/login` si no hay sesión).
- Dashboard básico con botón de logout y enlaces a Catálogo e Importar.
- Página de catálogo (`/catalog`) con listado y alta manual de productos.
- Página de importación (`/import`) con dos pestañas: CSV/Excel y Foto (OCR).
- Integración con Groq para OCR (modelo de visión `qwen/qwen3.8-27b`) y clasificación de rubros.
- Clasificación híbrida: preclasificador por palabras clave (`src/lib/classify.ts`) + IA para casos ambiguos.
- Endpoint `/api/import/classify` para clasificar productos.
- Endpoint `/api/import/ocr` para extraer productos desde imagen.
- Endpoint `/api/import/save` que ejecuta función SQL atómica `import_products` (inserción de productos, movimientos de stock y actualización de stock).
- Función SQL `import_products` en Supabase con lógica de roles: `deposito` => estado `pending_approval`; `owner_admin`/`encargado` => estado `completed` y stock actualizado.
- Modal de auditoría rápida en importación con checkboxes para omitir productos, resumen por rubro y aceptación obligatoria.
- Carpeta `supabase/migrations` versionada (SQL inicial y README).
- Commit inicial y push a GitHub.

### En progreso / parcialmente funcional
- Carga masiva CSV/Excel (funciona, pero falta probar con archivo real).
- OCR de remitos/fotos (funciona, pero no extrae bien cantidades ni rubros en imágenes con columnas claras).
- Clasificación automática de rubro (mejoró con palabras clave, pero aún falla en algunos juguetes).

## Próximos pasos inmediatos (retomar aquí)
1. **Mejorar OCR** para capturar correctamente `quantity` y `category` desde imágenes de remitos con columnas (ej. imagen clara de remito tipo Excel). Revisar prompt del OCR y tal vez usar un modelo de visión más potente o un paso adicional de post-procesamiento.
2. **Probar el flujo completo con un CSV/Excel de ejemplo** que incluya columnas `name, sku, quantity, cost_price, category` para confirmar que la clasificación, edición manual y guardado con stock funcionan sin depender del OCR.
3. **Verificar deploy en Vercel** del último commit y corregir cualquier error de build.
4. **Corregir clasificación de juguetería**: ajustar prompt de clasificación y/o ampliar lista de palabras clave en `src/lib/classify.ts` para que productos como "Muñeca articulada", "Auto a fricción", "Pelota de goma", "Rompecabezas" se asignen a `jugueteria` y no a `bazar`.
5. **Crear vista de stock** (pantalla `/stock`) que muestre `stock_levels` por local, y tal vez historial de movimientos.
6. **Implementar gestión de pendientes**: pantalla para que owner/encargado aprueben cargas `pending_approval` hechas por depósito.

## Decisiones técnicas relevantes
- Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase + Vercel.
- Base de datos: PostgreSQL en Supabase. RLS habilitado con políticas temporales (`true` para autenticados) — se refinarán según roles.
- Cliente de Supabase en `src/lib/supabase/client.ts` (browser) y middleware con `@supabase/ssr`.
- Multi-local ya embebido en la BD (`location_id` en todas las tablas operativas).
- OCR con Groq usando `qwen/qwen3.8-27b` (acepta imágenes). Clasificación con `qwen/qwen3.8-27b` o `openai/gpt-oss-20b` (si no está limitado).
- Preclasificador híbrido con palabras clave para evitar errores comunes de IA.
- Funciones SQL atómicas para operaciones complejas (import_products).

## Reglas no negociables (recordatorio)
- Toda tabla operativa tiene `location_id`.
- Ningún movimiento de stock sin `performed_by`.
- Roles y permisos son datos, no código.
- Atributos de producto en `attributes jsonb`.
- Conteos físicos generan evento propio.

## Notas de sesión
- Llevamos ~17 horas de desarrollo continuo. Se logró mucho, pero quedan pendientes importantes en OCR y clasificación fina.
- Se acordó trabajar con commits frecuentes y deploy a Vercel para asegurar el progreso.