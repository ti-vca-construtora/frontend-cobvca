import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/cobranca/novo-processo")({ component: NovoProcessoPage });

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChargeBatch {
  id: string;
  batch_code: string;
  status: string;
  source_view: string;
  filters_applied: Record<string, unknown>;
  created_at: string;
}

interface ChargeItem {
  id: string;
  batch_id: string;
  bill_id: string;
  document: string | null;
  client_name: string | null;
  enterprise_name: string | null;
  due_date: string | null;
  amount: number | null;
  days_overdue: number | null;
  status: string;
  assigned_to_user_id: string | null;
  internal_handling_flag: boolean;
  legal_process_flag: boolean;
}

interface AppUser {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function NovoProcessoPage() {
  return (
    <ProtectedRoute perfis={["administrador", "supervisor"]}>
      <PageHeader titulo="Novo Processo" descricao="Criação e distribuição de processos de cobrança" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1"><CriarBatchForm /></div>
        <div className="lg:col-span-2"><ListaBatches /></div>
      </div>
    </ProtectedRoute>
  );
}

// ─── Formulário de criação de batch ─────────────────────────────────────────

function CriarBatchForm() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState("contas-receber");
  const [option, setOption] = useState("charge");
  const [client, setClient] = useState("");
  const [enterprise, setEnterprise] = useState("");
  const [limit, setLimit] = useState("200");
  const [aplicarS1, setAplicarS1] = useState(false);
  const [aplicarCronograma, setAplicarCronograma] = useState(false);
  const [avulsaOpen, setAvulsaOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/charges", {
        source,
        option,
        ...(client.trim() ? { client: client.trim() } : {}),
        ...(enterprise.trim() ? { enterprise: enterprise.trim() } : {}),
        limit: Number(limit),
        ...(aplicarS1 ? { aplicar_filtro_s1: true } : {}),
        ...(aplicarCronograma ? { aplicar_cronograma: true } : {}),
      }),
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      const res = data as { batch: { batch_code: string }; insertedItems: number };
      toast.success(`Processo ${res.batch.batch_code} criado — ${res.insertedItems} itens`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar processo.");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Criar processo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Fonte</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contas-receber">Contas a Receber</SelectItem>
              <SelectItem value="contas-recebidas">Contas Recebidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={option} onValueChange={setOption}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="charge">Cobrança</SelectItem>
              <SelectItem value="negativation">Negativação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Filtro — Cliente (opcional)</Label>
          <Input placeholder="Ex: João Silva" value={client} onChange={(e) => setClient(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Filtro — Empreendimento (opcional)</Label>
          <Input placeholder="Ex: Residencial Primavera" value={enterprise} onChange={(e) => setEnterprise(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Limite de itens</Label>
          <Input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="s1-charge"
            checked={aplicarS1}
            onCheckedChange={(v) => setAplicarS1(!!v)}
          />
          <Label htmlFor="s1-charge" className="cursor-pointer">Aplicar filtro S1</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="cronograma-charge"
            checked={aplicarCronograma}
            onCheckedChange={(v) => setAplicarCronograma(!!v)}
          />
          <Label htmlFor="cronograma-charge" className="cursor-pointer">Aplicar cronograma</Label>
        </div>
        <Button
          className="w-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Processando…" : "Criar processo"}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setAvulsaOpen(true)}
        >
          Cobrança Avulsa
        </Button>
        <CobrancaAvulsaDialog open={avulsaOpen} onClose={() => setAvulsaOpen(false)} />
      </CardContent>
    </Card>
  );
}

// ─── Lista de batches ─────────────────────────────────────────────────────────

const STATUS_BATCH_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function ListaBatches() {
  const [selectedBatch, setSelectedBatch] = useState<ChargeBatch | null>(null);

  const { data: batches, isLoading } = useQuery<ChargeBatch[]>({
    queryKey: ["charge-batches"],
    queryFn: () => api.get<ChargeBatch[]>("/charges"),
  });

  const colunas: Column<ChargeBatch>[] = [
    { key: "code", header: "Código", accessor: (r) => r.batch_code },
    {
      key: "status", header: "Status",
      render: (r) => <Badge variant={r.status === "concluido" ? "default" : "secondary"}>{STATUS_BATCH_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      key: "date", header: "Criado em",
      accessor: (r) => r.created_at,
      render: (r) => new Date(r.created_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "ver", header: "",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setSelectedBatch(r)}>
          Ver itens
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <>
      <div>
        <h2 className="font-semibold mb-4">Processos criados</h2>
        <DataTable data={batches ?? []} columns={colunas} />
      </div>
      {selectedBatch && (
        <BatchItemsSheet batch={selectedBatch} onClose={() => setSelectedBatch(null)} />
      )}
    </>
  );
}

// ─── Sheet de itens + atribuição ─────────────────────────────────────────────

function BatchItemsSheet({ batch, onClose }: { batch: ChargeBatch; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cobradorId, setCobradorId] = useState("");

  const { data: items, isLoading: loadingItems } = useQuery<ChargeItem[]>({
    queryKey: ["charge-items", batch.id],
    queryFn: () => api.get<ChargeItem[]>(`/charges/items?batchId=${batch.id}`),
  });

  const { data: users } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
  });

  const cobradores = (users ?? []).filter((u) => u.role === "cobrador" || u.role === "supervisor" || u.role === "administrador");

  const assignMutation = useMutation({
    mutationFn: () =>
      api.patch("/charges/items/assign", {
        assignedToUserId: cobradores.find((u) => u.id === cobradorId)?.userId ?? cobradorId,
        itemIds: selectedIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-items", batch.id] });
      setSelectedIds([]);
      toast.success("Itens atribuídos com sucesso!");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atribuir.");
    },
  });

  const toggleItem = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const columns: Column<ChargeItem>[] = [
    {
      key: "sel", header: "",
      render: (r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onCheckedChange={() => toggleItem(r.id)}
        />
      ),
    },
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
    {
      key: "amount", header: "Valor",
      render: (r) => r.amount != null ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
    },
    { key: "days", header: "Dias", accessor: (r) => r.days_overdue ?? 0 },
    {
      key: "flags", header: "Flags",
      render: (r) => (
        <div className="flex gap-1">
          {r.internal_handling_flag && <Badge variant="destructive" className="text-xs">TI</Badge>}
          {r.legal_process_flag && <Badge variant="outline" className="text-xs">JUR</Badge>}
        </div>
      ),
    },
    {
      key: "status", header: "Status",
      render: (r) => <Badge variant="secondary">{r.status}</Badge>,
    },
  ];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[90vw] sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Itens — {batch.batch_code}</SheetTitle>
        </SheetHeader>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 mt-4 p-3 border rounded-md bg-muted">
            <span className="text-sm font-medium">{selectedIds.length} item(s) selecionado(s)</span>
            <Select value={cobradorId} onValueChange={setCobradorId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Cobrador…" /></SelectTrigger>
              <SelectContent>
                {cobradores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!cobradorId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? "Atribuindo…" : "Atribuir"}
            </Button>
          </div>
        )}

        <div className="mt-4">
          {loadingItems ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable data={items ?? []} columns={columns} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Cobrança Avulsa Dialog ───────────────────────────────────────────────────

interface AvulsaItem {
  client_name: string;
  document: string;
  enterprise_name: string;
  bill_id: string;
  due_date: string;
  amount: string;
  days_overdue: string;
}

const emptyItem = (): AvulsaItem => ({
  client_name: "",
  document: "",
  enterprise_name: "",
  bill_id: "",
  due_date: "",
  amount: "",
  days_overdue: "",
});

function CobrancaAvulsaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<AvulsaItem[]>([emptyItem()]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/charges/avulsa", {
        items: rows
          .filter((r) => r.client_name.trim())
          .map((r) => ({
            client_name: r.client_name.trim(),
            ...(r.document.trim() ? { document: r.document.trim() } : {}),
            ...(r.enterprise_name.trim() ? { enterprise_name: r.enterprise_name.trim() } : {}),
            ...(r.bill_id.trim() ? { bill_id: r.bill_id.trim() } : {}),
            ...(r.due_date ? { due_date: r.due_date } : {}),
            ...(r.amount ? { amount: Number(r.amount) } : {}),
            ...(r.days_overdue ? { days_overdue: Number(r.days_overdue) } : {}),
          })),
      }),
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      const res = data as { batch: { batch_code: string }; insertedItems: number };
      toast.success(`Lote avulso ${res.batch.batch_code} criado — ${res.insertedItems} item(s)`);
      setRows([emptyItem()]);
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar lote avulso.");
    },
  });

  const updateRow = (index: number, field: keyof AvulsaItem, value: string) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyItem()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cobrança Avulsa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-7 gap-2 items-end border rounded-md p-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <Input placeholder="Nome do cliente" value={row.client_name} onChange={(e) => updateRow(i, "client_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Documento</Label>
                <Input placeholder="CPF/CNPJ" value={row.document} onChange={(e) => updateRow(i, "document", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Empreendimento</Label>
                <Input placeholder="Nome" value={row.enterprise_name} onChange={(e) => updateRow(i, "enterprise_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" min={0} step="0.01" placeholder="0,00" value={row.amount} onChange={(e) => updateRow(i, "amount", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dias vencidos</Label>
                <Input type="number" min={0} placeholder="0" value={row.days_overdue} onChange={(e) => updateRow(i, "days_overdue", e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                  ✕
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow} className="w-full">
            + Adicionar item
          </Button>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={mutation.isPending || rows.every((r) => !r.client_name.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Enviando…" : "Criar lote avulso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
