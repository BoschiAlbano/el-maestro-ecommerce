import "dotenv/config";
import { test, expect } from "@playwright/test";

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

test("crear un usuario genera una entrada de auditoría visible y filtrable", async ({ page }) => {
  const suffix = Date.now();
  const userEmail = `auditoria-${suffix}@importadora.local`;

  await page.goto("/usuarios/nuevo");
  await page.getByLabel("Nombre").fill("Usuario auditado");
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña inicial").fill("Password123!");
  await page.getByLabel("Rol").click();
  await page.getByRole("option", { name: "Cajero" }).click();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page).toHaveURL(/\/usuarios$/);

  await page.goto("/configuracion/auditoria");
  await expect(page.getByText(userEmail)).toBeVisible();
  await expect(page.getByText("Usuario creado").first()).toBeVisible();

  // Filtrar por acción: "Usuario creado" sigue apareciendo.
  await page.getByLabel("Acción").click();
  await page.getByRole("option", { name: "Usuario creado" }).click();
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText(userEmail)).toBeVisible();

  // Filtrar por una acción distinta: ya no aparece.
  await page.getByLabel("Acción").click();
  await page.getByRole("option", { name: "Rol borrado" }).click();
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText(userEmail)).not.toBeVisible();
  await expect(page.getByText("No hay entradas para estos filtros.")).toBeVisible();

  // No hay ninguna forma de editar o borrar una entrada desde esta pantalla.
  await expect(page.getByRole("button", { name: /editar/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /borrar/i })).toHaveCount(0);
});

test("un rol con permiso \"ver\" en Configuración ve esa sección sin ser Dueño", async ({ page }) => {
  const suffix = Date.now();
  const roleName = `Config de prueba ${suffix}`;
  const userEmail = `config-${suffix}@importadora.local`;
  const userPassword = "Password123!";

  // Rol nuevo con "ver" marcado solo en la fila Configuración.
  await page.goto("/roles/nuevo");
  await page.getByLabel("Nombre del rol").fill(roleName);
  await page
    .getByRole("row", { name: "Configuración" })
    .getByRole("checkbox")
    .first()
    .click();
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page).toHaveURL(/\/roles$/);

  await page.goto("/usuarios/nuevo");
  await page.getByLabel("Nombre").fill("Usuario config");
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

  // Ve "Configuración" (tiene el permiso) pero no "Usuarios" (no es Dueño).
  await expect(page.getByRole("link", { name: "Configuración" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);

  // Puede ver la pantalla, pero no editarla (sin permiso "editar").
  await page.goto("/configuracion");
  await expect(page.getByText("Tenés permiso para ver estos datos, pero no para editarlos.")).toBeVisible();
});
