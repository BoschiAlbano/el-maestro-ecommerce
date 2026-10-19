export type Crumb = {
  label: string;
  /** Sin href = es la página actual. */
  href?: string;
};

/** Secciones del primer nivel de la URL. */
const SECTIONS: Record<string, string> = {
  ventas: "Ventas",
  pedidos: "Pedidos",
  caja: "Caja",
  productos: "Productos",
  inventario: "Stock",
  "lista-de-viaje": "Lista de viaje",
  ingresos: "Ingresos",
  usuarios: "Usuarios",
  roles: "Roles",
  empleados: "Empleados",
  analiticas: "Analíticas",
  configuracion: "Configuración",
  marcas: "Marcas",
  rubros: "Rubros",
};

/** Marcas y rubros son pestañas del catálogo: cuelgan de Productos aunque su URL sea de primer nivel. */
const PARENT_SECTION: Record<string, string> = {
  marcas: "productos",
  rubros: "productos",
  roles: "usuarios",
};

/** Subpáginas con nombre propio (cualquier otro segmento se toma como un id). */
const SUBPAGES: Record<string, string> = {
  nuevo: "Nuevo",
  historial: "Historial",
  conteo: "Conteo",
  importar: "Importar",
  etiquetas: "Etiquetas",
  imprimir: "Imprimir",
  auditoria: "Auditoría",
  ticket: "Ticket",
};

/** Secciones donde la página de un id es para editar (en el resto es un detalle). */
const EDITABLE_SECTIONS = new Set(["productos", "usuarios", "roles", "empleados"]);

/**
 * Migas de pan a partir de la URL. Un id en el medio de la ruta se omite
 * (no tiene página propia: `/ventas/[id]/ticket`), y uno al final se llama
 * "Editar" o "Detalle" según la sección.
 */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Inicio" }];

  const [section, ...rest] = segments;
  const crumbs: Crumb[] = [];

  const parent = PARENT_SECTION[section];
  if (parent) crumbs.push({ label: SECTIONS[parent], href: `/${parent}` });
  crumbs.push({ label: SECTIONS[section] ?? section, href: `/${section}` });

  rest.forEach((segment, index) => {
    const isLast = index === rest.length - 1;
    const known = SUBPAGES[segment];
    if (known) {
      crumbs.push({ label: known, href: `/${segments.slice(0, index + 2).join("/")}` });
    } else if (isLast) {
      crumbs.push({ label: EDITABLE_SECTIONS.has(section) ? "Editar" : "Detalle" });
    }
  });

  const last = crumbs[crumbs.length - 1];
  delete last.href;
  return crumbs;
}
