import "dotenv/config";
import { test, expect } from "@playwright/test";

// Flujo completo de specs/002: el Dueño crea un rol limitado y un usuario
// con ese rol; ese usuario entra y no ve "Usuarios"; entrar directo por URL
// queda bloqueado por el servidor (page.tsx), no solo oculto por la interfaz.

const duenoEmail = process.env.SEED_ADMIN_EMAIL;
const duenoPassword = process.env.SEED_ADMIN_PASSWORD;

test("el Dueño crea un rol limitado y un usuario; ese usuario no ve Usuarios ni puede entrar por URL", async ({
  page,
}) => {
  test.skip(
    !duenoEmail || !duenoPassword,
    "Correr `pnpm db:seed` primero (faltan SEED_ADMIN_* en .env).",
  );

  const suffix = Date.now();
  const roleName = `Rol de prueba ${suffix}`;
  const userEmail = `prueba-${suffix}@importadora.local`;
  const userPassword = "Password123!";

  // --- Login como Dueño ---
  await page.goto("/login");
  await page.getByLabel("Email").fill(duenoEmail!);
  await page.getByLabel("Contraseña").fill(duenoPassword!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  // --- Crear un rol sin ningún permiso marcado ---
  await page.goto("/roles/nuevo");
  await page.getByLabel("Nombre del rol").fill(roleName);
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByText(roleName)).toBeVisible();

  // --- Crear un usuario con ese rol ---
  await page.goto("/usuarios/nuevo");
  await page.getByLabel("Nombre").fill("Usuario de prueba");
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña inicial").fill(userPassword);
  await page.getByLabel("Rol").click();
  await page.getByRole("option", { name: roleName }).click();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page).toHaveURL(/\/usuarios$/);
  await expect(page.getByText(userEmail)).toBeVisible();

  // --- Logout del Dueño, login con el usuario limitado ---
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Contraseña").fill(userPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  // --- No ve "Usuarios" en la navegación ---
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);

  // --- Entrar directo por URL: lo bloquea el servidor, no la interfaz ---
  await page.goto("/usuarios");
  await expect(page.getByText("Esta sección es solo para el Dueño.")).toBeVisible();

  await page.goto("/roles");
  await expect(page.getByText("Esta sección es solo para el Dueño.")).toBeVisible();
});
