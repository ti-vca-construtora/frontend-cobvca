import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { FilterBar } from "@/components/app/FilterBar";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { processosMock, clientesMock, empresasMock } from "@/features/mocks/data";
import type { Processo } from "@/types";

export const Route = createFileRoute("/_layout/consultas")({ component: ConsultasPage });

function ConsultasPage() {
  const [empresa, setEmpresa] = useState("todas");
  const [origem, setOrigem] = useState("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Processo | null>(null);

  const dados = useMemo(() => {
    return processosMock.filter((p) => {
      if (empresa !== "todas" && p.empresaId !== empresa) return false;
      if (origem !== "todas" && p.origem !== origem) return false;
      if (busca) {
        const cli = clientesMock.find((c) => c.id === p.clienteId);
        const txt = `${cli?.nome} ${cli?.documento}`.toLowerCase();
        if (!txt.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [empresa, origem, busca]);

  const colunas: Column<Processo>[] = [
    { key: "cliente", header: "Cliente", accessor: (r) => clientesMock.find((c) => c.id === r.clienteId)?.nome ?? "", sortable: true,
      render: (r) => {
        const c = clientesMock.find((x) => x.id === r.clienteId);
        return <div><div className="font-medium">{c?.nome}</div><div className="text-xs text-muted-foreground">{c?.documento}</div></div>;
      } },
    { key: "empresa", header: "Empresa", render: (r) => empresasMock.find((e) => e.id === r.empresaId)?.nome },
    { key: "origem", header: "Origem", render: (r) => <Badge variant="outline">{r.origem}</Badge> },
    { key: "diasVencidos", header: "Dias vencidos", sortable: true, accessor: (r) => r.diasVencidos, render: (r) => `${r.diasVencidos}d` },
    { key: "valor", header: "Valor", sortable: true, accessor: (r) => r.valor, render: (r) => r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
    { key: "status", header: "Status", render: (r) => <Badge>{r.status.replace("_", " ")}</Badge> },
  ];

  return (
    <>
      <PageHeader titulo="Consultas" descricao="Consulta geral de registros (BQ / Sienge / CV)"
        acoes={<Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button>}
      />
      <div className="space-y-4">
        <FilterBar>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Cliente / Documento</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." />
          </div>
          <div className="w-[200px]">
            <Label className="text-xs">Empresa</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {empresasMock.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Label className="text-xs">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="Sienge">Sienge</SelectItem>
                <SelectItem value="CV">CV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <DataTable data={dados} columns={colunas} onRowClick={setAberto} />
      </div>

      <Sheet open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          <SheetHeader><SheetTitle>Detalhes do processo</SheetTitle></SheetHeader>
          {aberto && (
            <div className="mt-6 space-y-3 text-sm">
              <Linha k="ID" v={aberto.id} />
              <Linha k="Cliente" v={clientesMock.find((c) => c.id === aberto.clienteId)?.nome ?? ""} />
              <Linha k="Empresa" v={empresasMock.find((e) => e.id === aberto.empresaId)?.nome ?? ""} />
              <Linha k="Origem" v={aberto.origem} />
              <Linha k="Status" v={aberto.status} />
              <Linha k="Vencimento" v={aberto.vencimento} />
              <Linha k="Dias vencidos" v={String(aberto.diasVencidos)} />
              <Linha k="Valor" v={aberto.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              {aberto.observacoes && <Linha k="Observações" v={aberto.observacoes} />}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
