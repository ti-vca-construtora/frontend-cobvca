import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { empreendimentosMock, empresasMock } from "@/features/mocks/data";
import type { Empreendimento } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/admin/empreendimento")({ component: EmpreendimentoPage });

function EmpreendimentoPage() {
  return (
    <ProtectedRoute perfis={["admin", "supervisor"]}>
      <PageHeader titulo="Empreendimentos" descricao="Categorize os empreendimentos como Lote ou Incorporação" />
      <Conteudo />
    </ProtectedRoute>
  );
}

function Conteudo() {
  const pendentes = empreendimentosMock.filter((e) => !e.categoria).length;
  const colunas: Column<Empreendimento>[] = [
    { key: "nome", header: "Nome", sortable: true, accessor: (r) => r.nome },
    { key: "empresa", header: "Empresa", render: (r) => empresasMock.find((e) => e.id === r.empresaId)?.nome },
    { key: "categoria", header: "Categoria", render: (r) => (
      <div className="flex items-center gap-2">
        {r.categoria
          ? <Badge variant="secondary">{r.categoria}</Badge>
          : <Badge variant="destructive">Sem categoria</Badge>}
        <Select defaultValue={r.categoria ?? undefined} onValueChange={(v) => toast.success(`Categoria atualizada: ${v} (mock)`)}>
          <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Definir..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Lote">Lote</SelectItem>
            <SelectItem value="Incorporacao">Incorporação</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ) },
  ];
  return (
    <div className="space-y-4">
      {pendentes > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{pendentes} empreendimento(s) sem categoria</AlertTitle>
          <AlertDescription>Defina a categoria abaixo para liberar a operação.</AlertDescription>
        </Alert>
      )}
      <DataTable data={empreendimentosMock} columns={colunas} />
    </div>
  );
}
