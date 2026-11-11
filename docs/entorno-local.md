# Entorno local de desarrollo

Para desarrollar sin tocar la base que usa el cliente. Se creó con la spec 019 (plan, sección 7). Todos los comandos son para **PowerShell**, parado en la carpeta del proyecto.

## Qué hay

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
