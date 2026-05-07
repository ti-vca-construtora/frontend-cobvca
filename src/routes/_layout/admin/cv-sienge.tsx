import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { mapeamentoMock, empresasMock } from "@/features/mocks/data";
import type { MapeamentoCVSienge } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/admin/cv-sienge")({ component: CvSiengePage });

function CvSiengePage() {
  return (
    <ProtectedRoute perfis={["admin", "supervisor"]}>
      <PageHeader titulo="CV x Sienge" descricao="De/Para de billId e reservas"
        acoes={<Button size="sm" onClick={() => toast.success("Mapeamento criado (mock)")}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />
      <Conteudo />
    </ProtectedRoute>
  );
}

function Conteudo() {
  const [busca, setBusca] = useState("");
  const dados = mapeamentoMock.filter((m) =>
    `${m.billId} ${m.reservaId} ${m.afiliado}`.toLowerCase().includes(busca.toLowerCase())
  );
  const colunas: Column<MapeamentoCVSienge>[] = [
    { key: "billId", header: "Bill ID", sortable: true, accessor: (r) => r.billId },
    { key: "reservaId", header: "Reserva", sortable: true, accessor: (r) => r.reservaId },
    { key: "afiliado", header: "Afiliado" },
    { key: "empresa", header: "Empresa", render: (r) => empresasMock.find((e) => e.id === r.empresaId)?.nome },
    { key: "acoes", header: "Ações", render: () => (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => toast.info("Editar (mock)")}>Editar</Button>
        <Button size="sm" variant="ghost" onClick={() => toast.info("Excluir (mock)")}>Excluir</Button>
      </div>
    ) },
  ];
  return (
    <div className="space-y-4">
      <Input placeholder="Buscar bill, reserva ou afiliado" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
      <DataTable data={dados} columns={colunas} />
    </div>
  );
}
