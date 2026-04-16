
# ONLY8H

## What This Is

ONLY8H es una aplicación web React de uso interno para el despacho de abogados **RUA Abogados**, que permite subir lotes de documentos legales (PDF y Word/DOCX) y obtener automáticamente un informe PDF de resumen ejecutivo generado por IA (Claude API). El objetivo es reducir el tiempo de análisis documental legal, extrayendo de forma estructurada las partes intervinientes, cláusulas clave, riesgos y recomendaciones.

## Core Value

El usuario sube documentos legales y en minutos recibe un informe PDF listo para usar, sin tener que leer manualmente cada documento.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Autenticación y acceso**
- [ ] Login con email/contraseña mediante Supabase Auth
- [ ] Acceso restringido a usuarios internos del despacho

**Subida de documentos**
- [ ] Subida de múltiples ficheros (PDF y Word/DOCX) en un mismo lote
- [ ] Almacenamiento de ficheros en Supabase Storage
- [ ] Validación de tipos y tamaño de ficheros en el cliente

**Análisis con IA**
- [ ] Envío de los documentos a Claude API para análisis
- [ ] Extracción estructurada: partes intervinientes, objeto, cláusulas clave, riesgos, conclusión
- [ ] Plantilla de prompt fija que produce siempre el mismo esquema de informe
- [ ] Soporte para lotes (N documentos → 1 informe consolidado)

**Generación del informe PDF**
- [ ] Generación del PDF en el cliente o servidor con plantilla visual corporativa
- [ ] Secciones fijas: portada, partes intervinientes, resumen por documento, riesgos detectados, conclusión
- [ ] Descarga inmediata del PDF al finalizar

**Historial de informes**
- [ ] Almacenamiento de cada informe generado en Supabase (metadatos + PDF)
- [ ] Listado de informes anteriores con fecha, nombre del lote y descarga
- [ ] El historial es por usuario autenticado

### Out of Scope

- **Login social (Google/SSO)** — uso interno, email/contraseña es suficiente
- **Plantillas configurables por el usuario** — v1 con plantilla fija
- **OCR de imágenes** — solo PDF y DOCX en v1
- **Multitenancy / cuentas de empresa** — herramienta interna del despacho
- **Chat o Q&A sobre los documentos** — el flujo es subir → analizar → informe; sin conversación posterior
- **Edición del informe en la app** — el PDF se descarga tal cual

## Context

- El despacho es **RUA Abogados** (danielgarcia@ruaabogados.es)
- El caso de uso principal es la revisión de contratos y documentación legal en lote
- La IA (Claude) debe identificar siempre: partes, objeto, plazos, obligaciones, riesgos y conclusión
- El informe PDF debe tener aspecto profesional/corporativo
- Supabase gestiona auth, storage y base de datos
- React (Vite) en el frontend; sin backend propio — toda la lógica pasa por Supabase + llamadas directas a Claude API desde el cliente (o Edge Functions de Supabase)

## Constraints

- **Stack**: React + Vite + TypeScript, Supabase, Claude API (claude-sonnet-4-6) — decidido por el usuario
- **Usuarios**: Solo usuarios internos dados de alta manualmente en Supabase Auth
- **Documentos**: PDF y DOCX únicamente en v1
- **Seguridad**: La API key de Claude no debe exponerse en el cliente — usar Supabase Edge Functions como proxy
- **Informe**: Plantilla visual fija (no configurable por el usuario en v1)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Edge Function como proxy de Claude API | La API key de Claude no puede estar en el bundle del cliente — seguridad obligatoria | — Pending |
| Generación PDF en cliente (jsPDF / pdf-lib) | Evita infraestructura de servidor adicional; la plantilla es fija y manejable en JS | — Pending |
| Un informe consolidado por lote | El caso de uso real es revisar un expediente completo, no fichero a fichero | — Pending |

---
*Last updated: 2026-04-15 after questioning session inicial*
