import { redirect } from "next/navigation";

/**
 * La publicación pasó a ser una pestaña de la ficha del producto (specs/025,
 * RF-11). Esta dirección se conserva para que no se rompan los enlaces.
 */
export default async function PublicarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/productos/${id}?tab=mercadolibre`);
}
