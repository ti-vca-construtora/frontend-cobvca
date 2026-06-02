import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_layout/consultas")({ component: ConsultasPage });

// ─── Types ────────────────────────────────────────────────────────────────────

type BqRow = { id: string } & Record<string, unknown>;
type BqResponse = { data?: BqRow[]; count?: number; page?: number; pageSize?: number; totalPages?: number };

// ─── Page ─────────────────────────────────────────────────────────────────────

function ConsultasPage() {
  return (
    <>
      <PageHeader titulo="Consultas" descricao="Consulta de registros diretamente no BigQuery (Sienge / CV)" />
      <Tabs defaultValue="receber">
        <TabsList className="mb-4">
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
          <TabsTrigger value="recebidas">Contas Recebidas</TabsTrigger>
        </TabsList>
        <TabsContent value="receber">
          <TabelaBq endpoint="/bq/contas-receber" queryKey="bq-contas-receber" />
        </TabsContent>
        <TabsContent value="recebidas">
          <TabelaBq endpoint="/bq/contas-recebidas" queryKey="bq-contas-recebidas" />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── Tabela genérica BQ com filtros ──────────────────────────────────────────

function TabelaBq({ endpoint, queryKey }: { endpoint: string; queryKey: string }) {
  const [option, setOption] = useState<string>("all");
  const [client, setClient] = useState("");
  const [enterprise, setEnterprise] = useState("");
  const [limit, setLimit] = useState("200");
  const [enabled, setEnabled] = useState(false);
  const [aberto, setAberto] = useState<BqRow | null>(null);

  const {
    data: rows,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<BqRow[], ApiError>({
    queryKey: [queryKey, option, client, enterprise, limit],
    queryFn: async () => {
      const limitValue = limit.trim();
      const requestOption =
        endpoint === "/bq/contas-receber"
          ? "charge"
          : (option !== "all" ? option : undefined);

      // Campo "Limite" vazio: buscar todos os registros paginando pela API.
      if (!limitValue) {
        const first = await api.post<BqResponse>(endpoint, {
          option: requestOption,
          client: client.trim() || undefined,
          enterprise: enterprise.trim() || undefined,
          page: 1,
          pageSize: 5000,
        });

        const firstRows = first.data ?? [];
        const totalPages = Math.max(1, Number(first.totalPages ?? 1));
        if (totalPages === 1) return firstRows;

        const pages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            api.post<BqResponse>(endpoint, {
              option: requestOption,
              client: client.trim() || undefined,
              enterprise: enterprise.trim() || undefined,
              page: i + 2,
              pageSize: 5000,
            }),
          ),
        );

        return [firstRows, ...pages.map((p) => p.data ?? [])].flat();
      }

      if (endpoint === "/bq/contas-receber") {
        const response = await api.post<BqRow[] | BqResponse>(endpoint, {
          option: requestOption,
          client: client.trim() || undefined,
          enterprise: enterprise.trim() || undefined,
          limit: Number(limitValue),
        });
        return Array.isArray(response) ? response : (response.data ?? []);
      }

      const response = await api.post<BqRow[] | BqResponse>(endpoint, {
        option: requestOption,
        client: client.trim() || undefined,
        enterprise: enterprise.trim() || undefined,
        limit: Number(limitValue),
      });
      return Array.isArray(response) ? response : (response.data ?? []);
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  async function consultar() {
    setEnabled(true);
    await refetch();
  }

  const pick = (row: BqRow, keys: string[]): string => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && v !== "") return String(v);
    }
    return "—";
  };

  const colunas: Column<BqRow>[] = [
    {
      key: "cliente", header: "Cliente",
      render: (r) => (
        <div>
          <div className="font-medium">{pick(r, ["cliente", "nomeCliente", "client"])}</div>
          <div className="text-xs text-muted-foreground">{pick(r, ["documento", "cpfCnpj", "cpf_cnpj"])}</div>
        </div>
      ),
    },
    { key: "empresa", header: "Empreendimento", render: (r) => pick(r, ["centroCusto", "costCenterName", "empresa", "nomeEmpreendimento", "empreendimento"]) },
    {
      key: "valor", header: "Valor",
      render: (r) => {
        const raw = r["valor"] ?? r["vlrAberto"] ?? r["valorAberto"];
        if (raw == null) return "—";
        const n = Number(raw);
        return isNaN(n) ? String(raw) : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      },
    },
    {
      key: "dias", header: "Dias vencidos",
      render: (r) => {
        const v = r["dias"] ?? r["diasVencidos"] ?? r["diasAtraso"];
        return v != null ? `${v}d` : "—";
      },
    },
    {
      key: "vencimento", header: "Vencimento",
      render: (r) => {
        const v = pick(r, ["vencimento", "dataVencimento", "dtVencimento"]);
        if (v === "—") return "—";
        try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return v; }
      },
    },
    {
      key: "origem", header: "Origem",
      render: (r) => {
        const v = pick(r, ["sourceBase", "origem", "erp", "base"]);
        return v !== "—" ? <Badge variant="outline">{v}</Badge> : null;
      },
    },
  ];

  const tableRows: BqRow[] = (rows ?? []).map((row, index) => ({
    ...row,
    id: String(row.id ?? row.verificador ?? `${queryKey}-${index}`),
  }));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 w-[160px]">
          <Label className="text-xs">Opção</Label>
          <Select value={option} onValueChange={setOption}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="negativation">Negativação</SelectItem>
              <SelectItem value="charge">Cobrança</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label className="text-xs">Cliente</Label>
          <Input placeholder="Nome ou CPF/CNPJ" value={client} onChange={(e) => setClient(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label className="text-xs">Empreendimento</Label>
          <Input placeholder="Nome" value={enterprise} onChange={(e) => setEnterprise(e.target.value)} />
        </div>
        <div className="space-y-1 w-[110px]">
          <Label className="text-xs">Limite</Label>
          <Input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <Button onClick={consultar} disabled={isFetching} className="gap-2">
          <Search className="h-4 w-4" />
          {isFetching ? "Consultando…" : "Consultar"}
        </Button>
      </div>

      {/* Resultado */}
      {isFetching && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Erro ao consultar o BigQuery{error?.message ? `: ${error.message}` : "."}
        </p>
      )}

      {!isFetching && rows && (
        <>
          <p className="text-xs text-muted-foreground">{tableRows.length} registro(s) encontrado(s)</p>
          <DataTable data={tableRows} columns={colunas} onRowClick={setAberto} />
        </>
      )}

      {!enabled && !isFetching && (
        <p className="text-sm text-muted-foreground">Configure os filtros e clique em Consultar.</p>
      )}

      {/* Sheet de detalhe */}
      {aberto && (
        <Sheet open onOpenChange={(o) => !o && setAberto(null)}>
          <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
            <SheetHeader><SheetTitle>Detalhes do registro</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-2 text-sm">
              {Object.entries(aberto)
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b pb-2 gap-4">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="font-medium text-right break-all">{String(v)}</span>
                  </div>
                ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
