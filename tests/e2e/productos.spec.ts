import "dotenv/config";
import path from "node:path";
import { test, expect } from "@playwright/test";

const TEST_PHOTO = path.join(import.meta.dirname, "fixtures", "test-photo.png");

const duenoEmail = process.env.SEED_ADMIN_EMAIL;
const duenoPassword = process.env.SEED_ADMIN_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(
    !duenoEmail || !duenoPassword,
    "Correr `pnpm db:seed` primero (faltan SEED_ADMIN_* en .env).",
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill(duenoEmail!);
  await page.getByLabel("Contraseña").fill(duenoPassword!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("crear un rubro y un producto sin código de barras genera uno propio", async ({ page }) => {
  const suffix = Date.now();
  const rubroName = `Rubro de prueba ${suffix}`;
  const productName = `Producto de prueba ${suffix}`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();

  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();

  // El código generado se ve en el input de código de barras: 13 dígitos, prefijo 20-29.
  const barcodeInput = page.getByLabel(/Código de barras/);
  const barcode = await barcodeInput.inputValue();
  expect(barcode).toMatch(/^\d{13}$/);
  expect(Number(barcode.slice(0, 2))).toBeGreaterThanOrEqual(20);
  expect(Number(barcode.slice(0, 2))).toBeLessThanOrEqual(29);

  await expect(page.getByText("$100")).toBeVisible();
  await expect(page.getByText("$150")).toBeVisible();
});

test("la búsqueda por nombre y el filtro por rubro muestran solo lo que corresponde", async ({
  page,
}) => {
  const suffix = Date.now();
  const rubroA = `Rubro A ${suffix}`;
  const rubroB = `Rubro B ${suffix}`;
  const productoA = `Zapatito ${suffix}`;
  const productoB = `Remera ${suffix}`;

  for (const name of [rubroA, rubroB]) {
    await page.goto("/rubros");
    await page.getByLabel("Nombre").fill(name);
    await page.getByRole("button", { name: "Agregar" }).click();
    await expect(page.locator(`input[value="${name}"]`)).toBeVisible();
  }

  for (const [productName, rubroName] of [
    [productoA, rubroA],
    [productoB, rubroB],
  ]) {
    await page.goto("/productos/nuevo");
    await page.getByLabel("Nombre").fill(productName);
    await page.getByLabel("Rubro").click();
    await page.getByRole("option", { name: rubroName }).click();
    await page.getByLabel("Precio de compra").fill("10");
    await page.getByLabel("Precio de venta").fill("20");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  }

  // Búsqueda por nombre: solo el producto A.
  await page.goto(`/productos?q=${encodeURIComponent(productoA)}`);
  await expect(page.getByRole("cell", { name: productoA })).toBeVisible();
  await expect(page.getByRole("cell", { name: productoB })).toHaveCount(0);

  // Filtro por rubro B: solo el producto B.
  await page.goto("/productos");
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroB }).click();
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("cell", { name: productoB })).toBeVisible();
  await expect(page.getByRole("cell", { name: productoA })).toHaveCount(0);
});

