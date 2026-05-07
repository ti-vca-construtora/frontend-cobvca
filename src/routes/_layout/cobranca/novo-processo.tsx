import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { processosMock, clientesMock, empresasMock, usuariosMock } from "@/features/mocks/data";
import type { Processo } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/cobranca/novo-processo")({ component: NovoProcessoPage });

function NovoProcessoPage() {
  return (
    <ProtectedRoute perfis={["admin", "supervisor"]}>
      <PageHeader titulo="Novo Processo" descricao="Distribuição e criação de processos de cobrança" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1"><Formulario /></div>
        <div className="lg:col-span-2"><TodosProcessos /></div>
      </div>
    </ProtectedRoute>
  );
}

function Formulario() {
  const [responsavel, setResponsavel] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Processo criado (mock)");
  };
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-semibold mb-4">Criar processo</h2>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Cliente</Label>
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{clientesMock.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Empresa</Label>
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{empresasMock.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Origem</Label>
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sienge">Sienge</SelectItem>
                <SelectItem value="CV">CV</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label>Prioridade</Label>
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label>Responsável (cobrador)</Label>
            <Select value={responsavel} onValueChange={setResponsavel}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{usuariosMock.filter((u) => u.perfil === "cobrador").map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Vencimento</Label><Input type="date" /></div>
          <div><Label>Observações</Label><Textarea rows={3} /></div>
          <Button type="submit" className="w-full">Criar processo</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TodosProcessos() {
  const colunas: Column<Processo>[] = [
    { key: "cliente", header: "Cliente", render: (r) => clientesMock.find((c) => c.id === r.clienteId)?.nome },
    { key: "responsavel", header: "Responsável", render: (r) => usuariosMock.find((u) => u.id === r.responsavelId)?.nome ?? "—" },
    { key: "status", header: "Status", render: (r) => <Badge>{r.status}</Badge> },
    { key: "valor", header: "Valor", accessor: (r) => r.valor, sortable: true, render: (r) => r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
  ];
  return (
    <div>
      <h2 className="font-semibold mb-4">Todos os processos</h2>
      <DataTable data={processosMock} columns={colunas} />
    </div>
  );
}
