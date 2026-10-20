import { hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ModuloNegocio, type AuditAction, type Prisma } from "@/generated/prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TablePagination, parsePage } from "@/components/table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCIONES: { value: AuditAction; label: string }[] = [
  { value: "USER_CREATED", label: "Usuario creado" },
  { value: "USER_UPDATED", label: "Usuario editado" },
  { value: "USER_ACTIVATED", label: "Usuario reactivado" },
  { value: "USER_DEACTIVATED", label: "Usuario desactivado" },
  { value: "ROLE_CREATED", label: "Rol creado" },
  { value: "ROLE_UPDATED", label: "Rol editado" },
  { value: "ROLE_DELETED", label: "Rol borrado" },
  { value: "SYSTEM_RESET", label: "Sistema reiniciado" },
];

function labelFor(action: AuditAction): string {
  return ACCIONES.find((a) => a.value === action)?.label ?? action;
}

function formatDetail(detail: Prisma.JsonValue): string {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return "";
  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

const PAGE_SIZE = 20;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; userId?: string; action?: string; pagina?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CONFIGURACION, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta sección.</p>;
  }

  const { desde, hasta, userId, action, pagina } = await searchParams;

  const where: Prisma.AuditLogWhereInput = {};
  if (desde || hasta) {
    where.createdAt = {
      ...(desde ? { gte: new Date(`${desde}T00:00:00`) } : {}),
      ...(hasta ? { lte: new Date(`${hasta}T23:59:59`) } : {}),
    };
  }
  if (userId && userId !== "__all__") where.userId = userId;
  if (action && action !== "__all__") where.action = action as AuditAction;

  const total = await prisma.auditLog.count({ where });

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(pagina), totalPages);

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Auditoría</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="userId">Usuario</Label>
          <Select
            name="userId"
            defaultValue={userId ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(users.map((u) => [u.id, u.name])) }}
          >
            <SelectTrigger id="userId" className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="action">Acción</Label>
          <Select
            name="action"
            defaultValue={action ?? "__all__"}
            items={{ __all__: "Todas", ...Object.fromEntries(ACCIONES.map((a) => [a.value, a.label])) }}
          >
            <SelectTrigger id="action" className="w-56">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {ACCIONES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Argentina/Tucuman",
                }).format(log.createdAt)}
              </TableCell>
              <TableCell>{log.user.name}</TableCell>
              <TableCell>{labelFor(log.action)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDetail(log.detail)}
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                No hay entradas para estos filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => {
          const query = new URLSearchParams();
          if (desde) query.set("desde", desde);
          if (hasta) query.set("hasta", hasta);
          if (userId && userId !== "__all__") query.set("userId", userId);
          if (action && action !== "__all__") query.set("action", action);
          if (p > 1) query.set("pagina", String(p));
          const qs = query.toString();
          return qs ? `/configuracion/auditoria?${qs}` : "/configuracion/auditoria";
        }}
      />
    </div>
  );
}
