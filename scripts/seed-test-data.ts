import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateUniqueBarcode } from "../src/lib/barcode";
import { registerStockMovement } from "../src/lib/stock";

// Datos de prueba chicos para recorrer el sistema a mano: 3 marcas, 3 rubros,
// 3 subrubros y 9 productos (2 en cada subrubro y 1 en el rubro principal, para
// probar las dos formas de clasificar). Se puede correr más de una vez: lo que
// ya existe se salta.
//
//   pnpm seed:test                  # solo catálogo
//   pnpm seed:test -- --con-stock   # además, un ingreso de mercadería con stock inicial
//
// Requiere un usuario Dueño (`pnpm db:seed`). No es el catálogo real del negocio.

const BRANDS = ["JBL", "Xiaomi", "Lacoste"];

const RUBROS: { name: string; subrubro: string }[] = [
  { name: "Tecnología", subrubro: "Audio" },
  { name: "Celulares y Accesorios", subrubro: "Cargadores y cables" },
  { name: "Perfumería", subrubro: "Perfumes de hombre" },
];

type ProductSeed = {
  name: string;
  brand: string;
  rubro: string;
  /** Si no figura, el producto va en el rubro principal. */
  subrubro?: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  /** Stock inicial con `--con-stock`. Alguno queda bajo el mínimo a propósito. */
  initialStock: number;
};

const PRODUCTS: ProductSeed[] = [
  { name: "Auricular Bluetooth JBL Tune 510BT", brand: "JBL", rubro: "Tecnología", subrubro: "Audio", purchasePrice: 35000, salePrice: 55000, minStock: 5, initialStock: 12 },
  { name: "Parlante Portátil JBL Go 3", brand: "JBL", rubro: "Tecnología", subrubro: "Audio", purchasePrice: 25000, salePrice: 40000, minStock: 8, initialStock: 4 },
  { name: "Power Bank Xiaomi 20000mAh", brand: "Xiaomi", rubro: "Tecnología", purchasePrice: 28000, salePrice: 45000, minStock: 8, initialStock: 15 },
  { name: "Cable USB-C Xiaomi 1m", brand: "Xiaomi", rubro: "Celulares y Accesorios", subrubro: "Cargadores y cables", purchasePrice: 6000, salePrice: 12000, minStock: 15, initialStock: 30 },
  { name: "Cargador Rápido Xiaomi 33W", brand: "Xiaomi", rubro: "Celulares y Accesorios", subrubro: "Cargadores y cables", purchasePrice: 15000, salePrice: 26000, minStock: 10, initialStock: 20 },
  { name: "Celular Xiaomi Redmi 13C", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 220000, salePrice: 320000, minStock: 3, initialStock: 2 },
  { name: "Perfume Lacoste Essential 100ml", brand: "Lacoste", rubro: "Perfumería", subrubro: "Perfumes de hombre", purchasePrice: 45000, salePrice: 75000, minStock: 5, initialStock: 10 },
  { name: "Perfume Lacoste L.12.12 Blanc 100ml", brand: "Lacoste", rubro: "Perfumería", subrubro: "Perfumes de hombre", purchasePrice: 48000, salePrice: 80000, minStock: 5, initialStock: 8 },
  { name: "Desodorante Lacoste Spray 150ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 12000, salePrice: 22000, minStock: 12, initialStock: 18 },
];

async function main() {
  const withStock = process.argv.includes("--con-stock");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const owner = await prisma.user.findFirst({ where: { role: { isOwnerRole: true } }, orderBy: { createdAt: "asc" } });
    if (!owner) throw new Error("No hay un usuario Dueño — correr `pnpm db:seed` primero.");

    const brandId = new Map<string, string>();
    for (const name of BRANDS) {
      const brand = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
      brandId.set(name, brand.id);
    }

    // Rubros y subrubros (`parentId` nulo = rubro de primer nivel).
    const rubroId = new Map<string, string>();
    const subrubroId = new Map<string, string>();
    for (const { name, subrubro } of RUBROS) {
      const rubro =
        (await prisma.rubro.findFirst({ where: { name, parentId: null } })) ??
        (await prisma.rubro.create({ data: { name, parentId: null } }));
      rubroId.set(name, rubro.id);

      const sub =
        (await prisma.rubro.findFirst({ where: { name: subrubro, parentId: rubro.id } })) ??
        (await prisma.rubro.create({ data: { name: subrubro, parentId: rubro.id } }));
      subrubroId.set(`${name}/${subrubro}`, sub.id);
    }

    const created: { id: string; seed: ProductSeed }[] = [];
    for (const seed of PRODUCTS) {
      if (await prisma.product.findFirst({ where: { name: seed.name } })) continue;

      const barcode = await generateUniqueBarcode(prisma);
      const targetRubroId = seed.subrubro
        ? subrubroId.get(`${seed.rubro}/${seed.subrubro}`)!
        : rubroId.get(seed.rubro)!;

      const product = await prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            name: seed.name,
            brandId: brandId.get(seed.brand)!,
            rubroId: targetRubroId,
            barcode,
            barcodeIsGenerated: true,
            purchasePrice: seed.purchasePrice,
            salePrice: seed.salePrice,
            minStock: seed.minStock,
          },
        });
        await tx.productPriceHistory.create({
          data: { productId: p.id, purchasePrice: seed.purchasePrice, salePrice: seed.salePrice, changedByUserId: owner.id },
        });
        return p;
      });
      created.push({ id: product.id, seed });
    }

    if (withStock && created.length > 0) {
      // Por el mismo camino que un ingreso real (spec 006): cabecera, ítems y movimientos de stock.
      await prisma.$transaction(async (tx) => {
        const entry = await tx.stockEntry.create({ data: { supplierName: "Proveedor de prueba", userId: owner.id } });
        for (const { id, seed } of created) {
          await tx.stockEntryItem.create({
            data: { stockEntryId: entry.id, productId: id, quantity: seed.initialStock, purchasePrice: seed.purchasePrice, salePrice: seed.salePrice },
          });
          await registerStockMovement(tx, { productId: id, type: "INGRESO", quantity: seed.initialStock, userId: owner.id });
        }
      });
    }

    console.log(
      `Datos de prueba: ${BRANDS.length} marcas, ${RUBROS.length} rubros con su subrubro, ` +
        `${created.length} producto(s) nuevo(s) de ${PRODUCTS.length}` +
        (withStock && created.length > 0 ? ", con stock inicial." : "."),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error cargando los datos de prueba:", error);
  process.exit(1);
});
