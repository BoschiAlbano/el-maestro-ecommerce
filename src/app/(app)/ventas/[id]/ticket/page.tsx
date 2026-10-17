import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.VENTAS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver este ticket.</p>;
  }

  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { user: true, items: { include: { product: true } } },
  });
  if (!sale) notFound();

  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2 print:hidden">
        <PrintButton />
        <Link href="/ventas" className="text-sm underline">
          Volver a vender
        </Link>
      </div>

      <div className="w-[58mm] bg-white p-2 font-mono text-[10px] leading-tight text-black print:w-[58mm]">
        {settings.razonSocial && <p className="text-center font-bold">{settings.razonSocial}</p>}
        {sale.voidedAt && <p className="text-center font-bold">** VENTA ANULADA **</p>}
        <p className="text-center">Ticket #{sale.ticketNumber}</p>
        <p className="text-center">
          {new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Argentina/Tucuman",
          }).format(sale.createdAt)}
        </p>
        <p className="text-center">Atendió: {sale.user.name}</p>
        <hr className="my-1 border-dashed border-black" />
        {sale.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-1">
            <span>
              {item.quantity} x {item.product.name}
            </span>
            <span>${(item.quantity * item.unitSalePrice.toNumber()).toFixed(0)}</span>
          </div>
        ))}
        <hr className="my-1 border-dashed border-black" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>${sale.total.toFixed(0)}</span>
        </div>
        {settings.textoTicketAdicional && (
          <p className="mt-1 text-center">{settings.textoTicketAdicional}</p>
        )}
        <p className="mt-2 text-center font-bold">DOCUMENTO NO VÁLIDO COMO FACTURA</p>
      </div>
    </div>
  );
}
