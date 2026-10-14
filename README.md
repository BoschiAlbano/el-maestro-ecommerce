# Sistema de gestión para importadora

Aplicación web instalable (PWA) para controlar stock, ventas, pedidos por encargo y caja de un negocio importador, con analíticas para el dueño. Todo en pesos argentinos.

- **Documento maestro:** [`docs/PROJECT.md`](docs/PROJECT.md)
- **Reglas del proyecto:** [`specs/constitution.md`](specs/constitution.md)
- **Especificaciones por módulo:** [`specs/`](specs/)
- **Decisiones tomadas:** [`docs/decisions/`](docs/decisions/)

## Stack

Next.js (App Router) + TypeScript · Supabase (Postgres y Auth) · Prisma · Tailwind CSS + shadcn/ui · Vercel

## Estructura

```
importadora-app/
├─ README.md
├─ AGENTS.md              reglas de trabajo con SDD (también para agentes de IA)
├─ CLAUDE.md              apunta a AGENTS.md
├─ docs/
│  ├─ PROJECT.md          documento maestro del proyecto
│  └─ decisions/          decisiones importantes (ADR)
└─ specs/
   ├─ constitution.md     principios no negociables
   ├─ _templates/         plantillas de spec, plan y tareas
   └─ NNN-modulo/         una carpeta por módulo (spec.md → plan.md → tasks.md)
```

El código de la aplicación (`src/`, `prisma/`, etc.) se crea en la primera spec (`001-base-del-proyecto`), una vez aprobada.

## Cómo se trabaja (SDD)

`spec.md` (qué y por qué) → `plan.md` (cómo) → `tasks.md` (pasos) → código → verificación contra los criterios de aceptación.

Cada spec se aprueba antes de pasar a la siguiente etapa. Ver `AGENTS.md`.

## Primeros pasos (PowerShell)

```powershell
cd "$HOME\Desktop\importadora-app"
git init
git add .
git commit -m "docs: estructura inicial SDD y documento maestro"
```
