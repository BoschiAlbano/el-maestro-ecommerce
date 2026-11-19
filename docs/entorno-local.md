# Entorno local de desarrollo

Para desarrollar sin tocar la base que usa el cliente. Se creó con la spec 019 (plan, sección 7). Todos los comandos son para **PowerShell**, parado en la carpeta del proyecto.

## Qué base se usa y cuándo (decisión 2026-11-12)

Mientras el cliente **no use** el sistema, se desarrolla directamente sobre la **base de Supabase en la nube** (la misma que usa el sitio publicado). Antes de que el cliente empiece a usarlo en producción, se vuelve a la **base local** para seguir desarrollando, y la de la nube queda solo para el cliente.

| Quiero usar | Cómo |
|---|---|
| **La nube** (hoy) | Que `.env.development.local` **no exista** con ese nombre: `Rename-Item .env.development.local .env.docker.local`. Así `next dev` lee `.env.local` y `.env` (nube). `pnpm dev` tiene que mostrar `Environments: .env.local, .env`. |
| **La local** (después del arranque real) | `Rename-Item .env.docker.local .env.development.local` y levantar Supabase local (sección «Uso diario»). |

Mientras se desarrolla sobre la nube:

- `.env.local` guarda `ARCA_ENCRYPTION_KEY` de la nube. **Tiene que ser el mismo valor en Vercel**, o el certificado guardado deja de poder usarse. Con Mercado Libre pasa lo mismo (`ML_*`, que hoy están solo en el archivo local).
- Todo lo que se pruebe de facturación es **de prueba** (homologación). El modo real solo se activa desde el sitio publicado, y **no hay que activarlo mientras se comparta la base**: un `pnpm dev` conectado a ella emitiría facturas de verdad.
- Antes de una migración o de un script que borre datos: volcado de la base (`pg_dump`). Las migraciones se aplican con `pnpm prisma migrate deploy` (lee `.env`).
- **Después de una migración, reiniciar `pnpm dev`.** En desarrollo el cliente de Prisma queda guardado en memoria entre recargas, así que un `pnpm dev` que ya estaba corriendo sigue sin conocer las tablas nuevas y falla con `TypeError` (pasó el 2026-11-16 con los avisos de Mercado Libre de la spec 020). Si no hay un volcado con `pg_dump` a mano, alcanza con copiar las tablas a un JSON con un script de Node.
- **Antes de dar la app al cliente:** reiniciar el sistema desde Configuración > Sistema, quitar el certificado de homologación y cargar el del cliente, reconectar Mercado Libre con su cuenta y pasar a modo real desde el sitio publicado.

## Qué hay (entorno local)

| Pieza | Dónde |
|---|---|
| Supabase local (base, autenticación, almacenamiento) | Docker, proyecto en `C:\Users\boschi albano jose\Desktop\supabase\supabase-el-maestro` |
| Variables del entorno local | `.env.development.local` (no va al repositorio) |
| Panel de Supabase local | <http://127.0.0.1:54323> |
| Base local | `127.0.0.1:54322` |
| Usuario Dueño local | usuario `dueno`; la contraseña está en `SEED_ADMIN_PASSWORD` de `.env.development.local` |

`next dev` carga `.env.development.local` con prioridad sobre `.env.local` y `.env`. El despliegue en Vercel lo ignora. Los archivos `.env` y `.env.local` no se tocan.

## Uso diario

```powershell
# 1. Levantar Supabase (Docker Desktop tiene que estar abierto)
supabase start --workdir "C:\Users\boschi albano jose\Desktop\supabase\supabase-el-maestro" -x realtime,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor

# 2. Levantar el sistema
pnpm dev

# 3. Al terminar (los datos se conservan)
supabase stop --workdir "C:\Users\boschi albano jose\Desktop\supabase\supabase-el-maestro"
```

Al arrancar, `pnpm dev` tiene que mostrar `Environments: .env.development.local, .env.local, .env`. Si no aparece el primero, se está usando otra base.

## Comandos que no pasan por Next

