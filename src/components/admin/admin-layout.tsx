import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  BarChart3,
  Share2,
  Settings,
  ScrollText,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const items = [
  { title: "Главная", url: "/dashboard", icon: LayoutDashboard },
  { title: "Пользователи", url: "/users", icon: Users },
  { title: "Тесты", url: "/quizzes", icon: ListChecks },
  { title: "Результаты", url: "/results", icon: BarChart3 },
  { title: "Рефералы", url: "/referrals", icon: Share2 },
  { title: "Настройки MAX", url: "/max-settings", icon: Settings },
  { title: "Журнал событий", url: "/events", icon: ScrollText },
] as const;

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Честно о себе</p>
            <p className="truncate text-xs text-muted-foreground">Панель администратора</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Разделы</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 pb-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Канал «Чудеса за полчаса»
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur sm:px-6">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
