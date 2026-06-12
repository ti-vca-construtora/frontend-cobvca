import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/admin/empreendimento")({ component: EmpreendimentoPage });

interface Enterprise {
  id: string;
  cost_center_source: string;
  cost_center_id: string;
  cost_center_name: string;
  alias: string | null;
  enterprise_type: "loteamento" | "incorporação" | null;
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

interface SyncEnterpriseResult {
  scanned: number;
  inserted: number;
  updated: number;
}

type UpdateEnterprisePayload = {
  enterpriseType?: string;
  status?: string;
  isMultiplique?: boolean;
  alias?: string;
};

function EmpreendimentoPage() {
  return (
    <ProtectedRoute perfis={["administrador", "supervisor"]}>
      <Conteudo />
    </ProtectedRoute>
  );
}

function Conteudo() {
  const queryClient = useQueryClient();
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});
  const [savingAliasId, setSavingAliasId] = useState<string | null>(null);

  const { data: enterprises, isLoading, isError } = useQuery<Enterprise[]>({
    queryKey: ["enterprises"],
    queryFn: () => api.get<Enterprise[]>("/enterprises"),
  });

  const { data: syncLog } = useQuery<SyncLog[]>({
    queryKey: ["sync-log"],
    queryFn: () => api.get<SyncLog[]>("/bq/sync-log"),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<SyncEnterpriseResult>("/bq/update-enterprises"),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["enterprises"] });
      queryClient.invalidateQueries({ queryKey: ["sync-log"] });
      toast.success(
        `Sincronização concluída: ${result.inserted} novo(s), ${result.updated} atualizado(s), ${result.scanned} escaneado(s).`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao sincronizar empreendimentos.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEnterprisePayload }) => api.patch(`/enterprises/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprises"] });
      toast.success("Empreendimento atualizado!");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar.");
    },
    onSettled: () => {
      setSavingAliasId(null);
    },
  });

  useEffect(() => {
    if (!enterprises) {
      return;
    }

    setAliasDrafts((current) => {
      const next: Record<string, string> = {};
      for (const enterprise of enterprises) {
        next[enterprise.id] = current[enterprise.id] ?? enterprise.alias ?? "";
      }
      return next;
    });
  }, [enterprises]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-12 w-full" />
        ))}
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

  const semTipo = enterprises.filter((enterprise) => !enterprise.enterprise_type).length;

  const exportToExcel = () => {
    const escapeCell = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const rows = enterprises.map((enterprise) => `
      <tr>
        <td>${escapeCell(enterprise.cost_center_name || "")}</td>
        <td>${escapeCell(enterprise.alias || "")}</td>
        <td>${escapeCell(enterprise.cost_center_source || "")}</td>
        <td>${escapeCell(enterprise.cost_center_id || "")}</td>
        <td>${escapeCell(enterprise.enterprise_type || "")}</td>
        <td>${escapeCell(enterprise.status || "")}</td>
        <td>${enterprise.is_multiplique ? "Sim" : "Nao"}</td>
      </tr>
    `);

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Alias</th>
                <th>Fonte</th>
                <th>Centro de Custo</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Multiplique</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([`\uFEFF${html}`], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "empreendimentos.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const colunas: Column<Enterprise>[] = [
    {
      key: "nome",
      header: "Empreendimento",
      sortable: true,
      accessor: (row) => row.cost_center_name || `${row.cost_center_source} - ${row.cost_center_id}`,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.cost_center_name || `${row.cost_center_source} - ${row.cost_center_id}`}</span>
          <span className="text-xs text-muted-foreground">
            {row.cost_center_source} - {row.cost_center_id}
          </span>
        </div>
      ),
    },
    {
      key: "alias",
      header: "Alias",
      render: (row) => {
        const aliasValue = aliasDrafts[row.id] ?? row.alias ?? "";
        const normalizedAlias = aliasValue.trim();
        const savedAlias = (row.alias ?? "").trim();
        const changed = normalizedAlias !== savedAlias;
        const saving = savingAliasId === row.id && updateMutation.isPending;

        return (
          <div className="flex min-w-[280px] items-center gap-2">
            <Input
              value={aliasValue}
              onChange={(event) =>
                setAliasDrafts((current) => ({
                  ...current,
                  [row.id]: event.target.value,
                }))
              }
              placeholder="Ex.: Madri Loteamento"
              className="h-8"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!changed || updateMutation.isPending}
              onClick={() => {
                setSavingAliasId(row.id);
                updateMutation.mutate({
                  id: row.id,
                  payload: { alias: normalizedAlias },
                });
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        );
      },
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.enterprise_type ? (
            <Badge variant="secondary">{row.enterprise_type}</Badge>
          ) : (
            <Badge variant="destructive">Sem tipo</Badge>
          )}
          <Select
            value={row.enterprise_type ?? ""}
            onValueChange={(value) => updateMutation.mutate({ id: row.id, payload: { enterpriseType: value } })}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Definir..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loteamento">Loteamento</SelectItem>
              <SelectItem value="incorporação">Incorporação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Select value={row.status} onValueChange={(value) => updateMutation.mutate({ id: row.id, payload: { status: value } })}>
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
      render: (row) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.is_multiplique}
            onCheckedChange={(value) => updateMutation.mutate({ id: row.id, payload: { isMultiplique: value } })}
          />
          {row.is_multiplique && <Badge variant="default">Multiplique</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Empreendimentos"
        descricao="Visualize os nomes oficiais, defina alias de exibicao e categorize os empreendimentos sincronizados do BigQuery."
        acoes={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar do BigQuery"}
            </Button>
          </div>
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
                      {log.inserted > 0 ? <Badge variant="default" className="text-xs">{log.inserted} novo(s)</Badge> : <span className="text-muted-foreground">0</span>}
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
