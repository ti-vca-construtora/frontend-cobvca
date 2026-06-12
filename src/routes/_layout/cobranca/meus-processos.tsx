import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { ClientGroupedItems } from "@/components/app/ClientGroupedItems";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  LayoutList, LayoutGrid, Plus, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Check,
  PlayCircle, Users, AlertTriangle, Gavel, MessageCircle, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { groupTitleItems } from "@/components/app/ClientGroupedItems";

export const Route = createFileRoute("/_layout/cobranca/meus-processos")({ component: MeusProcessosPage });

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChargeBatch {
  id: string;
  batch_code: string;
  enterprise_ids?: string[];
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface ChargeItem {
  id: string;
  batch_id: string;
  bill_id: string;
  assigned_to_user_id: string | null;
  document: string | null;
  client_name: string | null;
  enterprise_name: string | null;
  due_date: string | null;
  amount: number | null;
  days_overdue: number | null;
  status: "pendente" | "sem_retorno" | "em_atendimento" | "ciente_sem_retorno" | "em_negociacao" | "acordo" | "pago";
  feedback_category_key: string | null;
  feedback_notes: string | null;
  internal_handling_flag: boolean;
  legal_process_flag: boolean;
  source_base?: string | null;
  sync_status?: "nao_sincronizado" | "sincronizado" | "alterado" | "pago" | "processo_juridico" | "tratativa_interna";
}

interface AppUser {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

interface BqProcesso {
  documento: string | null;
  cliente: string | null;
  situacao: string | null;
  tipoProcesso: string | null;
  numero: string | null;
  nomeEmpreendimento: string | null;
}

interface InternalHandling {
  id: string;
  document: string;
  status: "ativo" | "inativo";
}

interface PaginatedBqResponse<T> {
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: T[];
}

interface BqUpdatePayload {
  vca: string[];
  lotear: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  sem_retorno: "Sem retorno",
  em_atendimento: "Em atendimento",
  ciente_sem_retorno: "Ciente s/ retorno",
  em_negociacao: "Em negociação",
  acordo: "Acordo",
  pago: "Pago",
};

const WIZARD_STEPS = ["Resumo", "Processos Jurídicos", "Tratativas Internas", "Distribuição"] as const;

async function fetchAllProcessosJuridicos(pageSize = 200): Promise<BqProcesso[]> {
  const first = await api.post<PaginatedBqResponse<BqProcesso>>("/bq/processos-juridicos", {
    page: 1,
    pageSize,
  });

  const totalPages = Math.max(1, Number(first.totalPages || 1));
  if (totalPages === 1) {
    return first.data ?? [];
  }

  const pages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      api.post<PaginatedBqResponse<BqProcesso>>("/bq/processos-juridicos", {
        page: i + 2,
        pageSize,
      }),
    ),
  );

  return [first, ...pages].flatMap((response) => response.data ?? []);
}

// ─── Page ────────────────────────────────────────────────────────────────────

