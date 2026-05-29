import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Search, Ban, HandCoins, FolderKanban,
  Settings, FileText, ArrowLeftRight, Building2, Cog, Undo2, CalendarDays,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/AuthContext";
import type { Perfil } from "@/types";

interface Item {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  perfis?: Perfil[];
}

const grupos: { label: string; items: Item[] }[] = [
  {
    label: "Geral",
    items: [
      { title: "Home", url: "/", icon: LayoutDashboard },
      { title: "Consultas", url: "/consultas", icon: Search },
    ],
  },
  {
    label: "Negativação",
    items: [
      { title: "Negativação", url: "/negativacao", icon: Ban, perfis: ["administrador", "supervisor", "negativador"] },
      { title: "Retiradas", url: "/negativacao/retiradas", icon: Undo2, perfis: ["administrador", "supervisor", "negativador"] },
    ],
  },
  {
    label: "Cobrança",
    items: [
      { title: "Meus Processos", url: "/cobranca/meus-processos", icon: FolderKanban, perfis: ["administrador", "supervisor", "cobrador"] },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Tratativa Interna", url: "/admin/tratativa-interna", icon: FileText },
      { title: "CV x Sienge", url: "/admin/cv-sienge", icon: ArrowLeftRight, perfis: ["administrador", "supervisor"] },
      { title: "Empreendimento", url: "/admin/empreendimento", icon: Building2, perfis: ["administrador", "supervisor"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Cronograma", url: "/cronograma", icon: CalendarDays, perfis: ["administrador"] },
      { title: "Configurações", url: "/configuracoes", icon: Cog, perfis: ["administrador"] },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { usuario } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold">C</div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-none">Cobranças</span>
            <span className="text-xs text-muted-foreground">Operação Interna</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {grupos.map((g) => {
          const items = g.items.filter((i) => !i.perfis || (usuario && i.perfis.includes(usuario.perfil)));
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const ativo = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={ativo}>
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
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
    </Sidebar>
  );
}
