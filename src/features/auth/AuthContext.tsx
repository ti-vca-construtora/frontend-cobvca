import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, removeToken, getToken } from "@/lib/api";
import type { Perfil, Usuario } from "@/types";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    role: Perfil;
    status: string;
  };
}

interface AuthCtx {
  usuario: Usuario | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  temPerfil: (perfis: Perfil[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

function apiUserToUsuario(u: LoginResponse["user"]): Usuario {
  return {
    id: u.id,
    userId: u.user_id,
    nome: u.full_name,
    email: u.email,
    perfil: u.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [ready, setReady] = useState(false);

  // Restaura sessão do localStorage ao iniciar
  useEffect(() => {
    const token = getToken();
    const stored = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
    if (token && stored) {
      try {
        setUsuario(JSON.parse(stored) as Usuario);
      } catch {
        removeToken();
        localStorage.removeItem("auth_user");
      }
    }
    setReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<LoginResponse>("/auth/login", { email, password });
    setToken(data.accessToken);
    const u = apiUserToUsuario(data.user);
    localStorage.setItem("auth_user", JSON.stringify(u));
    setUsuario(u);
  };

  const logout = () => {
    removeToken();
    localStorage.removeItem("auth_user");
    setUsuario(null);
  };

  const temPerfil = (perfis: Perfil[]) =>
    usuario !== null && perfis.includes(usuario.perfil);

  if (!ready) return null;

  return (
    <Ctx.Provider value={{ usuario, login, logout, temPerfil }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
