// Propuesta de vínculo entre publicaciones y productos (specs/020, RF-5).
// Pura: recibe las publicaciones y los productos candidatos ya cargados.
import { skuKeyOf } from "./sku";

export type ProposalListing = {
  mlItemId: string;
  sku: string | null;
  gtins: string[];
};

export type ProposalProduct = {
  id: string;
  skuKey: string | null;
  barcode: string;
  /** Ya tiene una publicación vigente. */
  linked: boolean;
};

export type MatchKind = "sku" | "barcode" | "gtin";

export type Proposal =
  | { mlItemId: string; productId: string; matchedBy: MatchKind }
  | { mlItemId: string; productId: null; reason: string };

function matchesFor(listing: ProposalListing, products: ProposalProduct[]): Map<string, MatchKind> {
  const found = new Map<string, MatchKind>();
  const add = (id: string, kind: MatchKind) => {
    if (!found.has(id)) found.set(id, kind);
  };

  if (listing.sku) {
    const key = skuKeyOf(listing.sku);
    for (const p of products) if (p.skuKey === key) add(p.id, "sku");
    // Si el producto no tiene SKU, el SKU de la publicación se compara con su
    // código de barras (hay vendedores que usan el código como SKU).
    for (const p of products) if (p.skuKey === null && p.barcode.toUpperCase() === key) add(p.id, "barcode");
  }
  const gtins = new Set(listing.gtins);
  for (const p of products) if (gtins.has(p.barcode)) add(p.id, "gtin");
  return found;
}

/**
 * Propone un producto por publicación cuando hay una única coincidencia, el
 * producto no tiene publicación vigente y ninguna otra publicación coincide
 * con el mismo producto (specs/020, sección 7). Nada se vincula sin confirmar.
 */
export function proposeLinks(listings: ProposalListing[], products: ProposalProduct[]): Proposal[] {
  const linkedIds = new Set(products.filter((p) => p.linked).map((p) => p.id));
  const matched = listings.map((listing) => ({ listing, matches: matchesFor(listing, products) }));

  // Cuántas publicaciones apuntan, como única coincidencia, a cada producto.
  const claims = new Map<string, number>();
  for (const { matches } of matched) {
    if (matches.size !== 1) continue;
    const [productId] = matches.keys();
    claims.set(productId, (claims.get(productId) ?? 0) + 1);
  }

  return matched.map(({ listing, matches }): Proposal => {
    const { mlItemId } = listing;
    if (matches.size === 0) return { mlItemId, productId: null, reason: "No coincide con ningún producto." };
    if (matches.size > 1) {
      return { mlItemId, productId: null, reason: `Coincide con ${matches.size} productos: elegí uno a mano.` };
    }
    const [[productId, matchedBy]] = matches;
    if (linkedIds.has(productId)) {
      return { mlItemId, productId: null, reason: "El producto que coincide ya tiene una publicación vigente." };
    }
    if ((claims.get(productId) ?? 0) > 1) {
      return {
        mlItemId,
        productId: null,
        reason: "Otra publicación coincide con el mismo producto: solo una se puede vincular.",
      };
    }
    return { mlItemId, productId, matchedBy };
  });
}
