import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/app/DataTable";
import { ClientGroupedItems, groupTitleItems } from "@/components/app/ClientGroupedItems";
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
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Users } from "lucide-react";

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
  centroCusto?: string;
  costCenterName?: string;
  empresa?: string;
  cliente?: string;
  documento?: string;
  dataVencimento?: string;
  valor?: number;
  titulo?: string;
  parcelas?: Array<{
    valor?: number;
    dataVencimento?: string;
  }>;
  [key: string]: unknown;
}
type PreviewBqRow = BqRow & { id: string };
type BqResponse = { data?: BqRow[] };
type PaginatedBqResponse<T> = { data?: T[]; totalPages?: number };
type CreatedBatch = { id: string; batch_code: string };

interface BqProcesso {
  documento: string | null;
}

interface InternalHandling {
  id: string;
  document: string;
  status: "ativo" | "inativo";
}

async function fetchContasReceberByEnterpriseIds(enterpriseIds: string[], pageSize: number): Promise<BqRow[]> {
  const first = await api.post<PaginatedBqResponse<BqRow>>("/bq/contas-receber", {
    option: "charge",
    enterpriseIds,
    page: 1,
    pageSize,
  });

  const firstRows = first.data ?? [];
  const totalPages = Math.max(1, Number(first.totalPages ?? 1));
  if (totalPages === 1) {
    return firstRows;
  }

  const pages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      api.post<PaginatedBqResponse<BqRow>>("/bq/contas-receber", {
        option: "charge",
        enterpriseIds,
        page: i + 2,
        pageSize,
      }),
    ),
  );

  return [firstRows, ...pages.map((p) => p.data ?? [])].flat();
}

async function fetchAllProcessosJuridicos(pageSize = 200): Promise<BqProcesso[]> {
  const first = await api.post<PaginatedBqResponse<BqProcesso>>("/bq/processos-juridicos", { page: 1, pageSize });
  const totalPages = Math.max(1, Number(first.totalPages ?? 1));
  if (totalPages === 1) return first.data ?? [];
  const pages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      api.post<PaginatedBqResponse<BqProcesso>>("/bq/processos-juridicos", { page: i + 2, pageSize }),
    ),
  );
  return [first, ...pages].flatMap((p) => p.data ?? []);
}

function getRowAmount(row: BqRow) {
  if (typeof row.valor === "number") {
    return row.valor;
  }

  if (!Array.isArray(row.parcelas)) {
    return null;
  }

  return row.parcelas.reduce((sum, parcela) => sum + (typeof parcela.valor === "number" ? parcela.valor : 0), 0);
}

