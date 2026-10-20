import { notFound } from "next/navigation";
import { isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditUserForm } from "./edit-user-form";
import { ResetPasswordForm } from "./reset-password-form";
import { setUserActive } from "../actions";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es solo para el Dueño.
      </p>
    );
  }

  const { id } = await params;
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!user) notFound();

  const userId = user.id;
  const isSelf = userId === currentUser.id;
  const nextActive = !user.active;

  async function toggleActive() {
    "use server";
    await setUserActive(userId, nextActive);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid max-w-5xl items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del usuario</CardTitle>
            <CardDescription>Nombre, email de ingreso y rol.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditUserForm user={user} roles={roles} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contraseña</CardTitle>
              <CardDescription>Fijale una contraseña nueva para que pueda ingresar.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm userId={user.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de la cuenta</CardTitle>
              <CardDescription>
                {user.active
                  ? "Un usuario desactivado no puede iniciar sesión, pero conserva su historial."
                  : "Este usuario está desactivado y no puede iniciar sesión."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={toggleActive}>
                <Button type="submit" variant={user.active ? "destructive" : "default"} disabled={isSelf}>
                  {user.active ? "Desactivar usuario" : "Reactivar usuario"}
                </Button>
              </form>
              {isSelf && (
                <p className="mt-2 text-sm text-muted-foreground">No podés desactivarte a vos mismo.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
