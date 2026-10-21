import Link from "next/link";
import { isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import { UsersTable } from "./users-table";

const DEFAULT_PAGE_SIZE = 20;

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ pagina?: string; porPagina?: string }> }) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es solo para el Dueño.
      </p>
    );
  }

  const { pagina } = await searchParams;
  const total = await prisma.user.count();
  const page = Math.min(parsePage(pagina), Math.max(1, Math.ceil(total / PAGE_SIZE)));

  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { name: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Usuarios</h1>
        <Link href="/usuarios/nuevo" className={cn(buttonVariants())}>
          Nuevo usuario
        </Link>
      </div>

      <div className="flex-1">
      <UsersTable
        currentUserId={currentUser.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          roleName: u.role.name,
          active: u.active,
        }))}
      />
      </div>

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => (p > 1 ? `/usuarios?pagina=${p}` : "/usuarios")}
      />
    </div>
  );
}