function MeusProcessosPage() {
  const [view, setView] = useState<"table" | "cards">("table");
  const [busca, setBusca] = useState("");
  const [iniciarBatch, setIniciarBatch] = useState<ChargeBatch | null>(null);
  const [viewBatch, setViewBatch] = useState<ChargeBatch | null>(null);

  const { data: batches = [], isLoading } = useQuery<ChargeBatch[]>({
    queryKey: ["charge-batches"],
    queryFn: () => api.get<ChargeBatch[]>("/charges"),
    staleTime: 1000 * 30,
  });

  const filtrados = batches.filter((b) =>
    !busca || b.batch_code.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <ProtectedRoute perfis={["administrador", "supervisor", "cobrador"]}>
      <PageHeader
        titulo="Meus Processos"
        descricao="Processos de cobrança em andamento"
        acoes={
          <div className="flex items-center gap-2">
            <Button
              variant={view === "table" ? "default" : "outline"}
              size="icon"
              title="Visualização em tabela"
              onClick={() => setView("table")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "cards" ? "default" : "outline"}
              size="icon"
              title="Visualização em cards"
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button asChild size="sm">
              <Link to="/cobranca/novo-processo">
                <Plus className="h-4 w-4 mr-2" />Novo Processo
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por codigo do processo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : view === "table" ? (
        <BatchTable batches={filtrados} onIniciar={setIniciarBatch} onView={setViewBatch} />
      ) : (
        <BatchCards batches={filtrados} onIniciar={setIniciarBatch} onView={setViewBatch} />
      )}

      {iniciarBatch && (
        <IniciarWizard batch={iniciarBatch} onClose={() => setIniciarBatch(null)} />
      )}
      {viewBatch && (
        <ProcessOverviewSheet batch={viewBatch} onClose={() => setViewBatch(null)} />
      )}
    </ProtectedRoute>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function BatchStatusBadge({ status }: { status: string }) {
  const variant =
    status === "concluido" ? "default"
    : status === "em_andamento" ? "secondary"
    : status === "cancelado" ? "destructive"
    : "outline";
  return (
    <Badge variant={variant} className={cn(status === "concluido" && "bg-green-600 text-white hover:bg-green-600")}>
      {BATCH_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// ─── Batch table view ─────────────────────────────────────────────────────────

function BatchTable({
  batches,
  onIniciar,
  onView,
}: {
  batches: ChargeBatch[];
  onIniciar: (b: ChargeBatch) => void;
  onView: (b: ChargeBatch) => void;
}) {
  const columns: Column<ChargeBatch>[] = [
    { key: "batch_code", header: "Código", accessor: (r) => r.batch_code },
    {
      key: "status",
      header: "Status",
      render: (r) => <BatchStatusBadge status={r.status} />,
    },
    {
      key: "source",
      header: "Fonte",
      accessor: () => "Cobranca",
    },
    {
      key: "created_at",
      header: "Criado em",
      accessor: (r) => new Date(r.created_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "actions",
      header: "Ação",
      render: (r) => {
        if (r.status === "pendente" || r.status === "em_andamento") {
          return (
            <Button
              size="sm"
              variant={r.status === "em_andamento" ? "outline" : "default"}
              onClick={(e) => { e.stopPropagation(); onIniciar(r); }}
            >
              <PlayCircle className="mr-1 h-4 w-4" />
              {r.status === "pendente" ? "Iniciar" : "Continuar"}
            </Button>
          );
        }

        if (r.status === "concluido") {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onView(r); }}
            >
              Ver processo
            </Button>
          );
        }

        return null;
      }
    },
  ];

  return <DataTable data={batches} columns={columns} />;
}

// ─── Batch cards view ─────────────────────────────────────────────────────────

function BatchCards({
  batches,
  onIniciar,
  onView,
}: {
  batches: ChargeBatch[];
  onIniciar: (b: ChargeBatch) => void;
  onView: (b: ChargeBatch) => void;
}) {
  if (batches.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum processo encontrado.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {batches.map((b) => (
        <Card key={b.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{b.batch_code}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <BatchStatusBadge status={b.status} />
            <p className="text-muted-foreground text-xs">
              Cobranca
            </p>
            <p className="text-muted-foreground text-xs">
              Criado em {new Date(b.created_at).toLocaleDateString("pt-BR")}
            </p>
          </CardContent>
          {(b.status === "pendente" || b.status === "em_andamento" || b.status === "concluido") && (
            <CardFooter>
              <Button
                size="sm"
                className="w-full"
                variant={b.status === "pendente" ? "default" : "outline"}
                onClick={() => (b.status === "concluido" ? onView(b) : onIniciar(b))}
              >
                {b.status !== "concluido" && <PlayCircle className="mr-1 h-4 w-4" />}
                {b.status === "pendente" ? "Iniciar" : b.status === "em_andamento" ? "Continuar" : "Ver processo"}
              </Button>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Wizard de inicio de processo ────────────────────────────────────────────

function IniciarWizard({ batch, onClose }: { batch: ChargeBatch; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [feedbackItem, setFeedbackItem] = useState<ChargeItem | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [availableFocusedUserId, setAvailableFocusedUserId] = useState<string | null>(null);
  const [selectedFocusedUserId, setSelectedFocusedUserId] = useState<string | null>(null);
  const [showDistributionPreview, setShowDistributionPreview] = useState(false);

  const { data: items = [], isLoading: itemsLoading } = useQuery<ChargeItem[]>({
    queryKey: ["batch-items", batch.id],
    queryFn: () => api.get<ChargeItem[]>(`/charges/items?batchId=${batch.id}`),
  });

  const { data: bqProcessos = [], isLoading: processosBqLoading } = useQuery<BqProcesso[]>({
    queryKey: ["bq-processos-juridicos"],
    queryFn: () => fetchAllProcessosJuridicos(200),
    enabled: step === 2,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const { data: internalHandling = [], isLoading: internalHandlingLoading } = useQuery<InternalHandling[]>({
    queryKey: ["internal-handling"],
    queryFn: () => api.get<InternalHandling[]>("/internal-handling"),
    enabled: step >= 3,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Set of normalized documents that are already in legal process in BQ
  const normalizeDoc = (s: string) => s.replace(/\D/g, "");
  const bqProcessoDocsSet = new Set(
    bqProcessos.map((p) => normalizeDoc(p.documento ?? "")).filter(Boolean),
  );
  const internalHandlingDocsSet = new Set(
    internalHandling
      .filter((t) => t.status === "ativo")
      .map((t) => normalizeDoc(t.document ?? ""))
      .filter(Boolean),
  );

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
    enabled: step === 4,
  });
  const cobradores = users.filter((u) => u.role === "cobrador" || u.role === "supervisor" || u.role === "administrador");

  const startMutation = useMutation({
    mutationFn: () => api.patch(`/charges/${batch.id}/status`, { status: "em_andamento" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      syncBeforeStep2Mutation.mutate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao iniciar processo."),
  });

  const syncBeforeStep2Mutation = useMutation({
    mutationFn: async () => {
      const billIdsByBase = items.reduce(
        (acc, item) => {
          const rawBillId = String(item.bill_id ?? "").split("#")[0].trim();
          if (!/^\d+$/.test(rawBillId)) return acc;

          const base = (item.source_base ?? "").toLowerCase();
          if (base === "lot" || base === "lotear") {
            acc.lotear.push(rawBillId);
            acc.itemIds.add(item.id);
            return acc;
          }

          acc.vca.push(rawBillId);
          acc.itemIds.add(item.id);
          return acc;
        },
        { vca: [] as string[], lotear: [] as string[], itemIds: new Set<string>() },
      );

      const payload: BqUpdatePayload = {
        vca: Array.from(new Set(billIdsByBase.vca)),
        lotear: Array.from(new Set(billIdsByBase.lotear)),
      };

      if (payload.vca.length === 0 && payload.lotear.length === 0) {
        return;
      }

      await api.post("/bq/update", payload);

      await Promise.all(
        Array.from(billIdsByBase.itemIds).map((itemId) =>
          api.patch(`/charges/items/${itemId}/sync-status`, { syncStatus: "sincronizado" }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-items", batch.id] });
      setStep(2);
    },
    onError: (err) => {
      toast.warning(err instanceof ApiError
        ? `${err.message} Seguindo sem sincronizacao prévia.`
        : "Erro ao sincronizar títulos. Seguindo sem sincronizacao prévia.");
      setStep(2);
    },
  });

  const updateSyncStatusForItems = async (
    itemIds: string[],
    syncStatus: "sincronizado" | "processo_juridico" | "tratativa_interna",
  ) => {
    if (itemIds.length === 0) return;
    await Promise.all(
      itemIds.map((itemId) =>
        api.patch(`/charges/items/${itemId}/sync-status`, { syncStatus }),
      ),
    );
  };

  const legalItemIds = useMemo(
    () =>
      items
        .filter((i) => i.document && bqProcessoDocsSet.has(normalizeDoc(i.document)))
        .map((i) => i.id),
    [items, bqProcessoDocsSet],
  );

  const legalItemsFromCurrentCheck = useMemo(
    () =>
      items.filter((i) => i.document && bqProcessoDocsSet.has(normalizeDoc(i.document))),
    [items, bqProcessoDocsSet],
  );

  const internalItemIds = useMemo(
    () =>
      items
        .filter((i) => {
          const doc = i.document ? normalizeDoc(i.document) : "";
          return i.internal_handling_flag || (!!doc && internalHandlingDocsSet.has(doc));
        })
        .map((i) => i.id),
    [items, internalHandlingDocsSet],
  );

  const elegiveisDistribuicao = items.filter((i) =>
    !(i.document && (bqProcessoDocsSet.has(normalizeDoc(i.document)) || internalHandlingDocsSet.has(normalizeDoc(i.document)))),
  );
  const internalItems = items.filter((i) => {
    const doc = i.document ? normalizeDoc(i.document) : "";
    return i.internal_handling_flag || (!!doc && internalHandlingDocsSet.has(doc));
  });
  const totalTitulos = useMemo(() => groupTitleItems(items).length, [items]);
  const titulosJuridicos = useMemo(
    () => groupTitleItems(legalItemsFromCurrentCheck, bqProcessoDocsSet).length,
    [legalItemsFromCurrentCheck, bqProcessoDocsSet],
  );
  const titulosTratativa = useMemo(
    () => groupTitleItems(internalItems, undefined, internalHandlingDocsSet).length,
    [internalItems, internalHandlingDocsSet],
  );
  const gruposDistribuicao = useMemo(
    () => groupTitleItems(elegiveisDistribuicao),
    [elegiveisDistribuicao],
  );
  const gruposDistribuicaoOrdenados = useMemo(
    () =>
      [...gruposDistribuicao].sort((a, b) => {
        const byClient = a.clientName.localeCompare(b.clientName, "pt-BR", { sensitivity: "base" });
        if (byClient !== 0) return byClient;
        const byEnterprise = a.enterpriseName.localeCompare(b.enterpriseName, "pt-BR", { sensitivity: "base" });
        if (byEnterprise !== 0) return byEnterprise;
        return a.billId.localeCompare(b.billId, "pt-BR", { sensitivity: "base" });
      }),
    [gruposDistribuicao],
  );
  const cobradoresOrdenados = useMemo(
    () =>
      [...cobradores].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "pt-BR", { sensitivity: "base" }),
      ),
    [cobradores],
  );
  const cobradoresIds = useMemo(
    () => new Set(cobradoresOrdenados.map((user) => user.userId)),
    [cobradoresOrdenados],
  );

  useEffect(() => {
    setSelectedUserIds((prev) => {
      const next = prev.filter((id) => cobradoresIds.has(id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [cobradoresIds]);

  const colaboradoresDisponiveis = useMemo(
    () => cobradoresOrdenados.filter((u) => !selectedUserIds.includes(u.userId)),
    [cobradoresOrdenados, selectedUserIds],
  );

  const colaboradoresSelecionados = useMemo(
    () =>
      selectedUserIds
        .map((userId) => cobradoresOrdenados.find((u) => u.userId === userId))
        .filter((u): u is AppUser => !!u),
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
      await api.patch(`/charges/${batch.id}/status`, { status: "concluido" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      queryClient.invalidateQueries({ queryKey: ["batch-items", batch.id] });
      toast.success("Itens distribuídos com sucesso!");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao distribuir itens."),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-screen max-w-none sm:w-screen sm:max-w-none h-screen max-h-screen flex flex-col">
        <SheetHeader className="mb-2 shrink-0">
          <SheetTitle>Iniciar Processo — {batch.batch_code}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {(startMutation.isPending || syncBeforeStep2Mutation.isPending) && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">Aguarde, estamos consultando novamente o banco de dados.</p>
            <p className="text-blue-800">
              Estamos sincronizando os títulos e validando processos jurídicos atualizados antes de liberar a próxima etapa.
            </p>
          </div>
        )}
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {WIZARD_STEPS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={label} className="flex items-center gap-1 shrink-0">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {done ? <Check className="h-3 w-3" /> : n}
                </div>
                <span className={cn("text-xs", active ? "font-semibold" : "text-muted-foreground")}>{label}</span>
                {i < WIZARD_STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Step 1 — Resumo */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />Resumo do processo
            </h3>
            <div className="rounded-md border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Código</span>
                <span className="font-medium">{batch.batch_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fonte</span>
                <span>Cobranca</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{new Date(batch.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {!itemsLoading && legalItemsFromCurrentCheck.length > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Processos jurídicos</span>
                  <span className="font-medium">{titulosJuridicos}</span>
                </div>
              )}
              {!itemsLoading && internalItems.length > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Tratativas internas</span>
                  <span className="font-medium">{internalItems.length}</span>
                </div>
              )}
            </div>

            {/* Items list */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Títulos do processo {itemsLoading ? "" : `(${items.length})`}
              </p>
              {itemsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum título encontrado.</p>
              ) : (
                <>
                  <ClientGroupedItems items={items} />
                {false && <div className="rounded-md border divide-y text-sm max-h-[360px] overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 gap-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.client_name ?? "—"}</p>
                        <p className="text-muted-foreground text-xs truncate">{item.document ?? "sem documento"}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-xs text-muted-foreground">{item.enterprise_name ?? "—"}</p>
                        <p className="font-medium text-xs">
                          {item.amount != null
                            ? item.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—"}
                        </p>
                      </div>
                      {(item.legal_process_flag || item.internal_handling_flag) && (
                        <div className="flex gap-1 shrink-0">
                          {item.legal_process_flag && <Badge variant="outline" className="text-xs px-1">JUR</Badge>}
                          {item.internal_handling_flag && <Badge variant="destructive" className="text-xs px-1">TI</Badge>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              {batch.status === "pendente" ? (
                <Button disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                  {startMutation.isPending ? "Iniciando..." : "Iniciar processo"}
                </Button>
              ) : (
                <Button disabled={syncBeforeStep2Mutation.isPending} onClick={() => syncBeforeStep2Mutation.mutate()}>
                  {syncBeforeStep2Mutation.isPending ? "Sincronizando..." : "Continuar"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Processos Juridicos */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Gavel className="h-4 w-4" />Processos Juridicos
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Títulos do processo</p>
                <p className="text-2xl font-semibold">{totalTitulos}</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-muted-foreground">Em processo jurídico</p>
                <p className="text-2xl font-semibold text-red-700">{titulosJuridicos}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Restantes para seguir</p>
                <p className="text-2xl font-semibold">{Math.max(totalTitulos - titulosJuridicos, 0)}</p>
              </div>
            </div>

            {itemsLoading || processosBqLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (() => {
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Todos os {items.length} itens do processo. As linhas marcadas em vermelho foram bloqueadas pela consulta atual ao BigQuery de processos jurídicos e <strong>não serão cobradas</strong>.
                    </p>
                    {titulosJuridicos > 0 && (
                      <Badge variant="destructive" className="shrink-0 ml-2">
                        {titulosJuridicos} título{titulosJuridicos !== 1 ? "s" : ""} bloqueado{titulosJuridicos !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  {false && <DataTable
                    data={items}
                    columns={[
                      { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
                      { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
                      { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
                      {
                        key: "amount",
                        header: "Valor",
                        render: (r) =>
                          r.amount != null
                            ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—",
                      },
                      {
                        key: "flags",
                        header: "",
                        render: (r) => {
                          const inBq = r.document && bqProcessoDocsSet.has(normalizeDoc(r.document));
                          return inBq ? (
                            <Badge variant="destructive" className="text-xs">Processo ativo</Badge>
                          ) : null;
                        },
                      },
                    ]}
                    onRowClick={setFeedbackItem}
                    rowClassName={(r) =>
                      r.document && bqProcessoDocsSet.has(normalizeDoc(r.document))
                        ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30"
                        : ""
                    }
                  />}
                  <ClientGroupedItems
                    items={items}
                    legalDocsSet={bqProcessoDocsSet}
                    onItemClick={setFeedbackItem}
                  />
                </div>
              );
            })()}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button
                onClick={async () => {
                  try {
                    await updateSyncStatusForItems(legalItemIds, "processo_juridico");
                    queryClient.invalidateQueries({ queryKey: ["batch-items", batch.id] });
                  } catch (err) {
                    toast.warning(err instanceof ApiError
                      ? `${err.message} Seguindo para a proxima etapa.`
                      : "Erro ao atualizar status de processos jurídicos. Seguindo para a próxima etapa.");
                  } finally {
                    setStep(3);
                  }
                }}
              >
                Próximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Tratativas Internas */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Tratativas Internas
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Títulos do processo</p>
                <p className="text-2xl font-semibold">{totalTitulos}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-muted-foreground">Em tratativa interna</p>
                <p className="text-2xl font-semibold text-amber-700">{titulosTratativa}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Títulos elegíveis após filtros</p>
                <p className="text-2xl font-semibold">{gruposDistribuicao.length}</p>
              </div>
            </div>
            {itemsLoading || internalHandlingLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : internalItems.length === 0 ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                Nenhum item com flag de tratativa interna. Pode prosseguir.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {internalItems.length} {internalItems.length === 1 ? "item possui" : "itens possuem"} tratativa interna.
                  Clique em um item para registrar feedback.
                </p>
                <ClientGroupedItems
                  items={internalItems}
                  internalDocsSet={internalHandlingDocsSet}
                  onItemClick={setFeedbackItem}
                />
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button
                onClick={async () => {
                  try {
                    await updateSyncStatusForItems(internalItemIds, "tratativa_interna");
                    queryClient.invalidateQueries({ queryKey: ["batch-items", batch.id] });
                  } catch (err) {
                    toast.warning(err instanceof ApiError
                      ? `${err.message} Seguindo para a proxima etapa.`
                      : "Erro ao atualizar status de tratativas internas. Seguindo para a proxima etapa.");
                  } finally {
                    setStep(4);
                  }
                }}
              >
                Próximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Distribuição */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />Distribuição
            </h3>
            <p className="text-sm text-muted-foreground">
              Selecione os colaboradores que participarão da distribuição dos {gruposDistribuicao.length} títulos elegíveis.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Títulos elegíveis para distribuição</p>
              <ClientGroupedItems items={elegiveisDistribuicao} />
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
                        colaboradoresDisponiveis.map((u) => {
                          const active = availableFocusedUserId === u.userId;
                          return (
                            <button
                              key={u.userId}
                              type="button"
                              className={cn(
                                "flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40",
                                active && "bg-muted",
                              )}
                              onClick={() => setAvailableFocusedUserId(u.userId)}
                            >
                              <span>{u.fullName}</span>
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
                          disabled={!selectedFocusedUserId || selectedUserIds.indexOf(selectedFocusedUserId) === -1 || selectedUserIds.indexOf(selectedFocusedUserId) >= selectedUserIds.length - 1}
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
                        colaboradoresSelecionados.map((u, index) => {
                          const active = selectedFocusedUserId === u.userId;
                          return (
                            <button
                              key={u.userId}
                              type="button"
                              className={cn(
                                "flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40",
                                active && "bg-muted",
                              )}
                              onClick={() => setSelectedFocusedUserId(u.userId)}
                            >
                              <span>{u.fullName}</span>
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
                  onClick={() => setShowDistributionPreview((v) => !v)}
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
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              <Button
                disabled={assignMutation.isPending || planoDistribuicao.length === 0 || gruposDistribuicao.length === 0}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? "Distribuindo..." : "Concluir e distribuir"}
              </Button>
            </div>
          </div>
        )}

        </div>
        {/* Item feedback dialog (within wizard) */}
        {feedbackItem && (
          <ItemFeedbackDialog
            item={feedbackItem}
            batchId={batch.id}
            onClose={() => setFeedbackItem(null)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProcessOverviewSheet({ batch, onClose }: { batch: ChargeBatch; onClose: () => void }) {
  const { data: items = [], isLoading: itemsLoading } = useQuery<ChargeItem[]>({
    queryKey: ["batch-items", batch.id],
    queryFn: () => api.get<ChargeItem[]>(`/charges/items?batchId=${batch.id}`),
    staleTime: 1000 * 30,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
    staleTime: 1000 * 60 * 5,
  });

  const userNameById = useMemo(
    () => {
      const map = new Map<string, string>();
      for (const user of users) {
        map.set(user.userId, user.fullName);
        map.set(user.id, user.fullName);
      }
      return map;
    },
    [users],
  );

  const distributedItems = useMemo(
    () => items.filter((item) => Boolean(item.assigned_to_user_id)),
    [items],
  );
  const totalItems = distributedItems.length;
  const juridicos = items.filter((item) => item.legal_process_flag).length;
  const tratativas = items.filter((item) => item.internal_handling_flag).length;
  const assignedGroups = Array.from(
    distributedItems.reduce((map, item) => {
      const assignedId = item.assigned_to_user_id;
      if (!assignedId) {
        return map;
      }
      const current = map.get(assignedId) ?? 0;
      map.set(assignedId, current + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([userId, count]) => ({
    userId,
    count,
    fullName: userNameById.get(userId) ?? "Colaborador não encontrado",
  }));

  const statusGroups = Array.from(
    distributedItems.reduce((map, item) => {
      const key = item.status ?? "pendente";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  );

  const columns: Column<ChargeItem>[] = [
    { key: "client", header: "Cliente", accessor: (row) => row.client_name ?? "—" },
    { key: "document", header: "Documento", accessor: (row) => row.document ?? "—" },
    { key: "enterprise", header: "Empreendimento", accessor: (row) => row.enterprise_name ?? "—" },
    {
      key: "assigned",
      header: "Colaborador responsavel",
      accessor: (row) => (row.assigned_to_user_id ? (userNameById.get(row.assigned_to_user_id) ?? "Colaborador não encontrado") : "Não atribuído"),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant="outline">{ITEM_STATUS_LABEL[row.status] ?? row.status}</Badge>,
    },
    {
      key: "flags",
      header: "Flags",
      render: (row) => (
        <div className="flex gap-1">
          {row.legal_process_flag && <Badge variant="outline" className="text-xs">JUR</Badge>}
          {row.internal_handling_flag && <Badge variant="destructive" className="text-xs">TI</Badge>}
        </div>
      ),
    },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[90vw] sm:max-w-6xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Processo {batch.batch_code}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Itens distribuídos</p>
              <p className="text-2xl font-semibold">{totalItems}</p>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-muted-foreground">Processos jurídicos</p>
              <p className="text-2xl font-semibold text-red-700">{juridicos}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-muted-foreground">Tratativas internas</p>
              <p className="text-2xl font-semibold text-amber-700">{tratativas}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Colaboradores com itens</p>
              <p className="text-2xl font-semibold">{assignedGroups.length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">Distribuição por colaborador</p>
              {assignedGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item distribuído.</p>
              ) : (
                <div className="space-y-2">
                  {assignedGroups.map((group) => (
                    <div key={group.userId} className="flex items-center justify-between">
                      <span>{group.fullName}</span>
                      <Badge variant="secondary">{group.count} item(ns)</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">Situação dos itens</p>
              {statusGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item distribuído.</p>
              ) : (
                <div className="space-y-2">
                  {statusGroups.map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span>{ITEM_STATUS_LABEL[status] ?? status}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Itens distribuídos do processo</p>
            {itemsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <DataTable data={distributedItems} columns={columns} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Mini tabela de itens dentro do wizard ────────────────────────────────────

function ItemMiniTable({ items, onItemClick }: { items: ChargeItem[]; onItemClick: (i: ChargeItem) => void }) {
  const columns: Column<ChargeItem>[] = [
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    {
      key: "amount",
      header: "Valor",
      render: (r) =>
        r.amount != null
          ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant="secondary">{ITEM_STATUS_LABEL[r.status] ?? r.status}</Badge>
      ),
    },
  ];

  return <DataTable data={items} columns={columns} onRowClick={onItemClick} />;
}

// ─── Dialog de feedback do item (usado dentro do wizard) ─────────────────────

function ItemFeedbackDialog({
  item,
  batchId,
  onClose,
}: {
  item: ChargeItem;
  batchId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<string>(item.status);
  const [categoryKey, setCategoryKey] = useState(item.feedback_category_key ?? "");
  const [notes, setNotes] = useState(item.feedback_notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/charges/items/${item.id}/feedback`, {
        status,
        ...(categoryKey ? { feedbackCategoryKey: categoryKey } : {}),
        ...(notes.trim() ? { feedbackNotes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-items", batchId] });
      toast.success("Feedback registrado!");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao salvar feedback."),
  });

  const huggyMutation = useMutation({
    mutationFn: () => api.post<{ sent: boolean; template: string }>(`/charges/items/${item.id}/huggy`, {}),
    onSuccess: (res) => toast.success(`Huggy disparado! Template: ${res.template}`),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao disparar Huggy."),
  });

  const emailMutation = useMutation({
    mutationFn: () => api.post<{ sent: boolean }>(`/charges/items/${item.id}/email`, {}),
    onSuccess: () => toast.success("E-mail disparado!"),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao enviar e-mail."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback — {item.bill_id}</DialogTitle>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={huggyMutation.isPending} onClick={() => huggyMutation.mutate()}>
              <MessageCircle className="mr-1 h-4 w-4" />{huggyMutation.isPending ? "Enviando..." : "Huggy"}
            </Button>
            <Button size="sm" variant="outline" disabled={emailMutation.isPending} onClick={() => emailMutation.mutate()}>
              <Mail className="mr-1 h-4 w-4" />{emailMutation.isPending ? "Enviando..." : "E-mail"}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="font-medium">{item.client_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Documento</p>
              <p>{item.document ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Vencimento</p>
              <p>{item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor</p>
              <p>{item.amount != null ? item.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p>
            </div>
          </div>

          <hr />

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="sem_retorno">Sem retorno</SelectItem>
                <SelectItem value="em_atendimento">Em atendimento</SelectItem>
                <SelectItem value="ciente_sem_retorno">Ciente s/ retorno</SelectItem>
                <SelectItem value="em_negociacao">Em negociação</SelectItem>
                <SelectItem value="acordo">Acordo</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Categoria (opcional)</Label>
            <Input placeholder="Ex: ligacao, e-mail, visita" value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea rows={3} placeholder="Detalhes do contato..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : "Salvar feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