function getRowDueDate(row: BqRow) {
  if (row.dataVencimento) {
    return row.dataVencimento;
  }

  if (!Array.isArray(row.parcelas)) {
    return null;
  }

  const firstWithDate = row.parcelas.find((parcela) => parcela.dataVencimento);
  return firstWithDate?.dataVencimento ?? null;
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
  const [selectedEnterpriseIds, setSelectedEnterpriseIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Criar processo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EnterprisesMultiSelect selected={selectedEnterpriseIds} onChange={setSelectedEnterpriseIds} />
          <Button className="w-full" variant="outline" onClick={() => setPreviewOpen(true)}>
            Pré-visualizar dados
          </Button>
        </CardContent>
      </Card>
      <PreviewSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        enterpriseIds={selectedEnterpriseIds}
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
  const [search, setSearch] = useState("");
  const { data: list = [] } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
    staleTime: 1000 * 60 * 5,
  });

  const active = list.filter((e) => e.status === "ativo");
  const normalizeSearch = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const searchTerm = normalizeSearch(search);
  const filteredActive = searchTerm
    ? active.filter((e) => normalizeSearch(e.cost_center_name).includes(searchTerm))
    : active;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const label =
    selected.length === 0
      ? "Todos os empreendimentos"
      : selected.length === 1
        ? (active.find((e) => e.id === selected[0])?.cost_center_name ?? "1 selecionado")
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
          <Input
            className="mb-2 h-9"
            placeholder="Buscar empreendimento..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ScrollArea className="h-56">
            <div className="space-y-1 pr-2">
              {filteredActive.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum empreendimento encontrado.</p>
              ) : filteredActive.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer"
                  onClick={() => toggle(e.id)}
                >
                  <Checkbox
                    checked={selected.includes(e.id)}
                    onCheckedChange={() => toggle(e.id)}
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
  enterpriseIds,
}: {
  open: boolean;
  onClose: () => void;
  enterpriseIds: string[];
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [createdBatch, setCreatedBatch] = useState<CreatedBatch | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [availableFocusedUserId, setAvailableFocusedUserId] = useState<string | null>(null);
  const [selectedFocusedUserId, setSelectedFocusedUserId] = useState<string | null>(null);
  const [showDistributionPreview, setShowDistributionPreview] = useState(false);
  const { data: enterprises = [] } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
    staleTime: 1000 * 60 * 5,
  });
  const activeEnterpriseIds = enterprises.filter((enterprise) => enterprise.status === "ativo").map((enterprise) => enterprise.id);
  const effectiveEnterpriseIds =
    enterpriseIds.length > 0 && enterpriseIds.length === activeEnterpriseIds.length ? [] : enterpriseIds;

  const { data: rows = [], isFetching, isError } = useQuery<BqRow[]>({
    queryKey: ["bq-preview", effectiveEnterpriseIds.join("|")],
    queryFn: async () => {
      const first = await api.post<PaginatedBqResponse<BqRow>>("/bq/contas-receber", {
        option: "charge",
        ...(effectiveEnterpriseIds.length > 0 ? { enterpriseIds: effectiveEnterpriseIds } : {}),
        page: 1,
        pageSize: 5000,
      });

      const firstRows = first.data ?? [];
      const totalPages = Math.max(1, Number(first.totalPages ?? 1));
      const pages = totalPages === 1
        ? []
        : await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              api.post<PaginatedBqResponse<BqRow>>("/bq/contas-receber", {
                option: "charge",
                ...(effectiveEnterpriseIds.length > 0 ? { enterpriseIds: effectiveEnterpriseIds } : {}),
                page: i + 2,
                pageSize: 5000,
              }),
            ),
          );
      const perEnterpriseRows = [firstRows, ...pages.map((page) => page.data ?? [])].flat();

      const deduped = new Map<string, BqRow>();
      for (const row of perEnterpriseRows) {
        const key = String(
          row.verificador ??
          row.id ??
          `${row.documento ?? ""}|${getRowDueDate(row) ?? ""}|${getRowAmount(row) ?? ""}|${row.titulo ?? ""}|${row.centroCusto ?? row.empresa ?? ""}`,
        );
        deduped.set(key, row);
      }
      return Array.from(deduped.values());
    },
    enabled: open,
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/charges", {
        source: "contas-receber",
        option: "charge",
        ...(effectiveEnterpriseIds.length > 0 ? { enterpriseIds: effectiveEnterpriseIds } : {}),
      }),
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      queryClient.invalidateQueries({ queryKey: ["charge-items-all"] });
      const res = data as { batch: CreatedBatch; insertedItems: number };
      if (!res.insertedItems || res.insertedItems <= 0) {
        toast.error(`Processo ${res.batch.batch_code} criado sem itens. Verifique os filtros e tente novamente.`);
        return;
      }
      toast.success(`Processo ${res.batch.batch_code} criado com ${res.insertedItems} itens`);
      setCreatedBatch(res.batch);
      setStep(2);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar processo.");
    },
  });

  const filtered = rows;
  const normalizeDoc = (s: string) => s.replace(/\D/g, "");

  const { data: batchItems = [], isFetching: isFetchingBatchItems } = useQuery<ChargeItem[]>({
    queryKey: ["batch-items", createdBatch?.id],
    queryFn: () => api.get<ChargeItem[]>(`/charges/items?batchId=${createdBatch?.id}`),
    enabled: Boolean(createdBatch?.id),
    retry: false,
  });

  const { data: processos = [], isFetching: isFetchingProcessos } = useQuery<BqProcesso[]>({
    queryKey: ["bq-processos-juridicos-preview"],
    queryFn: () => fetchAllProcessosJuridicos(200),
    enabled: step >= 3 && Boolean(createdBatch?.id),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const { data: internalHandling = [], isFetching: isFetchingInternalHandling } = useQuery<InternalHandling[]>({
    queryKey: ["internal-handling"],
    queryFn: () => api.get<InternalHandling[]>("/internal-handling"),
    enabled: step >= 4 && Boolean(createdBatch?.id),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const processoDocs = new Set(processos.map((p) => normalizeDoc(p.documento ?? "")).filter(Boolean));
  const internalHandlingDocs = new Set(
    internalHandling
      .filter((t) => t.status === "ativo")
      .map((t) => normalizeDoc(t.document ?? ""))
      .filter(Boolean),
  );
  const juridicoBloqueados = batchItems.filter((i) => i.document && processoDocs.has(normalizeDoc(i.document)));
  const elegiveis = batchItems.filter((i) => {
    if (!i.document) return true;
    const doc = normalizeDoc(i.document);
    return !processoDocs.has(doc) && !internalHandlingDocs.has(doc);
  });
  const tratativaInterna = batchItems.filter((i) => {
    const doc = i.document ? normalizeDoc(i.document) : "";
    return i.internal_handling_flag || (!!doc && internalHandlingDocs.has(doc));
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
    enabled: step === 5,
  });
  const cobradores = users.filter((u) => u.role === "cobrador" || u.role === "supervisor" || u.role === "administrador");

  const cobradoresOrdenados = useMemo(
    () =>
      [...cobradores].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "pt-BR", { sensitivity: "base" }),
      ),
    [cobradores],
  );

  const cobradoresIds = useMemo(() => new Set(cobradoresOrdenados.map((user) => user.userId)), [cobradoresOrdenados]);

  const gruposBatch = useMemo(() => groupTitleItems(batchItems), [batchItems]);
  const gruposJuridicoBloqueados = useMemo(() => groupTitleItems(juridicoBloqueados).length, [juridicoBloqueados]);
  const gruposTratativaInterna = useMemo(() => groupTitleItems(tratativaInterna).length, [tratativaInterna]);
  const gruposDistribuicao = useMemo(() => groupTitleItems(elegiveis), [elegiveis]);
  const gruposDistribuicaoOrdenados = useMemo(
    () =>
      [...gruposDistribuicao].sort((a, b) =>
        a.clientName.localeCompare(b.clientName, "pt-BR", { sensitivity: "base" }),
      ),
    [gruposDistribuicao],
  );

  const colaboradoresSelecionados = useMemo(
    () =>
      selectedUserIds
        .map((userId) => cobradoresOrdenados.find((u) => u.userId === userId))
        .filter((u): u is AppUser => !!u),
    [cobradoresOrdenados, selectedUserIds],
  );

  const colaboradoresDisponiveis = useMemo(
    () => cobradoresOrdenados.filter((u) => !selectedUserIds.includes(u.userId)),
    [cobradoresOrdenados, selectedUserIds],
  );

  const planoDistribuicao = useMemo(() => {
    const total = gruposDistribuicaoOrdenados.length;
    const totalUsers = colaboradoresSelecionados.length;
    if (total === 0 || totalUsers === 0) return [];

    const base = Math.floor(total / totalUsers);
    const resto = total % totalUsers;
    let cursor = 0;

    return colaboradoresSelecionados.map((u, index) => {
      const quantidade = base + (index < resto ? 1 : 0);
      const grupos = gruposDistribuicaoOrdenados.slice(cursor, cursor + quantidade);
      const itemIds = grupos.flatMap((grupo) => grupo.items.map((item) => item.id));
      const clientNames = grupos.map((grupo) => grupo.clientName).filter(Boolean);
      cursor += quantidade;
      return { user: u, itemIds, clientNames };
    }).filter((p) => p.itemIds.length > 0);
  }, [colaboradoresSelecionados, gruposDistribuicaoOrdenados]);

  const addSelectedCollaborator = () => {
    if (!availableFocusedUserId) return;
    setShowDistributionPreview(false);
    setSelectedUserIds((prev) => (prev.includes(availableFocusedUserId) ? prev : [...prev, availableFocusedUserId]));
    setSelectedFocusedUserId(availableFocusedUserId);
    const remaining = colaboradoresDisponiveis.filter((u) => u.userId !== availableFocusedUserId);
    setAvailableFocusedUserId(remaining[0]?.userId ?? null);
  };

  const removeSelectedCollaborator = () => {
    if (!selectedFocusedUserId) return;
    setShowDistributionPreview(false);
    setSelectedUserIds((prev) => prev.filter((id) => id !== selectedFocusedUserId));
    setAvailableFocusedUserId(selectedFocusedUserId);
    const remaining = colaboradoresSelecionados.filter((u) => u.userId !== selectedFocusedUserId);
    setSelectedFocusedUserId(remaining[0]?.userId ?? null);
  };

  const moveSelectedCollaborator = (direction: "up" | "down") => {
    if (!selectedFocusedUserId) return;
    setShowDistributionPreview(false);
    setSelectedUserIds((prev) => {
      const currentIndex = prev.indexOf(selectedFocusedUserId);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      for (const grupo of planoDistribuicao) {
        await api.patch("/charges/items/assign", {
          assignedToUserId: grupo.user.userId,
          itemIds: grupo.itemIds,
        });
      }
      if (createdBatch?.id) {
        await api.patch(`/charges/${createdBatch.id}/status`, { status: "concluido" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      queryClient.invalidateQueries({ queryKey: ["charge-items-all"] });
      if (createdBatch?.id) queryClient.invalidateQueries({ queryKey: ["batch-items", createdBatch.id] });
      toast.success("Distribuição concluída com sucesso.");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao distribuir itens."),
  });

  useEffect(() => {
    setSelectedUserIds((prev) => {
      const next = prev.filter((id) => cobradoresIds.has(id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [cobradoresIds]);

  const previewRows: PreviewBqRow[] = filtered.map((row, index) => ({
    ...row,
    id: String(
      row.id ??
      row.verificador ??
      `${row.documento ?? ""}|${getRowDueDate(row) ?? ""}|${getRowAmount(row) ?? ""}|${row.titulo ?? ""}|${index}`,
    ),
  }));

  const columns: Column<PreviewBqRow>[] = [
    { key: "cliente", header: "Cliente", accessor: (r) => String(r.cliente ?? "—") },
    {
      key: "empresa",
      header: "Empreendimento",
      accessor: (r) => String(r.centroCusto ?? r.costCenterName ?? r.empresa ?? "—"),
    },
    { key: "documento", header: "Documento", accessor: (r) => String(r.documento ?? "—") },
    {
      key: "valor",
      header: "Valor",
      render: (r) =>
        typeof getRowAmount(r) === "number"
          ? Number(getRowAmount(r)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
    },
    {
      key: "venc",
      header: "Vencimento",
      accessor: (r) =>
        getRowDueDate(r) ? new Date(String(getRowDueDate(r))).toLocaleDateString("pt-BR") : "—",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[90vw] sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {step === 1 && (mutation.isPending
              ? "Criando processo - verificando dados..."
              : isFetching
              ? "Pré-visualização — Contas a Receber (carregando registros...)"
              : `Pré-visualização — Contas a Receber (${filtered.length} registros)`)}
            {step >= 2 && `Processo ${createdBatch?.batch_code ?? ""}`}
          </SheetTitle>
        </SheetHeader>
        {step >= 2 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto">
            {["Resumo", "Processos Jurídicos", "Tratativas Internas", "Distribuição"].map((label, idx) => {
              const n = idx + 1;
              const active = (step - 1) === n;
              const done = (step - 1) > n;
              return (
                <div key={label} className="flex items-center gap-2 shrink-0">
                  <div className={`h-6 w-6 rounded-full text-xs flex items-center justify-center ${done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {n}
                  </div>
                  <span className={`text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          {step === 1 && mutation.isPending ? (
            <div className="space-y-3 rounded-md border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Criando processo e verificando regras...</p>
                <p className="text-sm text-muted-foreground">
                  Estamos salvando os títulos e preparando as validações antes de liberar a distribuição.
                </p>
              </div>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : step === 1 && isFetching ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Buscando dados dos empreendimentos selecionados...</p>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : step === 1 && isError ? (
            <p className="text-sm text-destructive">Erro ao carregar dados do BigQuery.</p>
          ) : step === 1 ? (
            <DataTable data={previewRows} columns={columns} />
          ) : null}

          {step === 2 && (isFetchingBatchItems ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Código</span>
                  <span className="font-medium">{createdBatch?.batch_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de títulos</span>
                  <span className="font-medium">{gruposBatch.length}</span>
                </div>
                {gruposJuridicoBloqueados > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Processos jurídicos</span>
                    <span className="font-medium">{gruposJuridicoBloqueados}</span>
                  </div>
                )}
                {gruposTratativaInterna > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Tratativas internas</span>
                    <span className="font-medium">{gruposTratativaInterna}</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Títulos do processo</p>
                <div className="max-h-[380px] overflow-y-auto rounded-md border p-2">
                  <ClientGroupedItems items={batchItems} />
                </div>
              </div>
            </div>
          ))}

          {step === 3 && ((isFetchingBatchItems || isFetchingProcessos) ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Todos os {batchItems.length} itens do processo. Linhas em vermelho já possuem processo jurídico ativo no ERP e <strong>não serão cobradas</strong>.
              </p>
            <DataTable
              data={batchItems}
              columns={[
                { key: "cliente", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
                { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
                { key: "emp", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
                {
                  key: "valor",
                  header: "Valor",
                  render: (r) =>
                    r.amount != null ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
                },
                {
                  key: "jur",
                  header: "",
                  render: (r) => (r.document && processoDocs.has(normalizeDoc(r.document)))
                    ? <Badge variant="destructive">Processo ativo</Badge>
                    : null,
                },
              ]}
              rowClassName={(r) => (r.document && processoDocs.has(normalizeDoc(r.document)) ? "bg-red-50 hover:bg-red-100" : "")}
            />
            </div>
          ))}

          {step === 4 && (
            <div className="space-y-3">
              {isFetchingInternalHandling ? (
                <Skeleton className="h-24 w-full" />
              ) : tratativaInterna.length === 0 ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  Nenhum item com flag de tratativa interna. Pode prosseguir.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {tratativaInterna.length} {tratativaInterna.length === 1 ? "item possui" : "itens possuem"} tratativa interna.
                  </p>
                  <DataTable
                    data={tratativaInterna}
                    columns={[
                      { key: "cliente", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
                      { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
                      { key: "emp", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
                      {
                        key: "valor",
                        header: "Valor",
                        render: (r) =>
                          r.amount != null ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
                      },
                    ]}
                  />
                </>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />Distribuição
              </h3>
              <p className="text-sm text-muted-foreground">
                Selecione os colaboradores que participarão da distribuição dos {gruposDistribuicao.length} títulos elegíveis.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Títulos elegíveis para distribuição</p>
                <ClientGroupedItems items={elegiveis} />
              </div>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <Label>Colaboradores</Label>
                {cobradoresOrdenados.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum colaborador disponível para distribuição.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Disponíveis</p>
                      <div className="rounded-md border">
                        {colaboradoresDisponiveis.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-muted-foreground">Todos os colaboradores ja foram selecionados.</p>
                        ) : (
                          colaboradoresDisponiveis.map((user) => {
                            const active = availableFocusedUserId === user.userId;
                            return (
                              <button
                                key={user.userId}
                                type="button"
                                className={cn(
                                  "flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40",
                                  active && "bg-muted",
                                )}
                                onClick={() => setAvailableFocusedUserId(user.userId)}
                              >
                                <span>{user.fullName}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={addSelectedCollaborator}
                        disabled={!availableFocusedUserId}
                        title="Adicionar colaborador"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={removeSelectedCollaborator}
                        disabled={!selectedFocusedUserId}
                        title="Remover colaborador"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Selecionados na ordem da distribuicao</p>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => moveSelectedCollaborator("up")}
                            disabled={!selectedFocusedUserId || selectedUserIds.indexOf(selectedFocusedUserId) <= 0}
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => moveSelectedCollaborator("down")}
                            disabled={
                              !selectedFocusedUserId ||
                              selectedUserIds.indexOf(selectedFocusedUserId) === -1 ||
                              selectedUserIds.indexOf(selectedFocusedUserId) >= selectedUserIds.length - 1
                            }
                            title="Mover para baixo"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-md border">
                        {colaboradoresSelecionados.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-muted-foreground">Adicione ao menos um colaborador para gerar a distribuicao.</p>
                        ) : (
                          colaboradoresSelecionados.map((user, index) => {
                            const active = selectedFocusedUserId === user.userId;
                            return (
                              <button
                                key={user.userId}
                                type="button"
                                className={cn(
                                  "flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40",
                                  active && "bg-muted",
                                )}
                                onClick={() => setSelectedFocusedUserId(user.userId)}
                              >
                                <span>{user.fullName}</span>
                                <Badge variant="outline">{index + 1}</Badge>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {selectedUserIds.length > 0 && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDistributionPreview((value) => !value)}
                  >
                    {showDistributionPreview ? "Ocultar preview" : "Preview da divisão"}
                  </Button>
                  {showDistributionPreview && (
                    <div className="space-y-3 rounded-md border p-3 text-sm">
                      {planoDistribuicao.map((grupo) => (
                        <div key={grupo.user.userId} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{grupo.user.fullName}</span>
                            <Badge variant="secondary">{grupo.itemIds.length} título(s)</Badge>
                          </div>
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Clientes distribuídos</p>
                            {grupo.clientNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {grupo.clientNames.map((clientName) => (
                                  <Badge key={`${grupo.user.userId}-${clientName}`} variant="outline" className="font-normal">
                                    {clientName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Nenhum cliente vinculado.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-between border-t pt-4">
          {step === 1 && (
            <div />
          )}
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
          )}
          {step === 3 && (
            <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
          )}
          {step === 4 && (
            <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
          )}
          {step === 5 && (
            <Button variant="outline" onClick={() => setStep(4)}>Voltar</Button>
          )}

          {step === 1 && (
            <Button
              disabled={mutation.isPending || isFetching || filtered.length === 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Processando..." : `Criar processo (${filtered.length} itens)`}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={() => setStep(4)}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => setStep(5)}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 5 && (
            <Button
              disabled={assignMutation.isPending || planoDistribuicao.length === 0 || gruposDistribuicao.length === 0}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? "Distribuindo..." : "Concluir e distribuir"}
            </Button>
          )}
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
