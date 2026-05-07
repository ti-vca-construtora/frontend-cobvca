import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/features/auth/AuthContext";
import { empresasMock } from "@/features/mocks/data";
import { useEffect, useState } from "react";

const labelPerfil: Record<string, string> = {
  admin: "Admin", supervisor: "Supervisor", cobrador: "Cobrador", negativador: "Negativador",
};

export function AppHeader() {
  const { usuario, usuarios, trocarUsuario } = useAuth();
  const [dark, setDark] = useState(false);
  const [empresa, setEmpresa] = useState(empresasMock[0].id);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const iniciais = usuario.nome.split(" ").map((s) => s[0]).slice(0, 2).join("");

  return (
    <header className="h-14 border-b flex items-center gap-3 px-4 bg-background sticky top-0 z-20">
      <SidebarTrigger />
      <div className="relative flex-1 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar processo, cliente, documento..." className="pl-9 h-9" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="h-9 w-[200px] hidden md:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {empresasMock.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <span className="text-sm font-medium">{usuario.nome}</span>
                <span className="text-xs text-muted-foreground">{labelPerfil[usuario.perfil]}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Trocar usuário (mock)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {usuarios.map((u) => (
              <DropdownMenuItem key={u.id} onClick={() => trocarUsuario(u.id)}>
                <div className="flex flex-col">
                  <span>{u.nome}</span>
                  <span className="text-xs text-muted-foreground">{labelPerfil[u.perfil]}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
