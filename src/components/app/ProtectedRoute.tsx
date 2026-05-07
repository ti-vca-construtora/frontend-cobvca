import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import type { Perfil } from "@/types";
import { ShieldOff } from "lucide-react";

export function ProtectedRoute({
  perfis,
  children,
}: {
  perfis: Perfil[];
  children: ReactNode;
}) {
  const { temPerfil } = useAuth();
  if (!temPerfil(perfis)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Sem permissão</h2>
        <p className="text-muted-foreground mt-2">
          Você não tem acesso a esta área. Fale com um administrador.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
