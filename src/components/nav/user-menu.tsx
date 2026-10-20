type UserMenuProps = {
  name: string;
  username: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Iniciales + nombre y usuario del usuario logueado (cerrar sesión vive en el menú lateral). */
export function UserMenu({ name, username }: UserMenuProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
        title={`${name} · ${username}`}
        aria-hidden
      >
        {initials(name)}
      </span>
      <span className="hidden text-sm text-muted-foreground sm:inline" title={username}>
        {name}
      </span>
    </div>
  );
}
