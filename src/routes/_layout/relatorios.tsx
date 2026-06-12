import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_layout/relatorios")({ component: RelatoriosPage });

type ChargeStatus =
  | "pendente"
  | "sem_retorno"
  | "em_atendimento"
  | "ciente_sem_retorno"
  | "em_negociacao"
  | "acordo"
  | "pago"
  | "cancelado"
  | "processo_juridico"
  | "tratativa_interna";

interface ChargeItem {
  id: string;
  batch_id: string | null;
  bill_id: string | null;
  client_name: string | null;
  document: string | null;
  enterprise_name: string | null;
  amount: number | null;
  due_date: string | null;
  status: ChargeStatus;
  feedback_notes: string | null;
  assigned_to_user_id: string | null;
  legal_process_flag: boolean;
  internal_handling_flag: boolean;
  datacharge_items?: ChargeInstallment[];
}

interface ChargeInstallment {
  id?: string;
  valor: number | null;
  tipo_parcela: string | null;
  dias_vencidos: number | null;
  data_vencimento: string | null;
}

interface ChargeBatch {
  id: string;
  batch_code: string;
  status: string;
  created_at: string;
}

interface AppUser {
  id: string;
  userId: string;
  fullName: string;
}

interface ReportRow {
  id: string;
  cliente: string;
  documento: string;
  processo: string;
  processoStatus: string;
  titulo: string;
  empreendimento: string;
  parcelas: ChargeInstallment[];
  valor: number;
  vencimento: string | null;
  status: ChargeStatus;
  responsavel: string;
  feedback: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  sem_retorno: "Sem retorno",
  em_atendimento: "Em atendimento",
  ciente_sem_retorno: "Ciente s/ retorno",
  em_negociacao: "Em negociação",
  acordo: "Acordo",
  pago: "Pago",
  cancelado: "Cancelado",
  processo_juridico: "Processo jurídico",
  tratativa_interna: "Tratativa interna",
  concluido: "Concluído",
  em_andamento: "Em andamento",
};

const RESOLVED_STATUS = new Set(["pago", "acordo", "cancelado"]);

