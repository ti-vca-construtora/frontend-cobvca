import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notificacoesMock } from "@/features/mocks/data";

export function NotificationBell() {
  const naoLidas = notificacoesMock.filter((n) => !n.lida).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b font-medium text-sm">Notificações</div>
        <ul className="max-h-72 overflow-auto">
          {notificacoesMock.map((n) => (
            <li key={n.id} className="px-4 py-3 border-b last:border-0 text-sm hover:bg-muted/50">
              <p>{n.mensagem}</p>
              <p className="text-xs text-muted-foreground mt-1">{n.criadoEm}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
