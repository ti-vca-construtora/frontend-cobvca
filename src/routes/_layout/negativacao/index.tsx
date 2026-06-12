import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Users, GitCompare, Upload, Gavel, ChevronDown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/negativacao/")({ component: NegativacaoPage });

// ─── Types ───────────────────────────────────────────────────────────────────

interface NegativationBatch {
  id: string;
  batch_code: string;
  source_view: string;
  status: string;
  created_at: string;
}

interface NegativationItem {
  id: string;
  batch_id: string;
  process_id: string;
  document: string | null;
  client_name: string | null;
  enterprise_name: string | null;
  status: "pendente" | "pronto_exportacao" | "exportado" | "retirada_pendente" | "retirado";
  internal_handling_flag: boolean;
  legal_process_flag: boolean;
}

interface Enterprise {
  id: string;
  cost_center_name: string;
  status: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function NegativacaoPage() {
  const queryClient = useQueryClient();
  const innoveInputRef = useRef<HTMLInputElement>(null);

  const batimentoMutation = useMutation({
    mutationFn: () => api.post<{ matched: number; total: number }>("/negativations/batimento", {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["negativation-batches"] });
      queryClient.invalidateQueries({ queryKey: ["negativation-items"] });
      toast.success(`Batimento concluído: ${res.matched} retira(s) pendente(s) de ${res.total} exportados.`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao executar batimento.");
    },
  });

  const innoveImportMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post<{ imported: number; skipped: number }>("/negativations/import-innove", fd);
    },
    onSuccess: (res) => toast.success(`Innove importado: ${res.imported} novos, ${res.skipped} ignorados.`),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao importar Innove."),
  });

  function handleInnoveFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) innoveImportMutation.mutate(file);
    e.target.value = "";
  }

  return (
    <ProtectedRoute perfis={["administrador", "negativador"]}>
      <PageHeader
        titulo="Negativação"
        descricao="Criação e acompanhamento de processos de negativação"
        acoes={
          <div className="flex gap-2">
            <input
              ref={innoveInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleInnoveFile}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={innoveImportMutation.isPending}
              onClick={() => innoveInputRef.current?.click()}
            >
              <Upload className="mr-1 h-4 w-4" />
              {innoveImportMutation.isPending ? "Importando…" : "Importar Innove"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={batimentoMutation.isPending}
              onClick={() => batimentoMutation.mutate()}
            >
              <GitCompare className="mr-1 h-4 w-4" />
              {batimentoMutation.isPending ? "Executando…" : "Batimento"}
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/negativacao/retiradas">Ver Retiradas</Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <CriarBatchForm />
        <ListaBatches />
      </div>
    </ProtectedRoute>
  );
}

// ─── Formulário criar batch ───────────────────────────────────────────────────

function CriarBatchForm() {
  const queryClient = useQueryClient();
  const [selectedEnterpriseIds, setSelectedEnterpriseIds] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ batch: NegativationBatch; insertedItems: number }>("/negativations", {
        source: "contas-receber",
        option: "negativation",
        ...(selectedEnterpriseIds.length > 0 ? { enterpriseIds: selectedEnterpriseIds } : {}),
      }),
    onSuccess: (res: { batch: NegativationBatch; insertedItems: number }) => {
      queryClient.invalidateQueries({ queryKey: ["negativation-batches"] });
      toast.success(`Batch ${res.batch.batch_code} criado — ${res.insertedItems} itens`);
      setSelectedEnterpriseIds([]);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar processo.");
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="font-semibold">Criar processo</h2>

        <div className="hidden">
          <Label>Opção</Label>
          <div className="hidden">
            {null}
          </div>
        </div>

        <div className="hidden">
          <Label>Filtrar cliente</Label>
          <Input placeholder="Nome ou CPF/CNPJ" value="" onChange={() => undefined} />
        </div>

        <div className="max-w-md space-y-1">
          <EnterprisesMultiSelect selected={selectedEnterpriseIds} onChange={setSelectedEnterpriseIds} />
        </div>

        <div className="hidden">
          <Label>Limite de registros</Label>
          <Input type="number" min={1} max={1000} placeholder="Ex: 200" value="" onChange={() => undefined} />
        </div>

        <div className="hidden">
          {null}
          <Label htmlFor="s1-neg" className="cursor-pointer">Aplicar filtro S1</Label>
        </div>

        <div className="hidden">
          {null}
          <Label htmlFor="cronograma-neg" className="cursor-pointer">Aplicar cronograma</Label>
        </div>

        <Button
          className="w-full sm:w-auto"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Criando…" : "Criar processo"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Lista de batches ─────────────────────────────────────────────────────────

function EnterprisesMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const { data: list = [] } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
    staleTime: 1000 * 60 * 5,
  });

  const active = list.filter((enterprise) => enterprise.status === "ativo");
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);

  const label =
    selected.length === 0
      ? "Todos os empreendimentos"
      : selected.length === 1
        ? (active.find((enterprise) => enterprise.id === selected[0])?.cost_center_name ?? "1 selecionado")
        : `${selected.length} selecionados`;

  return (
    <div className="space-y-1">
      <Label>Filtrar empreendimento</Label>
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
              {active.map((enterprise) => (
                <div
                  key={enterprise.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted"
                  onClick={() => toggle(enterprise.id)}
                >
                  <Checkbox checked={selected.includes(enterprise.id)} onCheckedChange={() => toggle(enterprise.id)} />
                  <span className="text-sm">{enterprise.cost_center_name}</span>
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

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "secondary",
  processando: "outline",
  concluido: "default",
  erro: "destructive",
};

function ListaBatches() {
  const [batchAberto, setBatchAberto] = useState<NegativationBatch | null>(null);
  const [classifBatch, setClassifBatch] = useState<NegativationBatch | null>(null);

  const { data: batches, isLoading } = useQuery<NegativationBatch[]>({
    queryKey: ["negativation-batches"],
    queryFn: () => api.get<NegativationBatch[]>("/negativations"),
  });

  const colunas: Column<NegativationBatch>[] = [
    { key: "code", header: "Código", accessor: (r) => r.batch_code },
    {
      key: "source", header: "Fonte",
      render: (r) => (r.source_view ?? "contas-receber").includes("recebidas") ? "Contas Recebidas" : "Contas a Receber",
    },
    {
      key: "status", header: "Status",
      render: (r) => (
        <Badge variant={STATUS_BADGE[r.status] ?? "outline"}>{r.status}</Badge>
      ),
    },
    {
      key: "created_at", header: "Criado em",
      render: (r) => new Date(r.created_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "juridico", header: "",
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          title="Classificar Jurídico"
          onClick={(e) => { e.stopPropagation(); setClassifBatch(r); }}
        >
          <Gavel className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 mb-4" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <h2 className="font-semibold mb-4">Processos criados</h2>
      <DataTable data={batches ?? []} columns={colunas} onRowClick={setBatchAberto} />
      {batchAberto && (
        <BatchItemsSheet batch={batchAberto} onClose={() => setBatchAberto(null)} />
      )}
      {classifBatch && (
        <ClassificacaoJuridicoDialog batch={classifBatch} onClose={() => setClassifBatch(null)} />
      )}
    </>
  );
}

// ─── Sheet de itens do batch ──────────────────────────────────────────────────

function BatchItemsSheet({ batch, onClose }: { batch: NegativationBatch; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [associadosItem, setAssociadosItem] = useState<NegativationItem | null>(null);
  const [reservaInput, setReservaInput] = useState("");

  const { data: items, isLoading } = useQuery<NegativationItem[]>({
    queryKey: ["negativation-items", batch.id],
    queryFn: () => api.get<NegativationItem[]>(`/negativations/items?batchId=${batch.id}`),
  });

  const sinalizarCvMutation = useMutation({
    mutationFn: () =>
      api.post<{ processed: number; success: number; errors: { document: string; message?: string }[] }>(
        `/negativations/${batch.id}/sinalizar-cv`
      ),
    onSuccess: (res) => {
      toast.success(`Sinalização concluída: ${res.success}/${res.processed} atualizados no CV.`);
      if (res.errors.length > 0) toast.warning(`${res.errors.length} erro(s) — verifique as credenciais do CV.`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao sinalizar no CV."),
  });

  const sinalizadorJuridicoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      api.patch(`/negativations/items/${id}/sinalizador-juridico`, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negativation-items", batch.id] });
      toast.success("Sinalizador jurídico atualizado no CV.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar sinalizador jurídico."),
  });

  const filtrados = (items ?? []).filter((item) => {
    if (!busca) return true;
    const t = `${item.client_name ?? ""} ${item.document ?? ""} ${item.enterprise_name ?? ""}`.toLowerCase();
    return t.includes(busca.toLowerCase());
  });

  const STATUS_ITEM: Record<string, string> = {
    pendente: "Pendente",
    pronto_exportacao: "Pronto p/ exportação",
    exportado: "Exportado",
    retirada_pendente: "Retirada pendente",
    retirado: "Retirado",
  };

  const colunas: Column<NegativationItem>[] = [
    { key: "process_id", header: "ID", accessor: (r) => r.process_id },
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    {
      key: "status", header: "Status",
      render: (r) => (
        <Badge variant={
          r.status === "exportado" ? "default" :
          r.status === "retirada_pendente" ? "destructive" :
          r.status === "retirado" ? "outline" :
          r.status === "pendente" ? "secondary" : "outline"
        }>
          {STATUS_ITEM[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "juridico", header: "Jur.",
      render: (r) => (
        <Switch
          checked={r.legal_process_flag}
          disabled={sinalizadorJuridicoMutation.isPending}
          onCheckedChange={(checked) => sinalizadorJuridicoMutation.mutate({ id: r.id, ativo: checked })}
          title="Sinalizador jurídico no CV"
        />
      ),
    },
    {
      key: "flags", header: "",
      render: (r) => (
        <div className="flex gap-1 items-center">
          {r.internal_handling_flag && <Badge variant="destructive" className="text-xs">TI</Badge>}
          <Button
            size="sm" variant="ghost" className="h-7 px-2"
            title="Ver cônjuge / avalistas"
            onClick={() => { setAssociadosItem(r); setReservaInput(""); }}
          >
            <Users className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-[760px] sm:max-w-[760px] overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between pr-6">
            <SheetTitle>Itens — {batch.batch_code}</SheetTitle>
            <Button
              size="sm" variant="outline"
              onClick={() => sinalizarCvMutation.mutate()}
              disabled={sinalizarCvMutation.isPending}
            >
              <Briefcase className={`h-4 w-4 mr-2 ${sinalizarCvMutation.isPending ? "animate-pulse" : ""}`} />
              {sinalizarCvMutation.isPending ? "Sinalizando…" : "Sinalizar CV"}
            </Button>
          </SheetHeader>
          <div className="mt-4 mb-3">
            <Input
              placeholder="Buscar por cliente, documento ou empreendimento"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <DataTable data={filtrados} columns={colunas} />
          )}
        </SheetContent>
      </Sheet>

      {associadosItem && (
        <AssociadosDialog
          item={associadosItem}
          reservaId={reservaInput}
          onReservaChange={setReservaInput}
          onClose={() => setAssociadosItem(null)}
        />
      )}
    </>
  );
}

// ─── Dialog Visualização de Associados ───────────────────────────────────────

interface Associado {
  nome?: string;
  cpf?: string;
  tipo?: string;
  [key: string]: unknown;
}

function AssociadosDialog({
  item, reservaId, onReservaChange, onClose,
}: {
  item: NegativationItem;
  reservaId: string;
  onReservaChange: (v: string) => void;
  onClose: () => void;
}) {
  const { data: associados, isLoading, isError, refetch } = useQuery<Associado[]>({
    queryKey: ["associados", reservaId],
    queryFn: () => api.get<Associado[]>(`/cv/associados/${reservaId}`),
    enabled: false,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Associados — {item.client_name ?? item.document}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Informe o ID da reserva no CV para consultar cônjuge e avalistas.
        </p>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="ID da reserva (ex: 11205)"
            value={reservaId}
            onChange={(e) => onReservaChange(e.target.value)}
          />
          <Button onClick={() => refetch()} disabled={!reservaId.trim() || isLoading}>
            {isLoading ? "Buscando…" : "Buscar"}
          </Button>
        </div>
        {isError && (
          <p className="text-sm text-destructive mt-2">Erro ao consultar CV. Verifique o ID da reserva e as credenciais.</p>
        )}
        {associados && associados.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">Nenhum associado encontrado para esta reserva.</p>
        )}
        {associados && associados.length > 0 && (
          <div className="mt-3 space-y-2">
            {associados.map((a, i) => (
              <div key={i} className="border rounded p-3 text-sm space-y-1">
                {a.nome && <p><span className="font-medium">Nome:</span> {a.nome}</p>}
                {a.cpf && <p><span className="font-medium">CPF:</span> {a.cpf}</p>}
                {a.tipo && <p><span className="font-medium">Tipo:</span> {a.tipo}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog Classificação Jurídico ───────────────────────────────────────────

interface ClassifItem {
  id: string;
  process_id: string;
  document: string | null;
  client_name: string | null;
  amount: number | null;
  classificacao: "distrato" | "cobrança" | "extrajudicial";
}

interface ClassifResult {
  items: ClassifItem[];
  resumo: { distrato: number; cobranca: number; extrajudicial: number };
}

function ClassificacaoJuridicoDialog({ batch, onClose }: { batch: NegativationBatch; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<ClassifResult>({
    queryKey: ["classif-juridico", batch.id],
    queryFn: () => api.post<ClassifResult>(`/negativations/${batch.id}/classificar-juridico`, {}),
  });

  const CLASSIF_COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    distrato: "destructive",
    "cobrança": "default",
    extrajudicial: "secondary",
  };

  const colunas: Column<ClassifItem>[] = [
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    {
      key: "amount", header: "Saldo",
      accessor: (r) => r.amount != null ? `R$ ${r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
    },
    {
      key: "classif", header: "Classificação",
      render: (r) => (
        <Badge variant={CLASSIF_COLOR[r.classificacao] ?? "outline"}>{r.classificacao}</Badge>
      ),
    },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Classificação Jurídica — {batch.batch_code}</DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {isError && (
          <p className="text-sm text-destructive py-4">Erro ao classificar itens do lote.</p>
        )}
        {data && (
          <>
            <div className="flex gap-4 py-3 border-b">
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{data.resumo.distrato}</p>
                <p className="text-xs text-muted-foreground">Distrato</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.resumo.cobranca}</p>
                <p className="text-xs text-muted-foreground">Cobrança</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{data.resumo.extrajudicial}</p>
                <p className="text-xs text-muted-foreground">Extrajudicial</p>
              </div>
            </div>
            <DataTable data={data.items} columns={colunas} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
