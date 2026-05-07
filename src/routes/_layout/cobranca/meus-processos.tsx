import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/AuthContext";
import { processosMock, clientesMock, empresasMock, historicoMock } from "@/features/mocks/data";
import type { Processo } from "@/types";

export const Route = createFileRoute("/_layout/cobranca/meus-processos")({ component: MeusProcessosPage });

function MeusProcessosPage() {
  return (
    <ProtectedRoute perfis={["admin", "supervisor", "cobrador"]}>
      <PageHeader titulo="Meus Processos" descricao="Processos atribuídos a você" />
      <Lista />
    </ProtectedRoute>
  );
}

function Lista() {
  const { usuario } = useAuth();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Processo | null>(null);

  const meus = processosMock.filter((p) => {
    if (usuario.perfil === "cobrador" && p.responsavelId !== usuario.id) return false;
    if (busca) {
      const c = clientesMock.find((x) => x.id === p.clienteId);
      const e = empresasMock.find((x) => x.id === p.empresaId);
      const t = `${c?.nome} ${c?.documento} ${e?.nome}`.toLowerCase();
      if (!t.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  const colunas: Column<Processo>[] = [
    { key: "cliente", header: "Cliente", render: (r) => clientesMock.find((c) => c.id === r.clienteId)?.nome },
    { key: "empresa", header: "Empresa", render: (r) => empresasMock.find((e) => e.id === r.empresaId)?.nome },
    { key: "prioridade", header: "Prioridade", render: (r) => <Badge variant={r.prioridade === "alta" ? "destructive" : "secondary"}>{r.prioridade}</Badge> },
    { key: "status", header: "Status", render: (r) => <Badge>{r.status}</Badge> },
    { key: "dias", header: "Dias", accessor: (r) => r.diasVencidos, sortable: true, render: (r) => `${r.diasVencidos}d` },
  ];

  return (
    <>
      <div className="mb-4 max-w-sm">
        <Input placeholder="Buscar pessoa, documento ou empresa" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <DataTable data={meus} columns={colunas} onRowClick={setAberto} />

      <Sheet open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          <SheetHeader><SheetTitle>Processo {aberto?.id}</SheetTitle></SheetHeader>
          {aberto && (
            <Tabs defaultValue="dados" className="mt-6">
              <TabsList>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="obs">Observações</TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="space-y-2 mt-4 text-sm">
                <p><b>Cliente:</b> {clientesMock.find((c) => c.id === aberto.clienteId)?.nome}</p>
                <p><b>Empresa:</b> {empresasMock.find((e) => e.id === aberto.empresaId)?.nome}</p>
                <p><b>Vencimento:</b> {aberto.vencimento}</p>
                <p><b>Valor:</b> {aberto.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </TabsContent>
              <TabsContent value="historico" className="mt-4">
                <ol className="relative border-l ml-3 space-y-4">
                  {historicoMock.filter((h) => h.processoId === aberto.id).map((h) => (
                    <li key={h.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                      <div className="text-xs text-muted-foreground">{h.data}</div>
                      <div className="text-sm">{h.descricao}</div>
                    </li>
                  ))}
                </ol>
              </TabsContent>
              <TabsContent value="obs" className="mt-4 text-sm text-muted-foreground">
                {aberto.observacoes ?? "Sem observações."}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
