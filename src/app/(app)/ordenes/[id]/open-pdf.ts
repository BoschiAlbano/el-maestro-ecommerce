import { toast } from "sonner";

/**
 * Descarga un PDF de la orden y lo abre en otra pestaña para imprimirlo
 * (specs/022 RF-16; specs/024 RF-17). Si el servidor no lo puede dar, muestra
 * el motivo en vez de una página de error. Devuelve si se abrió.
 */
export async function openPdf(url: string, fallbackError: string): Promise<boolean> {
  // La pestaña se abre ya, en el clic: si se abre después de esperar, el navegador la bloquea.
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(url);
    if (!response.ok) {
      tab?.close();
      toast.error(await response.text());
      return false;
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = objectUrl;
    else window.location.href = objectUrl;
    return true;
  } catch {
    tab?.close();
    toast.error(fallbackError);
    return false;
  }
}
