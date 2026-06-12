import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/admin/tratativa-interna")({ component: TratativaPage });

interface Tratativa {
  id: string;
  document: string;
  client_name: string;
  enterprise_id: string;
  reason: string;
  owner_user_id: string;
  status: "ativo" | "inativo";
  created_at: string;
}

interface Enterprise {
  id: string;
  cost_center_source?: string;
  cost_center_id?: string;
  cost_center_name?: string;
}

interface BulkCreateResult {
  processed: number;
  created: number;
  skippedDuplicates?: number;
  failed?: number;
  errors?: Array<{ line: number; message: string }>;
}

function TratativaPage() {
  const { temPerfil } = useAuth();
  const podeEditar = temPerfil(["administrador", "supervisor"]);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Tratativa | null>(null);

  const { data: tratativas, isLoading } = useQuery<Tratativa[]>({
    queryKey: ["internal-handling"],
    queryFn: () => api.get<Tratativa[]>("/internal-handling"),
  });

  const { data: enterprises } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/internal-handling/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-handling"] });
      toast.success("Tratativa removida.");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover.");
    },
  });

  const enterpriseLabel = (id: string) => {
    const enterprise = enterprises?.find((item) => item.id === id);
    if (!enterprise) return id;
    if (enterprise.cost_center_name) return enterprise.cost_center_name;
    if (enterprise.cost_center_source || enterprise.cost_center_id) {
      return `${enterprise.cost_center_source ?? ""}${enterprise.cost_center_source && enterprise.cost_center_id ? " - " : ""}${enterprise.cost_center_id ?? ""}`;
    }
    return id;
  };

  const colunas: Column<Tratativa>[] = [
    { key: "document", header: "Documento", accessor: (row) => row.document },
    { key: "client_name", header: "Cliente", accessor: (row) => row.client_name },
    { key: "enterprise", header: "Empreendimento", render: (row) => enterpriseLabel(row.enterprise_id) },
    {
      key: "reason",
      header: "Motivo",
      render: (row) => <span className="line-clamp-2 max-w-xs text-sm">{row.reason}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={row.status === "ativo" ? "default" : "secondary"}>{row.status}</Badge>,
    },
    ...(podeEditar
      ? [
          {
            key: "acoes",
            header: "",
            render: (row: Tratativa) => (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditItem(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          } as Column<Tratativa>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        titulo="Tratativa Interna"
        descricao={podeEditar ? "Crie e edite tratativas internas" : "Visualização de tratativas (somente leitura)"}
        acoes={
          podeEditar && (
            <div className="flex gap-2">
              <BulkUploadButton />
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Nova tratativa
              </Button>
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable data={tratativas ?? []} columns={colunas} />
      )}

      {createOpen && <TratativaDialog enterprises={enterprises ?? []} onClose={() => setCreateOpen(false)} />}
      {editItem && (
        <TratativaDialog tratativa={editItem} enterprises={enterprises ?? []} onClose={() => setEditItem(null)} />
      )}
    </>
  );
}

function BulkUploadButton() {
  const queryClient = useQueryClient();

  const bulkMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.postForm<BulkCreateResult>("/internal-handling/bulk", fd);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["internal-handling"] });
      if ((res.errors?.length ?? 0) > 0) {
        const preview = (res.errors ?? [])
          .slice(0, 3)
          .map((error) => `linha ${error.line}: ${error.message}`)
          .join(" | ");
        toast.warning(
          `Importação parcial: ${res.created} criadas, ${res.skippedDuplicates ?? 0} já existentes, ${res.failed ?? res.errors?.length ?? 0} com erro. ${preview}`,
        );
        return;
      }
      if ((res.skippedDuplicates ?? 0) > 0) {
        toast.success(
          `Importação concluída: ${res.created} criadas e ${res.skippedDuplicates} já existentes.`,
        );
        return;
      }
      toast.success(`Importação concluída: ${res.created}/${res.processed} criada(s).`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro na importação.");
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={bulkMutation.isPending}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept =
          ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) bulkMutation.mutate(file);
        };
        input.click();
      }}
    >
      <Upload className="mr-1 h-4 w-4" />
      {bulkMutation.isPending ? "Importando..." : "Importar planilha"}
    </Button>
  );
}

function TratativaDialog({
  tratativa,
  enterprises,
  onClose,
}: {
  tratativa?: Tratativa;
  enterprises: Enterprise[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!tratativa;

  const [document, setDocument] = useState(tratativa?.document ?? "");
  const [clientName, setClientName] = useState(tratativa?.client_name ?? "");
  const [enterpriseId, setEnterpriseId] = useState(tratativa?.enterprise_id ?? "");
  const [reason, setReason] = useState(tratativa?.reason ?? "");
  const [status, setStatus] = useState<string>(tratativa?.status ?? "ativo");

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.patch(`/internal-handling/${tratativa!.id}`, { clientName, enterpriseId, reason, status })
        : api.post("/internal-handling", {
            document: document.replace(/\D/g, ""),
            clientName,
            enterpriseId,
            reason,
            status,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-handling"] });
      toast.success(isEdit ? "Tratativa atualizada!" : "Tratativa criada!");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    },
  });

  const canSave = clientName.trim() && enterpriseId && (isEdit || document.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tratativa" : "Nova tratativa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && (
            <div className="space-y-1">
              <Label>Documento (CPF/CNPJ)</Label>
              <Input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          )}
          <div className="space-y-1">
            <Label>Nome do cliente</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Empreendimento</Label>
            <Select value={enterpriseId} onValueChange={setEnterpriseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {enterprises.map((enterprise) => (
                  <SelectItem key={enterprise.id} value={enterprise.id}>
                    {enterprise.cost_center_name ??
                      `${enterprise.cost_center_source ?? ""}${enterprise.cost_center_source && enterprise.cost_center_id ? " - " : ""}${enterprise.cost_center_id ?? ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Motivo (opcional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
