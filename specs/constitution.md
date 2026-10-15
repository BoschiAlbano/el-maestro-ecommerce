# Constitución del proyecto

Reglas no negociables. Toda spec, plan y línea de código debe respetarlas. Si una regla estorba, se discute y se cambia acá primero.

## 1. Proceso

1. **Spec primero.** No se escribe código de un módulo sin su `spec.md` aprobada.
2. **Una spec a la vez**, en el orden de `docs/PROJECT.md` (sección 11).
3. **Fuera de alcance es fuera de alcance.** Lo que figura en "Fuera de alcance" no se construye sin un cambio de alcance aprobado.
4. **Spec y código no se contradicen.** Si cambia uno, cambia el otro en el mismo trabajo.

## 2. Dinero y datos

5. **Todo en ARS.** El sistema no maneja dólares ni tipo de cambio.
6. **`Decimal` para el dinero**, nunca `Float`. Los montos calculados se redondean al peso entero, hacia arriba desde 0,5.
7. **Cantidades de stock enteras** y registradas como movimientos con signo. El saldo se deriva de los movimientos.
8. **Cada venta guarda precio y costo vigentes** en ese momento. Editar un producto no cambia ventas pasadas.
9. **Fechas en UTC en la base**, mostradas en la zona `America/Argentina/Tucuman`, con formato es-AR.

## 3. Integridad

10. **Una venta es una sola transacción**: venta, ítems, pagos, movimientos de stock y caja se guardan todos o ninguno.
11. **No se vende sin caja abierta** y solo hay **una caja abierta** a la vez (restricción en la base de datos, no solo en la interfaz).
12. **Un cierre de caja no se edita.** Las correcciones son movimientos nuevos con motivo.
13. **Anulaciones, ajustes de stock, reimpresiones y cambios de precio** requieren permiso, llevan motivo cuando corresponde y quedan en la auditoría.

## 4. Seguridad

14. **Los permisos se validan en el servidor**, en cada Server Action y Route Handler (sesión + permiso). La interfaz solo oculta.
15. **Prisma salta RLS**, por lo que ninguna ruta confía en lo que mande el cliente.
16. **Los secretos nunca se suben al repositorio.** La clave `service_role` de Supabase se usa solo en el servidor.
17. **El empleado no ve costos ni márgenes** salvo que su rol tenga ese permiso.

## 5. Calidad

18. **TypeScript en modo estricto.** Sin `any` sin justificar.
19. **Los flujos críticos tienen pruebas automáticas**: venta, caja (apertura, cierre, diferencia), pedidos con seña y entrega parcial, y permisos. La lógica de esos flujos lleva pruebas unitarias desde que se construye; la cobertura de punta a punta (Playwright) se corre en la pasada de endurecimiento previa al cierre del MVP (regla 20), igual que en el resto de las specs.
20. **Antes de cerrar una tarea** pasan el linter, el chequeo de tipos y las pruebas unitarias. Las pruebas E2E se escriben y corren recién en una pasada de endurecimiento antes de cerrar el MVP, no spec por spec — decisión tomada para no frenar el avance (ver `docs/PROJECT.md`). Cada spec deja registrado en su `tasks.md` si su cobertura E2E sigue pendiente.
21. **Cada spec se cierra verificando sus criterios de aceptación uno por uno** (con prueba unitaria o revisión manual documentada — el E2E puede quedar pendiente, ver regla 20).

## 6. Interfaz

22. **Primero celular.** Todo módulo funciona en pantalla chica; el punto de venta se optimiza además para la PC de caja.
23. **Interfaz en español de Argentina**, montos con separador de miles y sin decimales visibles salvo que aporten.
24. **Mensajes de error claros**, en español, que digan qué hacer.
25. **El ticket de 58 mm** siempre lleva la leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA".

## 7. Entorno

26. **El desarrollo es en Windows con PowerShell.** Los comandos documentados deben funcionar ahí.
27. **Región São Paulo** para base de datos y hosting.
