import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { tratativasMock, usuariosMock } from "@/features/mocks/data";
import type { Tratativa } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/admin/tratativa-interna")({ component: TratativaPage });

function TratativaPage() {
  const { temPerfil } = useAuth();
  const podeEditar = temPerfil(["admin", "supervisor"]);
  const [aberto, setAberto] = useState(false);

  const colunas: Column<Tratativa>[] = [
    { key: "titulo", header: "Título", sortable: true, accessor: (r) => r.titulo },
    { key: "descricao", header: "Descrição" },
    { key: "criadoPor", header: "Criado por", render: (r) => usuariosMock.find((u) => u.id === r.criadoPor)?.nome },
    { key: "atualizadoEm", header: "Atualizado em", accessor: (r) => r.atualizadoEm },
    ...(podeEditar ? [{ key: "acoes", header: "Ações", render: () => (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
    ) } as Column<Tratativa>] : []),
  ];

  return (
    <>
      <PageHeader titulo="Tratativa Interna"
        descricao={podeEditar ? "Crie e edite tratativas internas" : "Visualização de tratativas (somente leitura)"}
        acoes={podeEditar && (
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova tratativa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova tratativa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input /></div>
                <div><Label>Descrição</Label><Textarea rows={4} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                <Button onClick={() => { setAberto(false); toast.success("Tratativa salva (mock)"); }}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <DataTable data={tratativasMock} columns={colunas} />
    </>
  );
}
