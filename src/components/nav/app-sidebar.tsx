"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { LogoutButton } from "./logout-button";
import { groupedNavItems, visibleNavItems, NAV_GROUP_LABELS } from "./nav-items";
import type { UserLike } from "@/lib/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  /** Datos serializables; el filtrado (con íconos) se hace acá, en cliente —
   * los íconos no se pueden pasar como prop desde un Server Component. */
  user: UserLike;
};

/** Navegación principal: barra lateral en PC, cajón deslizable en celular (lo resuelve el propio componente Sidebar). */
export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const sections = groupedNavItems(visibleNavItems(user));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BrandMark className="px-2 py-1.5" />
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => {
          const label = NAV_GROUP_LABELS[section.group];
          return (
            <SidebarGroup key={section.group}>
              {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;

                    if (!item.enabled) {
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton disabled tooltip={`${item.label} (pronto)`}>
                            <Icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
