import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/cobranca/meus-processos")({ component: MeusProcessosPage });

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
  status: "pendente" | "sem_retorno" | "em_atendimento" | "ciente_sem_retorno" | "em_negociacao" | "acordo" | "pago";
  feedback_category_key: string | null;
  feedback_notes: string | null;
  internal_handling_flag: boolean;
  legal_process_flag: boolean;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function MeusProcessosPage() {
  return (
    <ProtectedRoute perfis={["administrador", "supervisor", "cobrador"]}>
      <PageHeader titulo="Meus Processos" descricao="Processos atribuídos a você" />
      <Lista />
    </ProtectedRoute>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  sem_retorno: "Sem retorno",
  em_atendimento: "Em atendimento",
  ciente_sem_retorno: "Ciente s/ retorno",
  em_negociacao: "Em negociação",
  acordo: "Acordo",
  pago: "Pago",
};

function Lista() {
  const { usuario } = useAuth();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ChargeItem | null>(null);

  const { data: items, isLoading } = useQuery<ChargeItem[]>({
    queryKey: ["meus-processos", usuario?.userId],
    queryFn: () =>
      usuario?.perfil === "cobrador"
        ? api.get<ChargeItem[]>(`/charges/items?assignedToUserId=${usuario.userId}`)
        : api.get<ChargeItem[]>("/charges/items"),
    enabled: !!usuario,
  });

  const filtrados = (items ?? []).filter((item) => {
    if (!busca) return true;
    const t = `${item.client_name ?? ""} ${item.document ?? ""} ${item.enterprise_name ?? ""}`.toLowerCase();
    return t.includes(busca.toLowerCase());
  });

  const colunas: Column<ChargeItem>[] = [
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    {
      key: "amount", header: "Valor",
      render: (r) => r.amount != null ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
    },
    { key: "days", header: "Dias vencidos", accessor: (r) => r.days_overdue ?? 0, sortable: true },
    {
      key: "status", header: "Status",
      render: (r) => (
        <Badge variant={r.status === "pago" ? "default" : r.status === "pendente" ? "secondary" : "outline"}>
          {STATUS_LABEL[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "flags", header: "",
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
      <div className="space-y-2">
        <Skeleton className="h-8 w-72 mb-4" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por cliente, documento ou empreendimento"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <DataTable data={filtrados} columns={colunas} onRowClick={setAberto} />
      {aberto && <ItemSheet item={aberto} onClose={() => setAberto(null)} />}
    </>
  );
}

// ─── Sheet de detalhe + feedback ─────────────────────────────────────────────

function ItemSheet({ item, onClose }: { item: ChargeItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();

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
      queryClient.invalidateQueries({ queryKey: ["meus-processos", usuario?.userId] });
      toast.success("Feedback registrado!");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar feedback.");
    },
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
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Processo — {item.bill_id}</SheetTitle>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={huggyMutation.isPending}
              onClick={() => huggyMutation.mutate()}
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              {huggyMutation.isPending ? "Enviando…" : "Huggy"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={emailMutation.isPending}
              onClick={() => emailMutation.mutate()}
            >
              <Mail className="mr-1 h-4 w-4" />
              {emailMutation.isPending ? "Enviando…" : "E-mail"}
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Cliente</p>
            <p className="font-medium">{item.client_name ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Documento</p>
            <p>{item.document ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Empreendimento</p>
            <p>{item.enterprise_name ?? "—"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Vencimento</p>
              <p>{item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Valor</p>
              <p>{item.amount != null ? item.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {item.internal_handling_flag && <Badge variant="destructive">Tratativa Interna</Badge>}
            {item.legal_process_flag && <Badge variant="outline">Processo Jurídico</Badge>}
          </div>

          <hr />

          <p className="font-semibold">Registrar feedback</p>
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
            <Input
              placeholder="Ex: ligação, e-mail, visita"
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              placeholder="Detalhes do contato…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando…" : "Salvar feedback"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
