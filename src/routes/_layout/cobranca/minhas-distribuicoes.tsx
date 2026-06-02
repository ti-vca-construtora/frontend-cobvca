import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/cobranca/minhas-distribuicoes")({ component: MinhasDistribuicoesPage });

type ChargeStatus =
  | "pendente"
  | "sem_retorno"
  | "em_atendimento"
  | "ciente_sem_retorno"
  | "em_negociacao"
  | "acordo"
  | "pago"
  | "cancelado";

interface AssignedChargeItem {
  id: string;
  bill_id: string;
  client_name: string | null;
  document: string | null;
  enterprise_name: string | null;
  due_date: string | null;
  amount: number | null;
  status: ChargeStatus;
  feedback_notes: string | null;
  assigned_to_user_id: string | null;
  assigned_at: string | null;
}

const STATUS_LABEL: Record<ChargeStatus, string> = {
  pendente: "Pendente",
  sem_retorno: "Sem retorno",
  em_atendimento: "Em atendimento",
  ciente_sem_retorno: "Ciente s/ retorno",
  em_negociacao: "Em negociacao",
  acordo: "Acordo",
  pago: "Pago",
  cancelado: "Cancelado",
};

function MinhasDistribuicoesPage() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [itemEmEdicao, setItemEmEdicao] = useState<AssignedChargeItem | null>(null);

  const { data: items = [], isLoading } = useQuery<AssignedChargeItem[]>({
    queryKey: ["minhas-distribuicoes", usuario?.userId],
    queryFn: () => api.get<AssignedChargeItem[]>("/charges/items", { assignedToUserId: usuario?.userId }),
    enabled: !!usuario?.userId,
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return items;
    return items.filter((item) =>
      (item.client_name ?? "").toLowerCase().includes(termo) ||
      (item.document ?? "").toLowerCase().includes(termo) ||
      (item.enterprise_name ?? "").toLowerCase().includes(termo) ||
      (item.bill_id ?? "").toLowerCase().includes(termo),
    );
  }, [items, busca]);

  const columns: Column<AssignedChargeItem>[] = [
    {
      key: "cliente",
      header: "Cliente",
      render: (r) => (
        <div>
          <div className="font-medium">{r.client_name ?? "-"}</div>
          <div className="text-xs text-muted-foreground">{r.document ?? "sem documento"}</div>
        </div>
      ),
    },
    { key: "titulo", header: "Titulo", accessor: (r) => r.bill_id ?? "-" },
    { key: "empreendimento", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "-" },
    {
      key: "valor",
      header: "Valor",
      render: (r) =>
        r.amount != null
          ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "-",
    },
    {
      key: "vencimento",
      header: "Vencimento",
      render: (r) => (r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "-"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge variant={r.status === "cancelado" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: "acao",
      header: "Acao",
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            setItemEmEdicao(r);
          }}
        >
          Atualizar
        </Button>
      ),
    },
  ];

  return (
    <ProtectedRoute perfis={["administrador", "supervisor", "cobrador"]}>
      <PageHeader
        titulo="Minhas Distribuicoes"
        descricao="Clientes e titulos distribuidos para voce"
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por cliente, documento, titulo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable data={filtrados} columns={columns} />
      )}

      {itemEmEdicao && (
        <AtualizarStatusDialog
          item={itemEmEdicao}
          onClose={() => setItemEmEdicao(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["minhas-distribuicoes", usuario?.userId] });
          }}
        />
      )}
    </ProtectedRoute>
  );
}

function AtualizarStatusDialog({
  item,
  onClose,
  onSaved,
}: {
  item: AssignedChargeItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<ChargeStatus>(item.status);
  const [motivo, setMotivo] = useState(item.feedback_notes ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      if (status === "cancelado" && !motivo.trim()) {
        throw new Error("Informe o motivo do cancelamento.");
      }
      await api.patch(`/charges/items/${item.id}/feedback`, {
        status,
        feedbackNotes: motivo.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Status atualizado com sucesso.");
      onSaved();
      onClose();
    },
    onError: (err) => {
      const msg = err instanceof ApiError || err instanceof Error ? err.message : "Erro ao atualizar status.";
      toast.error(msg);
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar status</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3">
            <p className="font-medium">{item.client_name ?? "-"}</p>
            <p className="text-muted-foreground text-xs">{item.document ?? "sem documento"}</p>
            <p className="text-muted-foreground text-xs">Titulo: {item.bill_id}</p>
          </div>

          <div className="space-y-1">
            <Label>Novo status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ChargeStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="sem_retorno">Sem retorno</SelectItem>
                <SelectItem value="em_atendimento">Em atendimento</SelectItem>
                <SelectItem value="ciente_sem_retorno">Ciente s/ retorno</SelectItem>
                <SelectItem value="em_negociacao">Em negociacao</SelectItem>
                <SelectItem value="acordo">Acordo</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{status === "cancelado" ? "Motivo do cancelamento" : "Observacoes"}</Label>
            <Textarea
              rows={4}
              placeholder={status === "cancelado" ? "Informe o motivo do cancelamento..." : "Observacoes da tratativa..."}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
