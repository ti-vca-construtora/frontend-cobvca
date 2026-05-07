import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usuariosMock } from "@/features/mocks/data";
import type { Perfil, Usuario } from "@/types";

interface AuthCtx {
  usuario: Usuario;
  trocarUsuario: (id: string) => void;
  usuarios: Usuario[];
  temPerfil: (perfis: Perfil[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "mock_user_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario>(usuariosMock[0]);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (id) {
      const found = usuariosMock.find((u) => u.id === id);
      if (found) setUsuario(found);
    }
  }, []);

  const trocarUsuario = (id: string) => {
    const found = usuariosMock.find((u) => u.id === id);
    if (found) {
      setUsuario(found);
      localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const temPerfil = (perfis: Perfil[]) => perfis.includes(usuario.perfil);

  return (
    <Ctx.Provider value={{ usuario, trocarUsuario, usuarios: usuariosMock, temPerfil }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