test("se puede subir una foto al crear un producto y queda visible en la ficha", async ({ page }) => {
  const suffix = Date.now();
  const rubroName = `Rubro foto ${suffix}`;
  const productName = `Producto con foto ${suffix}`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("10");
  await page.getByLabel("Precio de venta").fill("20");
  await page.getByLabel("Foto (opcional)").setInputFiles(TEST_PHOTO);
  await page.getByRole("button", { name: "Crear producto" }).click();

  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  const photo = page.getByRole("img", { name: productName });
  await expect(photo).toBeVisible();
  const src = await photo.getAttribute("src");
  expect(src).toMatch(/^https:\/\/.*supabase\.co\/storage\/v1\/object\/public\/product-photos\//);
});

test("importar un CSV con filas válidas e inválidas mezcladas señala los errores antes de confirmar", async ({
  page,
}) => {
  const suffix = Date.now();
  const nombre1 = `Import uno ${suffix}`;
  const nombre2 = `Import dos ${suffix}`;
  const rubro = `Rubro import ${suffix}`;
  const csv = [
    "Nombre,Marca,Rubro,Subrubro,Código de barras,Precio de compra,Precio de venta,Stock mínimo",
    `${nombre1},Marca Import,${rubro},,,500,800,3`,
    `,Marca Import,${rubro},,,500,800,3`,
    `${nombre2},Marca Import,${rubro},,,200,300,`,
  ].join("\n");

  await page.goto("/productos/importar");
  await page.getByLabel(/Archivo/).setInputFiles({
    name: "importar.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });
  await page.getByRole("button", { name: "Previsualizar" }).click();

  await expect(page.getByText("2 filas válidas, 1 con error.")).toBeVisible();
  await expect(page.getByText("Falta el nombre.")).toBeVisible();

  await page.getByRole("button", { name: /Confirmar importación/ }).click();
  await expect(page.getByText("Se importaron 2 productos correctamente.")).toBeVisible();

  await page.goto(`/productos?q=${encodeURIComponent(nombre1)}`);
  await expect(page.getByRole("cell", { name: nombre1 })).toBeVisible();
  await page.goto(`/productos?q=${encodeURIComponent(nombre2)}`);
  await expect(page.getByRole("cell", { name: nombre2 })).toBeVisible();
});

test("se puede elegir un producto y generar su etiqueta con código de barras dibujado", async ({
  page,
}) => {
  const suffix = Date.now();
  const rubroName = `Rubro etiqueta ${suffix}`;
  const productName = `Producto etiqueta ${suffix}`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();

  await page.goto("/productos/etiquetas");
  const row = page.getByRole("row", { name: new RegExp(productName) });
  await row.getByRole("checkbox").click();
  await page.getByRole("button", { name: /Imprimir etiquetas seleccionadas/ }).click();

  await expect(page).toHaveURL(/\/productos\/etiquetas\/imprimir\?ids=/);
  await expect(page.getByText(productName)).toBeVisible();
  await expect(page.getByText("$150")).toBeVisible();
  // El SVG del código de barras tiene que haberse dibujado (jsbarcode le agrega rects/paths).
  await expect(page.locator("svg rect").first()).toBeVisible();
});

test("un producto creado con código de barras propio guarda ese código tal cual, sin generar uno nuevo", async ({
  page,
}) => {
  const suffix = Date.now();
  const rubroName = `Rubro propio ${suffix}`;
  const productName = `Producto con código propio ${suffix}`;
  const ownBarcode = `779${String(suffix).slice(-10)}`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel(/Código de barras/).fill(ownBarcode);
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();

  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  await expect(page.getByLabel(/Código de barras/)).toHaveValue(ownBarcode);
});

test("cambiar el precio de un producto agrega una fila al historial sin perder la anterior", async ({
  page,
}) => {
  const suffix = Date.now();
  const rubroName = `Rubro historial ${suffix}`;
  const productName = `Producto historial ${suffix}`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  const productUrl = page.url();

  await page.getByLabel("Precio de venta").fill("180");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  // updateProduct redirige a /productos (no se queda en la ficha) al guardar.
  await expect(page).toHaveURL(/\/productos$/);

  await page.goto(productUrl);
  await expect(page.getByLabel("Precio de venta")).toHaveValue("180");

  const historyTable = page.locator("table").last();
  const historyRows = historyTable.getByRole("row").filter({ hasText: "$" });
  await expect(historyRows).toHaveCount(2);
  await expect(page.getByText("$180")).toBeVisible();
  await expect(page.getByText("$150")).toBeVisible();
});

test("desactivar un producto lo marca inactivo en la lista y permite reactivarlo", async ({ page }) => {
  const suffix = Date.now();
  const rubroName = `Rubro baja ${suffix}`;
  const productName = `Producto para dar de baja ${suffix}`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();

  await page.getByRole("button", { name: "Desactivar producto" }).click();
  await expect(page.getByRole("button", { name: "Reactivar producto" })).toBeVisible();

  await page.goto(`/productos?q=${encodeURIComponent(productName)}`);
  await expect(page.getByRole("row", { name: new RegExp(productName) }).getByText("Inactivo")).toBeVisible();
});

test("un usuario sin el permiso de ver costos y márgenes no ve el precio de compra del catálogo", async ({
  page,
}) => {
  const suffix = Date.now();
  const roleName = `Vendedor sin costos ${suffix}`;
  const userEmail = `vendedor-${suffix}@importadora.local`;
  const userPassword = "Password123!";
  const rubroName = `Rubro sin costos ${suffix}`;
  const productName = `Producto sin costos visibles ${suffix}`;

  // Rubro y producto como Dueño, con Catálogo + "ver costos" + "cambiar precios".
  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();

  // Rol con Catálogo "ver" pero sin el permiso especial "verCostosMargenes".
  await page.goto("/roles/nuevo");
  await page.getByLabel("Nombre del rol").fill(roleName);
  const catalogoRow = page.getByRole("row").filter({ hasText: "Catálogo" });
  await catalogoRow.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByText(roleName)).toBeVisible();

  await page.goto("/usuarios/nuevo");
  await page.getByLabel("Nombre").fill("Vendedor de prueba");
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña inicial").fill(userPassword);
  await page.getByLabel("Rol").click();
  await page.getByRole("option", { name: roleName }).click();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page).toHaveURL(/\/usuarios$/);

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña").fill(userPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/productos");
  await expect(page.getByRole("columnheader", { name: "Compra" })).toHaveCount(0);
  await expect(page.getByText("$100")).toHaveCount(0);

  // Dejar la sesión como estaba (Dueño) para no afectar otros tests.
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(duenoEmail!);
  await page.getByLabel("Contraseña").fill(duenoPassword!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("no se puede borrar una marca ni un rubro que tienen productos asociados", async ({ page }) => {
  const suffix = Date.now();
  const brandName = `Marca con productos ${suffix}`;
  const rubroName = `Rubro con productos ${suffix}`;
  const productName = `Producto para no borrar ${suffix}`;

  await page.goto("/marcas");
  await page.getByPlaceholder("Nombre de la marca").fill(brandName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${brandName}"]`)).toBeVisible();

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Marca").click();
  await page.getByRole("option", { name: brandName }).click();
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();

  // Los nombres de marca/rubro van dentro del `value` de un <input>, no como
  // texto plano — por eso se filtra la fila por ese input, no por `hasText`.
  await page.goto("/marcas");
  const brandRow = page
    .getByRole("row")
    .filter({ has: page.locator(`input[value="${brandName}"]`) });
  await brandRow.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("No se puede borrar una marca con productos asociados.")).toBeVisible();

  // Las filas de rubro son un <div>, no una fila de tabla.
  await page.goto("/rubros");
  const rubroRow = page.locator(`input[value="${rubroName}"]`).locator("..");
  await rubroRow.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("No se puede borrar un rubro con productos asociados.")).toBeVisible();
});

test("un usuario con 'editar' pero sin 'cambiar precios' puede cambiar otros datos pero no el precio", async ({
  page,
}) => {
  const suffix = Date.now();
  const roleName = `Editor sin precios ${suffix}`;
  const userEmail = `editor-${suffix}@importadora.local`;
  const userPassword = "Password123!";
  const rubroName = `Rubro editor ${suffix}`;
  const productName = `Producto editable sin precio ${suffix}`;
  const newProductName = `${productName} (editado)`;

  await page.goto("/rubros");
  await page.getByLabel("Nombre").fill(rubroName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.locator(`input[value="${rubroName}"]`)).toBeVisible();

  await page.goto("/productos/nuevo");
  await page.getByLabel("Nombre").fill(productName);
  await page.getByLabel("Rubro").click();
  await page.getByRole("option", { name: rubroName }).click();
  await page.getByLabel("Precio de compra").fill("100");
  await page.getByLabel("Precio de venta").fill("150");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/productos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  const productUrl = page.url();

  // Rol con Catálogo "ver" + "editar", sin el permiso especial "cambiar precios".
  await page.goto("/roles/nuevo");
  await page.getByLabel("Nombre del rol").fill(roleName);
  const catalogoRow = page.getByRole("row").filter({ hasText: "Catálogo" });
  const catalogoCheckboxes = catalogoRow.getByRole("checkbox");
  await catalogoCheckboxes.nth(0).click(); // Ver
  await catalogoCheckboxes.nth(2).click(); // Editar
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByText(roleName)).toBeVisible();

  await page.goto("/usuarios/nuevo");
  await page.getByLabel("Nombre").fill("Editor de prueba");
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña inicial").fill(userPassword);
  await page.getByLabel("Rol").click();
  await page.getByRole("option", { name: roleName }).click();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page).toHaveURL(/\/usuarios$/);

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña").fill(userPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto(productUrl);
  // El formulario ya deshabilita los precios para quien no tiene el permiso
  // especial: no se puede ni intentar tocarlos desde la interfaz normal.
  await expect(page.getByLabel("Precio de venta")).toBeDisabled();
  await expect(page.getByText("No tenés permiso para cambiar precios.")).toBeVisible();

  await page.getByLabel("Nombre").fill(newProductName);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/productos$/);

  await page.goto(productUrl);
  await expect(page.getByRole("heading", { name: newProductName })).toBeVisible();
  await expect(page.getByLabel("Precio de venta")).toHaveValue("150");

  // Defensa en profundidad: aunque la interfaz deshabilita el campo, el
  // servidor tiene que rechazar el precio igual si alguien lo fuerza
  // (saltándose el atributo disabled, como con las herramientas del navegador).
  await page.locator("#purchasePrice").evaluate((el: HTMLInputElement) => {
    el.disabled = false;
  });
  await page.locator("#salePrice").evaluate((el: HTMLInputElement) => {
    el.disabled = false;
    el.value = "999";
  });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText("Se guardaron los demás cambios, pero no tenés permiso para cambiar el precio."),
  ).toBeVisible();
  await page.goto(productUrl);
  await expect(page.getByLabel("Precio de venta")).toHaveValue("150");

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(duenoEmail!);
  await page.getByLabel("Contraseña").fill(duenoPassword!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
});
