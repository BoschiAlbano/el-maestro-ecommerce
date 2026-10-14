import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

/** Email del usuario logueado + botón para cerrar sesión. */
export async function UserMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}
