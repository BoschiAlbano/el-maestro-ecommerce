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

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; userId?: string; action?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CONFIGURACION, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta sección.</p>;
  }

  const { desde, hasta, userId, action } = await searchParams;

  const where: Prisma.AuditLogWhereInput = {};
  if (desde || hasta) {
    where.createdAt = {
      ...(desde ? { gte: new Date(`${desde}T00:00:00`) } : {}),
      ...(hasta ? { lte: new Date(`${hasta}T23:59:59`) } : {}),
    };
  }
  if (userId && userId !== "__all__") where.userId = userId;
  if (action && action !== "__all__") where.action = action as AuditAction;

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
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
          <Select name="userId" defaultValue={userId ?? "__all__"}>
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
          <Select name="action" defaultValue={action ?? "__all__"}>
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
    </div>
  );
}
