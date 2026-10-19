"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { href: "/productos", label: "Productos" },
  { href: "/marcas", label: "Marcas" },
  { href: "/rubros", label: "Rubros" },
];

/** Navegación entre las tres listas del catálogo (son páginas separadas, no vistas de una sola). */
export function CatalogTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const current = TABS.find((tab) => tab.href === pathname)?.href ?? TABS[0].href;

  return (
    <Tabs value={current} onValueChange={(value) => router.push(value as string)}>
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.href} value={tab.href}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