function RelatoriosPage() {
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [parcelasRow, setParcelasRow] = useState<ReportRow | null>(null);

  const { data: items = [], isLoading: itemsLoading } = useQuery<ChargeItem[]>({
    queryKey: ["relatorios-charge-items"],
    queryFn: () => api.get<ChargeItem[]>("/charges/items"),
    staleTime: 1000 * 60,
  });

  const { data: batches = [], isLoading: batchesLoading } = useQuery<ChargeBatch[]>({
    queryKey: ["charge-batches"],
    queryFn: () => api.get<ChargeBatch[]>("/charges"),
    staleTime: 1000 * 60,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
    staleTime: 1000 * 60 * 5,
  });

  const batchById = useMemo(() => new Map(batches.map((batch) => [batch.id, batch])), [batches]);
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.id, user.fullName);
      map.set(user.userId, user.fullName);
    }
    return map;
  }, [users]);

  const resultados = useMemo(() => {
    const normalizedSearch = normalizeSearch(busca);
    if (normalizedSearch.length < 2) return [];

    return items
      .filter((item) => {
        const haystack = normalizeSearch([
          item.client_name,
          item.document,
          item.bill_id,
          item.enterprise_name,
        ].filter(Boolean).join(" "));
        return haystack.includes(normalizedSearch);
      })
      .map((item): ReportRow => {
        const batch = item.batch_id ? batchById.get(item.batch_id) : undefined;
        const responsavel = item.assigned_to_user_id
          ? userNameById.get(item.assigned_to_user_id) ?? "Colaborador não encontrado"
          : "Não atribuído";
        const parcelas = Array.isArray(item.datacharge_items) ? item.datacharge_items : [];
        return {
          id: item.id,
          cliente: item.client_name ?? "-",
          documento: item.document ?? "-",
          processo: batch?.batch_code ?? item.batch_id ?? "-",
          processoStatus: batch?.status ?? "-",
          titulo: baseBillId(item.bill_id),
          empreendimento: item.enterprise_name ?? "-",
          parcelas,
          valor: item.amount ?? sumInstallments(parcelas),
          vencimento: item.due_date,
          status: item.status,
          responsavel,
          feedback: item.feedback_notes,
        };
      });
  }, [batchById, busca, items, userNameById]);

  const resumo = useMemo(() => {
    const titulos = new Set(resultados.map((item) => `${item.documento}|${item.titulo}`));
    const processos = new Set(resultados.map((item) => item.processo).filter((value) => value !== "-"));
    return {
      clientes: new Set(resultados.map((item) => item.documento)).size,
      titulos: titulos.size,
      parcelas: resultados.reduce((total, item) => total + item.parcelas.length, 0),
      processos: processos.size,
      liquidados: resultados.filter((item) => item.status === "pago").length,
      resolvidos: resultados.filter((item) => RESOLVED_STATUS.has(item.status)).length,
      valor: resultados.reduce((total, item) => total + item.valor, 0),
    };
  }, [resultados]);

  const columns: Column<ReportRow>[] = [
    {
      key: "cliente",
      header: "Cliente",
      render: (row) => (
        <div>
          <div className="font-medium">{row.cliente}</div>
          <div className="text-xs text-muted-foreground">{row.documento}</div>
        </div>
      ),
    },
    {
      key: "processo",
      header: "Processo",
      render: (row) => (
        <div>
          <div>{row.processo}</div>
          <div className="text-xs text-muted-foreground">{STATUS_LABEL[row.processoStatus] ?? row.processoStatus}</div>
        </div>
      ),
    },
    { key: "titulo", header: "Título", accessor: (row) => row.titulo },
    { key: "empreendimento", header: "Empreendimento", accessor: (row) => row.empreendimento },
    {
      key: "parcelas",
      header: "Parcelas",
      render: (row) => (
        <Button type="button" size="sm" variant="outline" onClick={() => setParcelasRow(row)}>
          Ver parcelas ({row.parcelas.length || 1})
        </Button>
      ),
    },
    {
      key: "valor",
      header: "Valor",
      render: (row) => formatCurrency(row.valor),
      accessor: (row) => row.valor,
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={row.status === "cancelado" ? "destructive" : "secondary"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>,
    },
    {
      key: "responsavel",
      header: "Responsavel",
      render: (row) => (
        <div>
          <div>{row.responsavel}</div>
          {RESOLVED_STATUS.has(row.status) && (
            <div className="text-xs text-muted-foreground">Resolveu a pendencia</div>
          )}
        </div>
      ),
    },
    {
      key: "feedback",
      header: "Observação",
      render: (row) => <span className="text-sm text-muted-foreground">{row.feedback ?? "-"}</span>,
    },
  ];

  const isLoading = itemsLoading || batchesLoading;

  return (
    <ProtectedRoute perfis={["administrador", "supervisor", "cobrador"]}>
      <PageHeader titulo="Relatórios" descricao="Consulta consolidada por cliente, título e processo" />

      <div className="mb-5 flex max-w-2xl gap-2">
        <Input
          value={termo}
          onChange={(event) => setTermo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setBusca(termo);
          }}
          placeholder="Buscar por cliente, documento ou título"
        />
        <Button type="button" onClick={() => setBusca(termo)}>
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
        </div>
      ) : busca.trim().length < 2 ? (
        <div className="rounded-md border p-8 text-sm text-muted-foreground">
          Informe ao menos 2 caracteres para consultar o cliente.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <ResumoCard label="Clientes" value={resumo.clientes} />
            <ResumoCard label="Títulos" value={resumo.titulos} />
            <ResumoCard label="Parcelas" value={resumo.parcelas} />
            <ResumoCard label="Processos" value={resumo.processos} />
            <ResumoCard label="Liquidados" value={resumo.liquidados} />
            <ResumoCard label="Valor total" value={formatCurrency(resumo.valor)} />
          </div>

          <DataTable
            data={resultados}
            columns={columns}
            pageSize={8}
            emptyMessage="Nenhum cliente, documento ou título encontrado."
          />

          {parcelasRow && (
            <ParcelasDialog row={parcelasRow} onClose={() => setParcelasRow(null)} />
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}

function ParcelasDialog({ row, onClose }: { row: ReportRow; onClose: () => void }) {
  const parcelas = row.parcelas.length > 0
    ? row.parcelas
    : [{ valor: row.valor, tipo_parcela: null, dias_vencidos: null, data_vencimento: row.vencimento }];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parcelas do título {row.titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {row.cliente} - {row.processo}
          </div>
          <div className="max-h-[420px] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Parcela</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium">Dias vencidos</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((parcela, index) => (
                  <tr key={parcela.id ?? `${row.id}-${index}`} className="border-b last:border-b-0">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">{parcela.tipo_parcela ?? "-"}</td>
                    <td className="px-3 py-2">{formatCurrency(parcela.valor)}</td>
                    <td className="px-3 py-2">{formatDate(parcela.data_vencimento)}</td>
                    <td className="px-3 py-2">{parcela.dias_vencidos ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResumoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function baseBillId(value: string | null | undefined) {
  return (value ?? "-").replace(/#\d+$/, "");
}

function sumInstallments(parcelas: ChargeInstallment[]) {
  return parcelas.reduce((total, parcela) => total + (Number(parcela.valor) || 0), 0);
}

function formatCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}
