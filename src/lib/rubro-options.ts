import "server-only";

type RubroConHijos = { id: string; name: string; children: { id: string; name: string }[] };

/** Lista plana para un `<select>`: rubros de primer nivel + sus subrubros como "Padre > Hijo". */
export function buildRubroOptions(topLevelRubros: RubroConHijos[]): { id: string; label: string }[] {
  return topLevelRubros.flatMap((r) => [
    { id: r.id, label: r.name },
    ...r.children.map((c) => ({ id: c.id, label: `${r.name} > ${c.name}` })),
  ]);
}
