"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Eye, MoreHorizontal, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { setUserActive } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  active: boolean;
};

/** Lista de usuarios con un menú de acciones por fila: ver el detalle o desactivar/reactivar (specs/002). */
export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();

  function toggleActive(user: UserRow) {
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.active);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.roleName}</TableCell>
            <TableCell>
              <Badge variant={user.active ? "default" : "secondary"}>
                {user.active ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Acciones de ${user.name}`} />}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem render={<Link href={`/usuarios/${user.id}`} />}>
                    <Eye />
                    Ver detalles
                  </DropdownMenuItem>
                  {user.active ? (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={pending || user.id === currentUserId}
                      onClick={() => toggleActive(user)}
                    >
                      <UserX />
                      Desactivar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled={pending} onClick={() => toggleActive(user)}>
                      <UserCheck />
                      Reactivar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
