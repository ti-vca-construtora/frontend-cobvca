import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
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
  LayoutList, LayoutGrid, Plus, ChevronRight, Check,
  PlayCircle, Users, AlertTriangle, Gavel, MessageCircle, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/cobranca/meus-processos")({ component: MeusProcessosPage });

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChargeBatch {
  id: string;
  batch_code: string;
  source_view: string;
  filters_applied: Record<string, unknown>;
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
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
  status: "pendente" | "sem_retorno" | "em_atendimento" | "ciente_sem_retorno" | "em_negociacao" | "acordo" | "pago";
  feedback_category_key: string | null;
  feedback_notes: string | null;
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

interface BqProcesso {
  documento: string | null;
  cliente: string | null;
  situacao: string | null;
  tipoProcesso: string | null;
  numero: string | null;
  nomeEmpreendimento: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluido",
  cancelado: "Cancelado",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  sem_retorno: "Sem retorno",
  em_atendimento: "Em atendimento",
  ciente_sem_retorno: "Ciente s/ retorno",
  em_negociacao: "Em negociacao",
  acordo: "Acordo",
  pago: "Pago",
};

const WIZARD_STEPS = ["Resumo", "Processos Juridicos", "Tratativas Internas", "Distribuicao"] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

function MeusProcessosPage() {
  const [view, setView] = useState<"table" | "cards">("table");
  const [busca, setBusca] = useState("");
  const [iniciarBatch, setIniciarBatch] = useState<ChargeBatch | null>(null);

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
        descricao="Processos de cobranca em andamento"
        acoes={
          <div className="flex items-center gap-2">
            <Button
              variant={view === "table" ? "default" : "outline"}
              size="icon"
              title="Visualizacao em tabela"
              onClick={() => setView("table")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "cards" ? "default" : "outline"}
              size="icon"
              title="Visualizacao em cards"
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
        <BatchTable batches={filtrados} onIniciar={setIniciarBatch} />
      ) : (
        <BatchCards batches={filtrados} onIniciar={setIniciarBatch} />
      )}

      {iniciarBatch && (
        <IniciarWizard batch={iniciarBatch} onClose={() => setIniciarBatch(null)} />
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

function BatchTable({ batches, onIniciar }: { batches: ChargeBatch[]; onIniciar: (b: ChargeBatch) => void }) {
  const columns: Column<ChargeBatch>[] = [
    { key: "batch_code", header: "Codigo", accessor: (r) => r.batch_code },
    {
      key: "status",
      header: "Status",
      render: (r) => <BatchStatusBadge status={r.status} />,
    },
    {
      key: "source",
      header: "Fonte",
      accessor: (r) => r.source_view === "vw_cob_contasreceber" ? "Contas a Receber" : "Contas Recebidas",
    },
    {
      key: "created_at",
      header: "Criado em",
      accessor: (r) => new Date(r.created_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        (r.status === "pendente" || r.status === "em_andamento") ? (
          <Button
            size="sm"
            variant={r.status === "em_andamento" ? "outline" : "default"}
            onClick={(e) => { e.stopPropagation(); onIniciar(r); }}
          >
            <PlayCircle className="mr-1 h-4 w-4" />
            {r.status === "pendente" ? "Iniciar" : "Continuar"}
          </Button>
        ) : null,
    },
  ];

  return <DataTable data={batches} columns={columns} />;
}

// ─── Batch cards view ─────────────────────────────────────────────────────────

function BatchCards({ batches, onIniciar }: { batches: ChargeBatch[]; onIniciar: (b: ChargeBatch) => void }) {
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
              {b.source_view === "vw_cob_contasreceber" ? "Contas a Receber" : "Contas Recebidas"}
            </p>
            <p className="text-muted-foreground text-xs">
              Criado em {new Date(b.created_at).toLocaleDateString("pt-BR")}
            </p>
          </CardContent>
          {(b.status === "pendente" || b.status === "em_andamento") && (
            <CardFooter>
              <Button
                size="sm"
                className="w-full"
                variant={b.status === "em_andamento" ? "outline" : "default"}
                onClick={() => onIniciar(b)}
              >
                <PlayCircle className="mr-1 h-4 w-4" />
                {b.status === "pendente" ? "Iniciar" : "Continuar"}
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
  const [selectedUserId, setSelectedUserId] = useState("");
  const [feedbackItem, setFeedbackItem] = useState<ChargeItem | null>(null);

  const { data: items = [], isLoading: itemsLoading } = useQuery<ChargeItem[]>({
    queryKey: ["batch-items", batch.id],
    queryFn: () => api.get<ChargeItem[]>(`/charges/items?batchId=${batch.id}`),
  });

  const { data: bqProcessos = [], isLoading: processosBqLoading } = useQuery<BqProcesso[]>({
    queryKey: ["bq-processos-juridicos"],
    queryFn: () => api.get<BqProcesso[]>("/bq/processos-juridicos"),
    enabled: step === 2,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Set of normalized documents that are already in legal process in BQ
  const normalizeDoc = (s: string) => s.replace(/\D/g, "");
  const bqProcessoDocsSet = new Set(
    bqProcessos.map((p) => normalizeDoc(p.documento ?? "")).filter(Boolean),
  );

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
    enabled: step === 4,
  });

  const startMutation = useMutation({
    mutationFn: () => api.patch(`/charges/${batch.id}/status`, { status: "em_andamento" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      setStep(2);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao iniciar processo."),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      api.patch("/charges/items/assign", { batchId: batch.id, assignedToUserId: selectedUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-batches"] });
      queryClient.invalidateQueries({ queryKey: ["batch-items", batch.id] });
      toast.success("Itens distribuidos com sucesso!");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao distribuir itens."),
  });

  const legalItems = items.filter((i) => i.legal_process_flag);
  const internalItems = items.filter((i) => i.internal_handling_flag);
  const cobradores = users.filter((u) => u.role === "cobrador" || u.role === "supervisor" || u.role === "administrador");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>Iniciar Processo — {batch.batch_code}</SheetTitle>
        </SheetHeader>

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
                <span className="text-muted-foreground">Codigo</span>
                <span className="font-medium">{batch.batch_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fonte</span>
                <span>{batch.source_view === "vw_cob_contasreceber" ? "Contas a Receber" : "Contas Recebidas"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{new Date(batch.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {!itemsLoading && legalItems.length > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Processos juridicos</span>
                  <span className="font-medium">{legalItems.length}</span>
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
                Titulos do processo {itemsLoading ? "" : `(${items.length})`}
              </p>
              {itemsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum titulo encontrado.</p>
              ) : (
                <div className="rounded-md border divide-y text-sm">
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
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              {batch.status === "pendente" ? (
                <Button disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                  {startMutation.isPending ? "Iniciando..." : "Iniciar processo"}
                </Button>
              ) : (
                <Button onClick={() => setStep(2)}>Continuar</Button>
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

            {itemsLoading || processosBqLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (() => {
              const blockedCount = items.filter(
                (i) => i.document && bqProcessoDocsSet.has(normalizeDoc(i.document)),
              ).length;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Todos os {items.length} itens do processo. Linhas em vermelho ja possuem processo juridico ativo no ERP e <strong>nao serao cobrados</strong>.
                    </p>
                    {blockedCount > 0 && (
                      <Badge variant="destructive" className="shrink-0 ml-2">
                        {blockedCount} bloqueado{blockedCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <DataTable
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
                  />
                </div>
              );
            })()}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)}>
                Proximo <ChevronRight className="ml-1 h-4 w-4" />
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
            {itemsLoading ? (
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
                <ItemMiniTable items={internalItems} onItemClick={setFeedbackItem} />
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => setStep(4)}>
                Proximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Distribuicao */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />Distribuicao
            </h3>
            <p className="text-sm text-muted-foreground">
              Atribua todos os {items.length} itens do processo a um cobrador.
            </p>
            <div className="space-y-1">
              <Label>Cobrador responsavel</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {cobradores.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.fullName} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              <Button
                disabled={!selectedUserId || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? "Distribuindo..." : "Concluir e distribuir"}
              </Button>
            </div>
          </div>
        )}

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
                <SelectItem value="em_negociacao">Em negociacao</SelectItem>
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
            <Label>Observacoes</Label>
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