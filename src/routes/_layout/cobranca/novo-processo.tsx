import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_layout/cobranca/novo-processo")({ component: NovoProcessoPage });

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface Enterprise {
  id: string;
  cost_center_name: string;
  status: string;
}

interface BqRow {
  empresa?: string;
  cliente?: string;
  documento?: string;
  dataVencimento?: string;
  valor?: number;
  [key: string]: unknown;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function NovoProcessoPage() {
  return (
    <ProtectedRoute perfis={["administrador", "supervisor"]}>
      <PageHeader
        titulo="Novo Processo"
        descricao="Criação e distribuição de processos de cobrança"
        acoes={
          <Button asChild size="sm" variant="outline">
            <Link to="/cobranca/meus-processos">
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1"><CriarBatchForm /></div>
        <div className="lg:col-span-2"><ContasProcessadas /></div>
      </div>
    </ProtectedRoute>
  );
}

// ─── Formulário de criação de batch ─────────────────────────────────────────

function CriarBatchForm() {
  const [selectedEnterprises, setSelectedEnterprises] = useState<string[]>([]);
  const [limit, setLimit] = useState("200");
  const [aplicarS1, setAplicarS1] = useState(false);
  const [aplicarCronograma, setAplicarCronograma] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Criar processo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EnterprisesMultiSelect selected={selectedEnterprises} onChange={setSelectedEnterprises} />
          <div className="space-y-1">
            <Label>Limite de itens</Label>
            <Input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="s1-charge" checked={aplicarS1} onCheckedChange={(v) => setAplicarS1(!!v)} />
            <Label htmlFor="s1-charge" className="cursor-pointer">Aplicar filtro S1</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="cronograma-charge" checked={aplicarCronograma} onCheckedChange={(v) => setAplicarCronograma(!!v)} />
            <Label htmlFor="cronograma-charge" className="cursor-pointer">Aplicar cronograma</Label>
          </div>
          <Button className="w-full" variant="outline" onClick={() => setPreviewOpen(true)}>
            Pré-visualizar dados
          </Button>
        </CardContent>
      </Card>
      <PreviewSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        enterprises={selectedEnterprises}
        limit={limit}
        aplicarS1={aplicarS1}
        aplicarCronograma={aplicarCronograma}
      />
    </>
  );
}

// ─── Multi-select de empreendimentos ─────────────────────────────────────────

function EnterprisesMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const { data: list = [] } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
    staleTime: 1000 * 60 * 5,
  });

  const active = list.filter((e) => e.status === "ativo");

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name]);

  const label =
    selected.length === 0
      ? "Todos os empreendimentos"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selecionados`;

  return (
    <div className="space-y-1">
      <Label>Empreendimentos</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">{label}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <ScrollArea className="h-56">
            <div className="space-y-1 pr-2">
              {active.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer"
                  onClick={() => toggle(e.cost_center_name)}
                >
                  <Checkbox
                    checked={selected.includes(e.cost_center_name)}
                    onCheckedChange={() => toggle(e.cost_center_name)}
                  />
                  <span className="text-sm">{e.cost_center_name}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-1 w-full text-xs" onClick={() => onChange([])}>
              Limpar seleção
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Sheet de pré-visualização ───────────────────────────────────────────────

function PreviewSheet({
  open,
  onClose,
  enterprises,
  limit,
  aplicarS1,
  aplicarCronograma,
}: {
  open: boolean;
  onClose: () => void;
  enterprises: string[];
  limit: string;
  aplicarS1: boolean;
  aplicarCronograma: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: rows = [], isFetching, isError } = useQuery<BqRow[]>({
    queryKey: ["bq-preview", limit],
    queryFn: () => api.get<BqRow[]>("/bq/contas-receber", { limit: limit || "200", option: "charge" }),
    enabled: open,
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/charges", {
        source: "contas-receber",
        option: "charge",
        enterprises,
        limit: Number(limit),
        ...(aplicarS1 ? { aplicar_filtro_s1: true } : {}),
        ...(aplicarCronograma ? { aplicar_cronograma: true } : {}),
      }),
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      queryClient.invalidateQueries({ queryKey: ["charge-items-all"] });
      const res = data as { batch: { batch_code: string }; insertedItems: number };
      toast.success(`Processo ${res.batch.batch_code} criado — ${res.insertedItems} itens`);
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar processo.");
    },
  });

  const filtered =
    enterprises.length > 0
      ? rows.filter((r) => {
          const emp = String(r.empresa ?? "").toLowerCase();
          return enterprises.some((e) => emp.includes(e.toLowerCase()));
        })
      : rows;

  const columns: Column<BqRow>[] = [
    { key: "cliente", header: "Cliente", accessor: (r) => String(r.cliente ?? "—") },
    { key: "empresa", header: "Empreendimento", accessor: (r) => String(r.empresa ?? "—") },
    { key: "documento", header: "Documento", accessor: (r) => String(r.documento ?? "—") },
    {
      key: "valor",
      header: "Valor",
      render: (r) =>
        typeof r.valor === "number"
          ? r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
    },
    {
      key: "venc",
      header: "Vencimento",
      accessor: (r) =>
        r.dataVencimento ? new Date(String(r.dataVencimento)).toLocaleDateString("pt-BR") : "—",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[90vw] sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Pré-visualização — Contas a Receber ({filtered.length} registros)
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {isFetching ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Erro ao carregar dados do BigQuery.</p>
          ) : (
            <DataTable data={filtered} columns={columns} />
          )}
        </div>
        <div className="mt-6 flex justify-end border-t pt-4">
          <Button
            disabled={mutation.isPending || isFetching || filtered.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Processando…" : `Criar processo (${filtered.length} itens)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Contas Processadas ───────────────────────────────────────────────────────

function ContasProcessadas() {
  const { data: items = [], isLoading } = useQuery<ChargeItem[]>({
    queryKey: ["charge-items-all"],
    queryFn: () => api.get<ChargeItem[]>("/charges/items"),
    staleTime: 1000 * 60,
  });

  const columns: Column<ChargeItem>[] = [
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    {
      key: "amount",
      header: "Valor",
      render: (r) =>
        r.amount != null
          ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
    },
    { key: "days", header: "Dias", accessor: (r) => r.days_overdue ?? 0 },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge variant="secondary">{r.status}</Badge>,
    },
    {
      key: "flags",
      header: "Flags",
      render: (r) => (
        <div className="flex gap-1">
          {r.internal_handling_flag && <Badge variant="destructive" className="text-xs">TI</Badge>}
          {r.legal_process_flag && <Badge variant="outline" className="text-xs">JUR</Badge>}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
    );
  }

  return (
    <div>
      <h2 className="font-semibold mb-4">Contas processadas ({items.length})</h2>
      <DataTable data={items} columns={columns} />
    </div>
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
