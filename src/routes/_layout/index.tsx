import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Users, HandCoins, Ban } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";
import {
  evolucaoCobrancasMock, empresasSemCobrancaMock, processosMock,
} from "@/features/mocks/data";

export const Route = createFileRoute("/_layout/")({ component: HomePage });

function HomePage() {
  const totalProc = processosMock.length;
  const emAndamento = processosMock.filter((p) => p.status === "em_andamento").length;
  const negativados = processosMock.filter((p) => p.status === "negativado").length;

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Visão geral de cobrança e negativação"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard titulo="Processos ativos" valor={totalProc} icone={FolderKanban} hint={`${emAndamento} em andamento`} />
        <KpiCard titulo="Clientes únicos (mês)" valor={48} icone={Users} hint="+12% vs. mês anterior" />
        <KpiCard titulo="Ações de cobrança" valor={210} icone={HandCoins} hint="Últimos 30 dias" />
        <KpiCard titulo="Negativações" valor={negativados} icone={Ban} hint="No período" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução de cobranças e negativações</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoCobrancasMock}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cobrancas" stroke="hsl(220 90% 56%)" strokeWidth={2} />
                <Line type="monotone" dataKey="negativacoes" stroke="hsl(0 80% 60%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas há mais dias sem cobrança</CardTitle>
            <p className="text-xs text-muted-foreground">Sem histórico exibido como “Infinito” (cap visual em 365+)</p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={empresasSemCobrancaMock} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" domain={[0, 365]} />
                <YAxis type="category" dataKey="empresa" width={140} />
                <Tooltip formatter={(v: number) => (v >= 365 ? "365+ (Infinito)" : `${v} dias`)} />
                <Bar dataKey="dias" fill="hsl(220 90% 56%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
