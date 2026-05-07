import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const parts = pathname.split("/").filter(Boolean);

  return (
    <div className="flex flex-col gap-2 mb-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
          <Home className="h-3 w-3" /> Home
        </Link>
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <span className="capitalize">{decodeURIComponent(p).replace(/-/g, " ")}</span>
          </span>
        ))}
      </nav>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descricao && <p className="text-sm text-muted-foreground mt-1">{descricao}</p>}
        </div>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>
    </div>
  );
}
