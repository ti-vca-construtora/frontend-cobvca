import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/negativacao/retiradas")({ component: RetiradasPage });

// ─── Types ───────────────────────────────────────────────────────────────────

interface RetiradaItem {
  id: string;
  process_id: string;
  document: string | null;
  client_name: string | null;
  enterprise_name: string | null;
  status: "retirada_pendente" | "retirado";
  created_at: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RetiradasPage() {
  return (
    <ProtectedRoute perfis={["administrador", "negativador"]}>
      <PageHeader
        titulo="Retiradas"
        descricao="Itens negativados com pagamento identificado — aguardando confirmação de retirada"
        acoes={
          <Button size="sm" variant="ghost" asChild>
            <Link to="/negativacao"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
          </Button>
        }
      />
      <Lista />
    </ProtectedRoute>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────

function Lista() {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<RetiradaItem[]>({
    queryKey: ["negativation-retiradas"],
    queryFn: () =>
      api.get<RetiradaItem[]>("/negativations/items?status=retirada_pendente"),
  });

  const confirmarMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<{ success: boolean }>(`/negativations/items/${id}/confirmar-retirada`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negativation-retiradas"] });
      toast.success("Retirada confirmada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao confirmar retirada."),
  });

  const colunas: Column<RetiradaItem>[] = [
    { key: "process_id", header: "ID Processo", accessor: (r) => r.process_id },
    { key: "client", header: "Cliente", accessor: (r) => r.client_name ?? "—" },
    { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name ?? "—" },
    { key: "doc", header: "Documento", accessor: (r) => r.document ?? "—" },
    {
      key: "status", header: "Status",
      render: (r) => (
        <Badge variant={r.status === "retirada_pendente" ? "destructive" : "outline"}>
          {r.status === "retirada_pendente" ? "Retirada pendente" : "Retirado"}
        </Badge>
      ),
    },
    {
      key: "created_at", header: "Criado em",
      render: (r) => new Date(r.created_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "actions", header: "",
      render: (r) =>
        r.status === "retirada_pendente" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={confirmarMutation.isPending}
            onClick={() => confirmarMutation.mutate(r.id)}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Confirmar retirada
          </Button>
        ) : null,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm mt-6">
        Nenhum item com retirada pendente no momento. Execute o Batimento para identificar pagamentos.
      </p>
    );
  }

  return <DataTable data={items} columns={colunas} />;
}
