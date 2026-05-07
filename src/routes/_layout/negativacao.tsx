import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { processosMock, clientesMock, empresasMock } from "@/features/mocks/data";
import type { Processo } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/negativacao")({ component: NegativacaoPage });

function NegativacaoPage() {
  return (
    <ProtectedRoute perfis={["admin", "supervisor", "negativador"]}>
      <PageHeader titulo="Negativação" descricao="Itens elegíveis e em processo de negativação" />
      <Lista />
    </ProtectedRoute>
  );
}

function Lista() {
  const elegiveis = processosMock.filter((p) => p.diasVencidos >= 30);
  const colunas: Column<Processo>[] = [
    { key: "cliente", header: "Cliente", render: (r) => clientesMock.find((c) => c.id === r.clienteId)?.nome },
    { key: "empresa", header: "Empresa", render: (r) => empresasMock.find((e) => e.id === r.empresaId)?.nome },
    { key: "dias", header: "Dias vencidos", sortable: true, accessor: (r) => r.diasVencidos, render: (r) => `${r.diasVencidos}d` },
    { key: "valor", header: "Valor", sortable: true, accessor: (r) => r.valor, render: (r) => r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
    { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "negativado" ? "destructive" : "secondary"}>{r.status}</Badge> },
    { key: "acoes", header: "Ações", render: (r) => (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => toast.info(`Detalhes ${r.id}`)}>Detalhes</Button>
        <Button size="sm" onClick={() => toast.success("Status atualizado (mock)")}>Negativar</Button>
      </div>
    ) },
  ];
  return <DataTable data={elegiveis} columns={colunas} />;
}
