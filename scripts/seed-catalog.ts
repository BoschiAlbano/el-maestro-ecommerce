import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateUniqueBarcode } from "../src/lib/barcode";

// Carga un catálogo de ejemplo realista (5 rubros, 5 marcas, 50 productos)
// para reemplazar los datos de prueba, a pedido del cliente (2026-10-16).
// No son los productos reales del negocio todavía — son un catálogo
// plausible para empezar a usar la app con datos que no sean "Zapatito" o
// "Producto de prueba 123"; se ajusta después con los datos reales.
//
// Corre con: npx tsx scripts/seed-catalog.ts

const RUBROS = ["Tecnología", "Celulares y Accesorios", "Perfumería", "Juegos de PC", "Ropa"];
const BRANDS = ["Xiaomi", "Samsung", "JBL", "Razer", "Lacoste"];

type ProductSeed = {
  name: string;
  brand: string;
  rubro: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
};

const PRODUCTS: ProductSeed[] = [
  // Tecnología
  { name: "Auricular Bluetooth JBL Tune 510BT", brand: "JBL", rubro: "Tecnología", purchasePrice: 35000, salePrice: 55000, minStock: 5 },
  { name: "Parlante Portátil JBL Clip 4", brand: "JBL", rubro: "Tecnología", purchasePrice: 42000, salePrice: 68000, minStock: 5 },
  { name: "Power Bank Xiaomi 20000mAh", brand: "Xiaomi", rubro: "Tecnología", purchasePrice: 28000, salePrice: 45000, minStock: 8 },
  { name: "Smartwatch Xiaomi Mi Band 8", brand: "Xiaomi", rubro: "Tecnología", purchasePrice: 32000, salePrice: 52000, minStock: 6 },
  { name: "Tablet Samsung Galaxy Tab A9", brand: "Samsung", rubro: "Tecnología", purchasePrice: 180000, salePrice: 260000, minStock: 3 },
  { name: "Cargador Rápido Samsung 25W", brand: "Samsung", rubro: "Tecnología", purchasePrice: 15000, salePrice: 26000, minStock: 10 },
  { name: "Auricular Inalámbrico Xiaomi Buds 4", brand: "Xiaomi", rubro: "Tecnología", purchasePrice: 38000, salePrice: 60000, minStock: 6 },
  { name: "Parlante Bluetooth JBL Go 3", brand: "JBL", rubro: "Tecnología", purchasePrice: 25000, salePrice: 40000, minStock: 8 },
  { name: "Mouse Inalámbrico Xiaomi", brand: "Xiaomi", rubro: "Tecnología", purchasePrice: 12000, salePrice: 21000, minStock: 10 },
  { name: "Cable USB-C Xiaomi 1m", brand: "Xiaomi", rubro: "Tecnología", purchasePrice: 6000, salePrice: 12000, minStock: 15 },
  // Celulares y Accesorios
  { name: "Celular Xiaomi Redmi 13C", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 220000, salePrice: 320000, minStock: 3 },
  { name: "Celular Samsung Galaxy A15", brand: "Samsung", rubro: "Celulares y Accesorios", purchasePrice: 280000, salePrice: 400000, minStock: 3 },
  { name: "Celular Xiaomi Redmi Note 13", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 310000, salePrice: 450000, minStock: 2 },
  { name: "Celular Samsung Galaxy A55", brand: "Samsung", rubro: "Celulares y Accesorios", purchasePrice: 520000, salePrice: 720000, minStock: 2 },
  { name: "Funda Silicona Celular Universal", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 5000, salePrice: 10000, minStock: 20 },
  { name: "Vidrio Templado Universal", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 3000, salePrice: 7000, minStock: 20 },
  { name: "Cargador de Auto Samsung", brand: "Samsung", rubro: "Celulares y Accesorios", purchasePrice: 9000, salePrice: 16000, minStock: 10 },
  { name: "Soporte de Auto para Celular", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 7000, salePrice: 14000, minStock: 10 },
  { name: "Memoria MicroSD Samsung 128GB", brand: "Samsung", rubro: "Celulares y Accesorios", purchasePrice: 18000, salePrice: 29000, minStock: 8 },
  { name: "Batería Externa Xiaomi 10000mAh", brand: "Xiaomi", rubro: "Celulares y Accesorios", purchasePrice: 20000, salePrice: 33000, minStock: 8 },
  // Perfumería
  { name: "Perfume Lacoste Essential 100ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 45000, salePrice: 75000, minStock: 5 },
  { name: "Perfume Lacoste L.12.12 Blanc 100ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 48000, salePrice: 80000, minStock: 5 },
  { name: "Perfume Lacoste Pour Femme 90ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 46000, salePrice: 78000, minStock: 5 },
  { name: "Desodorante Lacoste Spray 150ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 12000, salePrice: 22000, minStock: 12 },
  { name: "Perfume Lacoste Match Point 100ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 50000, salePrice: 85000, minStock: 4 },
  { name: "Set Regalo Lacoste (perfume + desodorante)", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 55000, salePrice: 95000, minStock: 4 },
  { name: "Perfume Lacoste White 125ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 47000, salePrice: 79000, minStock: 5 },
  { name: "Body Spray Lacoste 200ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 10000, salePrice: 19000, minStock: 12 },
  { name: "Perfume Lacoste Original 100ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 44000, salePrice: 74000, minStock: 5 },
  { name: "Crema Hidratante Lacoste 75ml", brand: "Lacoste", rubro: "Perfumería", purchasePrice: 20000, salePrice: 34000, minStock: 6 },
  // Juegos de PC
  { name: "Mouse Gamer Razer DeathAdder", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 55000, salePrice: 90000, minStock: 5 },
  { name: "Teclado Mecánico Razer BlackWidow", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 95000, salePrice: 150000, minStock: 4 },
  { name: "Auricular Gamer Razer Kraken", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 75000, salePrice: 120000, minStock: 4 },
  { name: "Mousepad Razer Goliathus", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 18000, salePrice: 30000, minStock: 8 },
  { name: "Joystick PC Razer Wolverine", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 110000, salePrice: 170000, minStock: 3 },
  { name: "Silla Gamer Razer Iskur", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 450000, salePrice: 650000, minStock: 1 },
  { name: "Webcam Razer Kiyo", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 85000, salePrice: 135000, minStock: 3 },
  { name: "Micrófono Razer Seiren", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 70000, salePrice: 115000, minStock: 3 },
  { name: "Base Enfriadora Notebook Razer", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 40000, salePrice: 65000, minStock: 5 },
  { name: "Hub USB Razer", brand: "Razer", rubro: "Juegos de PC", purchasePrice: 25000, salePrice: 42000, minStock: 6 },
  // Ropa
  { name: "Remera Lacoste Clásica", brand: "Lacoste", rubro: "Ropa", purchasePrice: 30000, salePrice: 55000, minStock: 10 },
  { name: "Gorra Lacoste", brand: "Lacoste", rubro: "Ropa", purchasePrice: 18000, salePrice: 32000, minStock: 10 },
  { name: "Buzo Lacoste Canguro", brand: "Lacoste", rubro: "Ropa", purchasePrice: 45000, salePrice: 78000, minStock: 6 },
  { name: "Short Lacoste Deportivo", brand: "Lacoste", rubro: "Ropa", purchasePrice: 25000, salePrice: 44000, minStock: 8 },
  { name: "Campera Lacoste Rompevientos", brand: "Lacoste", rubro: "Ropa", purchasePrice: 60000, salePrice: 100000, minStock: 5 },
  { name: "Medias Lacoste (pack x3)", brand: "Lacoste", rubro: "Ropa", purchasePrice: 12000, salePrice: 22000, minStock: 15 },
  { name: "Billetera Lacoste Cuero", brand: "Lacoste", rubro: "Ropa", purchasePrice: 28000, salePrice: 48000, minStock: 6 },
  { name: "Cinturón Lacoste Cuero", brand: "Lacoste", rubro: "Ropa", purchasePrice: 22000, salePrice: 38000, minStock: 8 },
  { name: "Mochila Lacoste", brand: "Lacoste", rubro: "Ropa", purchasePrice: 42000, salePrice: 72000, minStock: 5 },
  { name: "Zapatillas Lacoste Urbanas", brand: "Lacoste", rubro: "Ropa", purchasePrice: 65000, salePrice: 110000, minStock: 4 },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const dueno = await prisma.user.findFirst({ where: { role: { isOwnerRole: true } } });
  if (!dueno) throw new Error("No hay un usuario Dueño — correr `pnpm db:seed` primero.");

  const brandByName = new Map<string, string>();
  for (const name of BRANDS) {
    const brand = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    brandByName.set(name, brand.id);
  }

  const rubroByName = new Map<string, string>();
  for (const name of RUBROS) {
    const existing = await prisma.rubro.findFirst({ where: { name, parentId: null } });
    const rubro = existing ?? (await prisma.rubro.create({ data: { name, parentId: null } }));
    rubroByName.set(name, rubro.id);
  }

  let created = 0;
  for (const item of PRODUCTS) {
    const barcode = await generateUniqueBarcode(prisma);
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: item.name,
          brandId: brandByName.get(item.brand)!,
          rubroId: rubroByName.get(item.rubro)!,
          barcode,
          barcodeIsGenerated: true,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          minStock: item.minStock,
        },
      });
      await tx.productPriceHistory.create({
        data: {
          productId: product.id,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          changedByUserId: dueno.id,
        },
      });
    });
    created++;
  }

  console.log(`Catálogo cargado: ${BRANDS.length} marcas, ${RUBROS.length} rubros, ${created} productos.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error cargando el catálogo:", error);
  process.exit(1);
});
