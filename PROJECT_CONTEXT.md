# Contexto del Proyecto — Mega Shop Rivadavia

## Estado actual (última actualización: 2026-09-01)

### Completado
- Esquema de base de datos en Supabase (todas las tablas, roles, permisos, ubicación piloto, RLS temporal).
- Autenticación con Supabase Auth (login funcional, usuario de prueba `admin@megashop.com`).
- Middleware de protección de rutas (redirige a `/login` si no hay sesión).
- Dashboard básico con botón de logout.

### En progreso
- Pantalla de catálogo de productos (listado y alta manual).
- Carga masiva CSV con clasificación automática de rubro (falta integrar Groq).

## Próximos pasos inmediatos
1. Crear página `/catalog` con listado de productos desde la tabla `products`.
2. Implementar formulario de alta manual de producto.
3. Implementar carga masiva CSV (sin clasificación automática primero, luego con Groq).
4. Crear pantalla de stock (vista de `stock_levels`).

## Decisiones técnicas relevantes
- Stack: Next.js 16 (App Router) +wind CSS + Supabase + Vercel.
- Base de datos: PostgreSQL en Supabase. RLS habilitado con políticas temporales (`true` para autenticados) — se refinarán según roles.
- Cliente de Supabase en `src/lib/supabase/client.ts` (browser) y middleware con `@supabase/ssr`.
- Multi-local ya embebido en la BD (`location_id` en todas las tablas operativas).

## Reglas no negociables (recordatorio)
- Toda tabla operativa tiene `location_id`.
- Ningún movimiento de stock sin `performed_by`.
- Roles y permisos son datos, no código.
- Atributos de producto en `attributes jsonb`.
- Conteos físicos generan evento propio.
