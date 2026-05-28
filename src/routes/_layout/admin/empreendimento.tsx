import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/admin/empreendimento")({ component: EmpreendimentoPage });

// ─── Types ───────────────────────────────────────────────────────────────────

interface Enterprise {
  id: string;
  cost_center_source: string;
  cost_center_id: string;
  enterprise_type: "lote" | "habitacao" | null;
  status: "ativo" | "inativo";
  is_multiplique: boolean;
}

interface SyncLog {
  id: string;
  executed_at: string;
  scanned: number;
  inserted: number;
  duration_ms: number;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function EmpreendimentoPage() {
  return (
    <ProtectedRoute perfis={["administrador", "supervisor"]}>
      <Conteudo />
    </ProtectedRoute>
  );
}

// ─── Conteudo ─────────────────────────────────────────────────────────────────

function Conteudo() {
  const queryClient = useQueryClient();

  const { data: enterprises, isLoading, isError } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
  });

  const { data: syncLog } = useQuery<SyncLog[]>({
    queryKey: ["sync-log"],
    queryFn: () => api.get<SyncLog[]>("/bq/sync-log"),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<{ scanned: number; inserted: number }>("/bq/update-enterprises"),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["enterprises"] });
      queryClient.invalidateQueries({ queryKey: ["sync-log"] });
      toast.success(`Sincronização concluída: ${result.inserted} novo(s) de ${result.scanned} escaneados.`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao sincronizar empreendimentos.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { enterpriseType?: string; status?: string } }) =>
      api.patch(`/enterprises/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprises"] });
      toast.success("Empreendimento atualizado!");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar.");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (isError || !enterprises) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar os empreendimentos. Verifique a conexão com a API.
      </p>
    );
  }

  const semTipo = enterprises.filter((e) => !e.enterprise_type).length;

  const colunas: Column<Enterprise>[] = [
    {
      key: "nome",
      header: "Empreendimento",
      sortable: true,
      accessor: (r) => `${r.cost_center_source} — ${r.cost_center_id}`,
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.enterprise_type
            ? <Badge variant="secondary">{r.enterprise_type}</Badge>
            : <Badge variant="destructive">Sem tipo</Badge>}
          <Select
            value={r.enterprise_type ?? ""}
            onValueChange={(v) => updateMutation.mutate({ id: r.id, payload: { enterpriseType: v } })}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Definir…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lote">Lote</SelectItem>
              <SelectItem value="habitacao">Habitação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Select
          value={r.status}
          onValueChange={(v) => updateMutation.mutate({ id: r.id, payload: { status: v } })}
        >
          <SelectTrigger className="h-8 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "multiplique",
      header: "Multiplique",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={r.is_multiplique}
            onCheckedChange={(v) => updateMutation.mutate({ id: r.id, payload: { isMultiplique: v } })}
          />
          {r.is_multiplique && <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">Multiplique</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Empreendimentos"
        descricao="Categorize os empreendimentos como Lote ou Habitação"
        acoes={
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando…" : "Sincronizar do BigQuery"}
          </Button>
        }
      />
      {semTipo > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{semTipo} empreendimento(s) sem tipo definido</AlertTitle>
          <AlertDescription>Defina o tipo abaixo para liberar a operação completa.</AlertDescription>
        </Alert>
      )}
      <DataTable data={enterprises} columns={colunas} />

      {syncLog && syncLog.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Histórico de sincronizações</h3>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Data/Hora</th>
                  <th className="px-4 py-2 text-right font-medium">Escaneados</th>
                  <th className="px-4 py-2 text-right font-medium">Inseridos</th>
                  <th className="px-4 py-2 text-right font-medium">Duração</th>
                </tr>
              </thead>
              <tbody>
                {syncLog.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{new Date(log.executed_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2 text-right">{log.scanned}</td>
                    <td className="px-4 py-2 text-right">
                      {log.inserted > 0
                        ? <Badge variant="default" className="text-xs">{log.inserted} novo(s)</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{(log.duration_ms / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