Las migraciones, la semilla y el bucket de fotos **leen `.env`, no `.env.development.local`**. Antes de correrlos hay que cargar las variables locales en la sesión de PowerShell y verificar el destino:

```powershell
Get-Content .env.development.local | Where-Object { $_ -match '^\s*[A-Z_]+=' } | ForEach-Object {
  $nombre, $valor = $_ -split '=', 2
  Set-Item "env:$nombre" $valor.Trim('"')
}
if ($env:DIRECT_URL -notmatch '@127\.0\.0\.1:54322/') { throw "DIRECT_URL no apunta a la base local. No sigas." }

pnpm prisma migrate deploy
```

Las variables quedan cargadas solo en esa ventana de PowerShell. En una ventana nueva, esos comandos vuelven a usar `.env`.

## Túnel público (para Mercado Libre)

Mercado Libre necesita una dirección https pública para el retorno de la autorización y para los avisos. Se usa `ngrok` con un dominio fijo:

```powershell
ngrok http 3000 --url https://<tu-dominio-fijo-de-ngrok>
```

Para conectar la cuenta de Mercado Libre hay que **entrar al sistema por la dirección de ngrok**, no por `localhost`: la sesión iniciada en `localhost` no vale en el otro dominio.

## Crear el entorno desde cero

Solo si se pierde el proyecto local o se cambia de máquina.

```powershell
$dir = "C:\Users\boschi albano jose\Desktop\supabase\supabase-el-maestro"
New-Item -ItemType Directory -Force $dir
supabase init --workdir $dir
supabase start --workdir $dir -x realtime,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor
supabase status --workdir $dir
```

Con los datos de `supabase status` se arma `.env.development.local` (base, dirección del servicio, clave pública y clave de servicio). Después, con las variables cargadas como se indica arriba:

```powershell
pnpm prisma migrate deploy
pnpm db:seed
pnpm setup:storage
```

### Problema conocido: una migración falla en una base vacía

`20261015003109_require_user_role` vuelve a crear la restricción `users_roleId_fkey`, que la migración anterior ya creó, sin borrarla antes. En una base vacía `migrate deploy` se frena ahí. En la base del cliente ya figura como aplicada, así que el archivo no se modificó.

Solución, **solo en la base local**:

```powershell
@'
BEGIN;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL, ALTER COLUMN "name" SET NOT NULL, ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "users" DROP CONSTRAINT "users_roleId_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
'@ | docker exec -i supabase_db_supabase-el-maestro psql -U postgres -d postgres -v ON_ERROR_STOP=1

pnpm prisma migrate resolve --applied 20261015003109_require_user_role
pnpm prisma migrate deploy
```

## Certificado de ARCA para desarrollo (spec 023)

La carpeta `afip/` de la raíz del proyecto guarda el certificado y la clave de **homologación** (el ambiente de pruebas de ARCA) para desarrollar y probar la facturación:

| Archivo | Qué es |
|---|---|
| `afip/elmaestro.crt` | Certificado de homologación, con el alias `elmaestro`. |
| `afip/elmaestro.key` | Su clave privada. **Es un secreto.** |

- La carpeta está en `.gitignore`, igual que cualquier `*.key`, `*.crt`, `*.csr`, `*.p12` y `*.pfx`: nunca se sube al repositorio. Antes de un commit, `git status` no debería mostrar nada de `afip/`.
- **Este certificado es solo de El Maestro.** ARCA entrega un solo permiso temporal por certificado: si otro sistema usa el mismo, cada uno invalida al otro. Cada sistema tiene el suyo.
- **No se carga en el sitio publicado.** Producción usa el certificado del cliente, que se carga desde Configuración > Facturación.
- Para usarlo en el sistema local, se suben desde esa misma pantalla con "Subir certificado y clave existentes".
- Si hay que crear otro: el sistema genera la clave y el pedido (Configuración > Facturación), y el pedido se pega en el portal de pruebas de ARCA (WSASS, "Crear DN y certificado"). Después hay que autorizar el certificado al servicio `wsfe`.
