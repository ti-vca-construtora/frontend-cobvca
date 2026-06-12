import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  datacharge_items?: ChargeInstallment[];
}

interface ChargeBatch {
  id: string;
  batch_code: string;
  status: string;
  created_at: string;
}

interface ChargeInstallment {
  id?: string;
  valor: number | null;
  tipo_parcela: string | null;
  dias_vencidos: number | null;
  data_vencimento: string | null;
}

interface GroupedChargeItem {
  id: string;
  bill_id: string;
  client_name: string | null;
  document: string | null;
  enterprise_name: string | null;
  due_date: string | null;
  amount: number | null;
  status: ChargeStatus | "misto";
  feedback_notes: string | null;
  items: AssignedChargeItem[];
  installments: ChargeInstallment[];
}

const STATUS_LABEL: Record<ChargeStatus, string> = {
  pendente: "Pendente",
  sem_retorno: "Sem retorno",
  em_atendimento: "Em atendimento",
  ciente_sem_retorno: "Ciente s/ retorno",
  em_negociacao: "Em negociação",
  acordo: "Acordo",
  pago: "Pago",
  cancelado: "Cancelado",
};

function MinhasDistribuicoesPage() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarSomenteMinhas, setMostrarSomenteMinhas] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<ChargeStatus | "todos">("todos");
  const [processoFiltro, setProcessoFiltro] = useState("todos");
  const [itemEmEdicao, setItemEmEdicao] = useState<AssignedChargeItem | null>(null);
  const [grupoParcelas, setGrupoParcelas] = useState<GroupedChargeItem | null>(null);

  const { data: processos = [] } = useQuery<ChargeBatch[]>({
    queryKey: ["charge-batches"],
    queryFn: () => api.get<ChargeBatch[]>("/charges"),
    staleTime: 1000 * 60,
  });

  const { data: items = [], isLoading } = useQuery<AssignedChargeItem[]>({
    queryKey: ["minhas-distribuicoes", usuario?.userId, mostrarSomenteMinhas, statusFiltro, processoFiltro],
    queryFn: () => api.get<AssignedChargeItem[]>("/charges/items", {
      assignedToUserId: mostrarSomenteMinhas ? usuario?.userId : undefined,
      status: statusFiltro === "todos" ? undefined : statusFiltro,
      batchId: processoFiltro === "todos" ? undefined : processoFiltro,
    }),
    enabled: !!usuario?.userId,
  });

  const agrupados = useMemo(() => groupAssignedItems(items), [items]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return agrupados;
    return agrupados.filter((item) =>
      (item.client_name ?? "").toLowerCase().includes(termo) ||
      (item.document ?? "").toLowerCase().includes(termo) ||
      (item.enterprise_name ?? "").toLowerCase().includes(termo) ||
      (item.bill_id ?? "").toLowerCase().includes(termo),
    );
  }, [agrupados, busca]);

  const columns: Column<GroupedChargeItem>[] = [
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
    { key: "titulo", header: "Título", accessor: (r) => r.bill_id ?? "-" },
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
      key: "parcelas",
      header: "Parcelas",
      render: (r) => <Badge variant="outline">{r.installments.length}</Badge>,
    },
    {
      key: "vencimento",
      header: "Vencimento",
      render: (r) => (r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "-"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.status === "cancelado" ? "destructive" : "secondary"}>
          {r.status === "misto" ? "Misto" : STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      key: "acao",
      header: "Ação",
      render: (r) => {
        const meuItem = r.items.find((item) => item.assigned_to_user_id === usuario?.userId);

        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setGrupoParcelas(r);
              }}
            >
              Ver parcelas
            </Button>
            {meuItem && (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemEmEdicao(meuItem);
                }}
              >
                Atualizar
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <ProtectedRoute perfis={["administrador", "supervisor", "cobrador"]}>
      <PageHeader
        titulo="Minhas Distribuições"
        descricao="Clientes e títulos distribuídos para você"
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_240px_auto] lg:items-end">
        <div className="max-w-sm flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">Busca</Label>
          <Input
            placeholder="Buscar por cliente, documento, título..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFiltro} onValueChange={(value) => setStatusFiltro(value as ChargeStatus | "todos")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Processo</Label>
          <Select value={processoFiltro} onValueChange={setProcessoFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os processos</SelectItem>
              {processos.map((processo) => (
                <SelectItem key={processo.id} value={processo.id}>
                  {processo.batch_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Label className="flex cursor-pointer items-center gap-2 pb-2 text-sm font-normal">
          <Checkbox
            checked={mostrarSomenteMinhas}
            onCheckedChange={(checked) => setMostrarSomenteMinhas(checked === true)}
          />
          Minhas distribuições
        </Label>
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
      {grupoParcelas && (
        <ParcelasDialog grupo={grupoParcelas} onClose={() => setGrupoParcelas(null)} />
      )}
    </ProtectedRoute>
  );
}

function baseBillId(billId: string | null | undefined) {
  return (billId ?? "-").replace(/#\d+$/, "");
}

function getInstallments(item: AssignedChargeItem): ChargeInstallment[] {
  if (Array.isArray(item.datacharge_items) && item.datacharge_items.length > 0) {
    return item.datacharge_items;
  }

  return [{
    valor: item.amount,
    tipo_parcela: null,
    dias_vencidos: null,
    data_vencimento: item.due_date,
  }];
}

function groupAssignedItems(items: AssignedChargeItem[]): GroupedChargeItem[] {
  const groups = new Map<string, GroupedChargeItem>();

  for (const item of items) {
    const billId = baseBillId(item.bill_id);
    const key = `${item.client_name ?? ""}|${item.document ?? ""}|${billId}`;
    const installments = getInstallments(item);
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        id: key,
        bill_id: billId,
        client_name: item.client_name,
        document: item.document,
        enterprise_name: item.enterprise_name,
        due_date: item.due_date,
        amount: item.amount ?? 0,
        status: item.status,
        feedback_notes: item.feedback_notes,
        items: [item],
        installments: [...installments],
      });
      continue;
    }

    current.items.push(item);
    current.installments.push(...installments);
    current.amount = (current.amount ?? 0) + (item.amount ?? 0);
    current.due_date = current.due_date ?? item.due_date;
    current.status = current.status === item.status ? current.status : "misto";
  }

  return Array.from(groups.values());
}

function ParcelasDialog({ grupo, onClose }: { grupo: GroupedChargeItem; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parcelas do título {grupo.bill_id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3">
            <p className="font-medium">{grupo.client_name ?? "-"}</p>
            <p className="text-xs text-muted-foreground">{grupo.document ?? "sem documento"}</p>
            <p className="text-xs text-muted-foreground">{grupo.enterprise_name ?? "-"}</p>
          </div>

          <DataTable
            data={grupo.installments.map((installment, index) => ({
              id: installment.id ?? `${grupo.id}-${index}`,
              numero: index + 1,
              ...installment,
            }))}
            pageSize={10}
            columns={[
              {
                key: "numero",
                header: "Parcela",
                accessor: (row) => row.numero,
              },
              {
                key: "tipo",
                header: "Tipo",
                accessor: (row) => row.tipo_parcela ?? "-",
              },
              {
                key: "vencimento",
                header: "Vencimento",
                render: (row) => (row.data_vencimento ? new Date(row.data_vencimento).toLocaleDateString("pt-BR") : "-"),
              },
              {
                key: "dias",
                header: "Dias",
                accessor: (row) => row.dias_vencidos ?? 0,
              },
              {
                key: "valor",
                header: "Valor",
                render: (row) =>
                  row.valor != null
                    ? row.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "-",
              },
            ]}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      await api.patch(`/charges/items/${item.id}/status`, {
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
            <p className="text-muted-foreground text-xs">Título: {item.bill_id}</p>
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
                <SelectItem value="em_negociacao">Em negociação</SelectItem>
                <SelectItem value="acordo">Acordo</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{status === "cancelado" ? "Motivo do cancelamento" : "Observações"}</Label>
            <Textarea
              rows={4}
              placeholder={status === "cancelado" ? "Informe o motivo do cancelamento..." : "Observações da tratativa..."}
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
