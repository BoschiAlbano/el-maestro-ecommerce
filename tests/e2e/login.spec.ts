import { test, expect } from "@playwright/test";

// Smoke test que no necesita un usuario real: solo prueba que sin sesión
// el middleware redirige a /login y que el formulario se ve.
// El camino "con sesión" (T-008) se prueba a mano hasta que exista un
// usuario de prueba en el proyecto de Supabase.

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
