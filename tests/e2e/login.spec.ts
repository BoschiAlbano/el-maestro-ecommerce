import "dotenv/config";
import { test, expect } from "@playwright/test";

// La protección de sesión vive en los Server Components, no en middleware
// (ver specs/001-base-del-proyecto/plan.md, sección 7).

test("sin sesión, / redirige a /login y se ve el formulario", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Iniciar sesión")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
});

test("login con credenciales inválidas muestra un error, no rompe", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("no-existe@example.com");
  await page.getByLabel("Contraseña").fill("lo-que-sea-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
});

test("login con el usuario de la semilla entra, muestra su email y puede salir", async ({
  page,
}) => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  test.skip(!email || !password, "Correr `npm run db:seed` primero (faltan SEED_ADMIN_* en .env).");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(email!)).toBeVisible();

  // Ir directo a /login con sesión activa redirige de nuevo a /.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
