/** Tamaños de página que puede elegir el usuario en las tablas. */
export const PAGE_SIZE_OPTIONS = [10, 15, 20] as const;

/** "Todos los resultados": tope práctico para que `take`/`slice` nunca reciban Infinity. */
export const ALL_ROWS = 1_000_000;
