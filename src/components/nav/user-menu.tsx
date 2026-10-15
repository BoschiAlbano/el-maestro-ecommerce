import { Button } from "@/components/ui/button";
import { logout } from "./actions";

type UserMenuProps = {
  name: string;
  email: string;
};

/** Nombre/email del usuario logueado + botón para cerrar sesión. */
export function UserMenu({ name, email }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline" title={email}>
        {name}
      </span>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}
