import { Checkbox } from "@/components/ui/checkbox";
// Desde "enums" (no desde "client"): ese módulo no arrastra el runtime de
// Prisma, que no se puede empaquetar para el navegador (usa node:module).
import { ModuloNegocio } from "@/generated/prisma/enums";
import type { Accion, PermisoEspecial } from "@/lib/permissions";

const MODULOS: { value: ModuloNegocio; label: string }[] = [
  { value: ModuloNegocio.CATALOGO, label: "Catálogo" },
  { value: ModuloNegocio.INVENTARIO, label: "Inventario" },
  { value: ModuloNegocio.INGRESO_MERCADERIA, label: "Ingreso de mercadería" },
  { value: ModuloNegocio.CAJA, label: "Caja" },
  { value: ModuloNegocio.VENTAS, label: "Ventas" },
  { value: ModuloNegocio.PEDIDOS, label: "Pedidos" },
  { value: ModuloNegocio.EMPLEADOS, label: "Empleados" },
  { value: ModuloNegocio.ANALITICAS, label: "Analíticas" },
  { value: ModuloNegocio.CONFIGURACION, label: "Configuración" },
];

const ACCIONES: { value: Accion; label: string }[] = [
  { value: "ver", label: "Ver" },
  { value: "crear", label: "Crear" },
  { value: "editar", label: "Editar" },
  { value: "anular", label: "Anular" },
  { value: "exportar", label: "Exportar" },
];

export const PERMISOS_ESPECIALES: { value: PermisoEspecial; label: string }[] = [
  { value: "verCostosMargenes", label: "Ver costos y márgenes" },
  { value: "anularVentas", label: "Anular ventas" },
  { value: "ajustarStock", label: "Ajustar stock" },
  { value: "reimprimirTickets", label: "Reimprimir tickets" },
  { value: "cerrarCaja", label: "Cerrar caja" },
  { value: "cambiarPrecios", label: "Cambiar precios" },
];

/**
 * Checkboxes nombrados `perm_<MODULO>_<ACCION>` y `<permisoEspecial>`, para
 * parsearlos de FormData en la Server Action (`parseMatrixAndSpecial` en
 * roles/actions.ts) — sin estado de cliente, es un formulario normal.
 */
export function PermissionMatrix({
  defaultPermissions = {},
  defaultSpecial = {},
  disabled = false,
}: {
  defaultPermissions?: Partial<Record<ModuloNegocio, Partial<Record<Accion, boolean>>>>;
  defaultSpecial?: Partial<Record<PermisoEspecial, boolean>>;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="pb-2 text-left font-medium">Módulo</th>
              {ACCIONES.map((a) => (
                <th key={a.value} className="px-2 pb-2 text-center font-medium">
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.value} className="border-t">
                <td className="py-2">{m.label}</td>
                {ACCIONES.map((a) => (
                  <td key={a.value} className="px-2 py-2 text-center">
                    <Checkbox
                      name={`perm_${m.value}_${a.value}`}
                      defaultChecked={defaultPermissions[m.value]?.[a.value] ?? false}
                      disabled={disabled}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Permisos especiales</span>
        {PERMISOS_ESPECIALES.map((e) => (
          <label key={e.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              name={e.value}
              defaultChecked={defaultSpecial[e.value] ?? false}
              disabled={disabled}
            />
            {e.label}
          </label>
        ))}
      </div>
    </div>
  );
}
