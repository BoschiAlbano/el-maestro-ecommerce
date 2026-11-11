// Qué hace el sistema con cada tema de aviso de Mercado Libre (specs/019,
// RF-15). En esta spec el registro está vacío a propósito: los avisos se
// reciben y se guardan, y quedan como "sin acción". Las specs 020 a 022
// agregan acá su función para cada tema (publicaciones, stock, órdenes).
//
// Reglas para quien agregue una función:
//   - El aviso solo dice DÓNDE mirar. La función tiene que consultar el
//     recurso a Mercado Libre (con `mlFetch`) y nunca usar el aviso como dato
//     (RF-10).
//   - Tiene que poder ejecutarse dos veces con el mismo aviso sin duplicar
//     nada: hay reintentos, y dos procesamientos pueden cruzarse.
//   - Si Mercado Libre no responde, dejar que el error suba: el aviso queda
//     pendiente para la próxima pasada.

export type NotificationContext = {
  topic: string;
  resource: string;
  mlUserId: string;
};

export type NotificationHandler = (notification: NotificationContext) => Promise<void>;

export const notificationHandlers: Record<string, NotificationHandler> = {};
