# AGENTS.md — reglas para trabajar en este proyecto

Este proyecto se desarrolla con **SDD (Spec-Driven Development)**: la especificación es la fuente de verdad y el código es su consecuencia.

## Antes de hacer cualquier cosa

1. Leé `docs/PROJECT.md` (qué se construye y por qué) y `specs/constitution.md` (reglas no negociables).
2. Identificá la spec en la que se trabaja: `specs/NNN-nombre/`.
3. Si algo no está en la spec, no lo inventes: preguntá o proponé un cambio de spec.

## Flujo SDD (una spec a la vez)

1. **Spec** (`spec.md`): qué hace el módulo y por qué. Sin decisiones técnicas. Se aprueba antes de seguir.
2. **Plan** (`plan.md`): cómo se construye (modelo de datos, rutas, componentes, permisos). Se aprueba antes de seguir.
3. **Tareas** (`tasks.md`): lista corta de pasos verificables, cada uno con su criterio de hecho.
4. **Implementación**: tarea por tarea. Al terminar una, se marca `[x]` en `tasks.md`.
5. **Verificación**: los criterios de aceptación de la spec se prueban uno por uno antes de dar la spec por cerrada.

Si durante la implementación se descubre que la spec o el plan estaban mal, se **corrige el documento primero** y después el código.

## Reglas para agentes

- No agregues funciones fuera de alcance (ver "Fuera de alcance" en `docs/PROJECT.md`) sin un pedido explícito del usuario.
- No cambies una spec aprobada sin avisar qué cambió y por qué.
- Respetá `specs/constitution.md`: dinero en ARS con `Decimal`, permisos validados en el servidor, ventas en una sola transacción.
- Un cambio = un commit pequeño, con mensaje en formato Conventional Commits (por ejemplo `feat(caja): apertura de turno`).
- Nunca subas secretos. Las claves viven en `.env.local`.
- Los comandos que se documenten deben funcionar en **PowerShell** (el desarrollo es en Windows).

## Idioma

Documentación, interfaz y mensajes al usuario en español de Argentina. Nombres de código (variables, tablas, funciones) en inglés.
