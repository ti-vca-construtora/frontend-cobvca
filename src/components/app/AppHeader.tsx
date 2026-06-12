import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search, Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/features/auth/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const labelPerfil: Record<string, string> = {
  administrador: "Admin", supervisor: "Supervisor", cobrador: "Cobrador", negativador: "Negativador",
};

export function AppHeader() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (!usuario) return null;

  const nomeSeguro = (usuario.nome || usuario.email || "Usuário").trim();
  const iniciais = nomeSeguro.split(" ").map((s) => s[0]).slice(0, 2).join("");

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <header className="h-14 border-b flex items-center gap-3 px-4 bg-background sticky top-0 z-20">
      <SidebarTrigger />
      <div className="relative flex-1 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar processo, cliente, documento..." className="pl-9 h-9" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Alternar tema">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{iniciais}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start leading-none">
                <span className="text-sm font-medium">{nomeSeguro}</span>
                <span className="text-xs text-muted-foreground">{labelPerfil[usuario.perfil] ?? usuario.perfil}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{nomeSeguro}</span>
                <span className="text-xs font-normal text-muted-foreground">{usuario.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
