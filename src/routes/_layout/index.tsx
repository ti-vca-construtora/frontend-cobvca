import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, FileCheck2, HandCoins, Ban } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_layout/")({ component: HomePage });

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ChargeBatch { id: string; created_at: string; status: string; }
interface ChargeItem { id: string; status: string; }
interface NegBatch { id: string; created_at: string; status: string; }
interface NegItem { id: string; status: string; }

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function buildEvolution(chargeBatches: ChargeBatch[], negBatches: NegBatch[]) {
  const map: Record<string, { periodo: string; cobrancas: number; negativacoes: number }> = {};
  for (const b of chargeBatches) {
    const k = monthLabel(b.created_at);
    if (!map[k]) map[k] = { periodo: k, cobrancas: 0, negativacoes: 0 };
    map[k].cobrancas += 1;
  }
  for (const b of negBatches) {
    const k = monthLabel(b.created_at);
    if (!map[k]) map[k] = { periodo: k, cobrancas: 0, negativacoes: 0 };
    map[k].negativacoes += 1;
  }
  return Object.values(map).slice(-6);
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HomePage() {
  const { data: chargeBatches } = useQuery<ChargeBatch[]>({
    queryKey: ["dashboard-charge-batches"],
    queryFn: () => api.get<ChargeBatch[]>("/charges"),
    staleTime: 1000 * 60 * 2,
  });

  const { data: chargeItems } = useQuery<ChargeItem[]>({
    queryKey: ["dashboard-charge-items"],
    queryFn: () => api.get<ChargeItem[]>("/charges/items"),
    staleTime: 1000 * 60 * 2,
  });

  const { data: negBatches } = useQuery<NegBatch[]>({
    queryKey: ["dashboard-neg-batches"],
    queryFn: () => api.get<NegBatch[]>("/negativations"),
    staleTime: 1000 * 60 * 2,
  });

  const { data: negItems } = useQuery<NegItem[]>({
    queryKey: ["dashboard-neg-items"],
    queryFn: () => api.get<NegItem[]>("/negativations/items"),
    staleTime: 1000 * 60 * 2,
  });

  const pagos = chargeItems?.filter((i) => i.status === "pago").length ?? 0;
  const exportados = negItems?.filter((i) => i.status === "exportado").length ?? 0;
  const evolucao = buildEvolution(chargeBatches ?? [], negBatches ?? []);
  const loading = !chargeBatches || !chargeItems || !negBatches || !negItems;

  const barData = chargeItems
    ? Object.entries(
        chargeItems.reduce<Record<string, number>>((acc, i) => {
          acc[i.status] = (acc[i.status] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([status, total]) => ({ status, total }))
    : [];

  return (
    <>
      <PageHeader titulo="Dashboard" descricao="Visão geral de cobrança e negativação" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : (
            <>
              <KpiCard titulo="Lotes de cobrança" valor={chargeBatches?.length ?? 0} icone={FolderKanban}
                hint={`${chargeItems?.filter((i) => i.status === "pendente").length ?? 0} pendentes`} />
              <KpiCard titulo="Itens de cobrança" valor={chargeItems?.length ?? 0} icone={HandCoins}
                hint={`${pagos} pagos`} />
              <KpiCard titulo="Lotes de negativação" valor={negBatches?.length ?? 0} icone={Ban}
                hint={`${negItems?.filter((i) => i.status === "pendente").length ?? 0} pendentes`} />
              <KpiCard titulo="Itens negativação" valor={negItems?.length ?? 0} icone={FileCheck2}
                hint={`${exportados} exportados`} />
            </>
          )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Lotes criados por mês</CardTitle></CardHeader>
          <CardContent className="h-72">
            {evolucao.length === 0
              ? <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados suficientes.</div>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="periodo" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cobrancas" name="Cobrança" stroke="hsl(220 90% 56%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="negativacoes" name="Negativação" stroke="hsl(0 80% 60%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status dos itens de cobrança</CardTitle></CardHeader>
          <CardContent className="h-72">
            {!chargeItems
              ? <Skeleton className="h-full w-full" />
              : barData.length === 0
                ? <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum item encontrado.</div>
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="status" width={130} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(220 90% 56%)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
