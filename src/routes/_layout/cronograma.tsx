import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/cronograma")({ component: CronogramaPage });

// --- Types -------------------------------------------------------------------

interface CompanySchedule {
  id: string;
  enterprise_name: string;
  start_day: number;
  end_day: number;
  scope: "cobranca" | "negativacao" | "ambos";
  status: "ativo" | "inativo";
}

// --- Page --------------------------------------------------------------------

const SCOPE_LABEL: Record<string, string> = {
  cobranca: "Cobrança",
  negativacao: "Negativação",
  ambos: "Ambos",
};

function CronogramaPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<CompanySchedule | null>(null);

  const { data: schedules, isLoading } = useQuery<CompanySchedule[]>({
    queryKey: ["company-schedule"],
    queryFn: () => api.get<CompanySchedule[]>("/parameters/cronograma"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/parameters/cronograma/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-schedule"] });
      toast.success("Entrada removida.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao remover."),
  });

  const today = new Date().getDate();

  const columns: Column<CompanySchedule>[] = [
    { key: "enterprise", header: "Empreendimento", accessor: (r) => r.enterprise_name },
    { key: "window", header: "Janela", render: (r) => `Dia ${r.start_day} a ${r.end_day}` },
    {
      key: "today",
      header: "Hoje",
      render: (r) => (
        <Badge variant={today >= r.start_day && today <= r.end_day ? "default" : "secondary"}>
          {today >= r.start_day && today <= r.end_day ? "Ativo" : "Fora"}
        </Badge>
      ),
    },
    { key: "scope", header: "Escopo", render: (r) => SCOPE_LABEL[r.scope] },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    {
      key: "acoes",
      header: "",
      render: (r) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditItem(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate(r.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ProtectedRoute perfis={["administrador"]}>
      <PageHeader titulo="Cronograma" descricao="Janelas de cobrança e negativação por empreendimento" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Dia atual: <strong>{today}</strong>
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nova entrada
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <DataTable data={schedules ?? []} columns={columns} />
        )}
        {open && <ScheduleDialog onClose={() => setOpen(false)} />}
        {editItem && <ScheduleDialog schedule={editItem} onClose={() => setEditItem(null)} />}
      </div>
    </ProtectedRoute>
  );
}

// --- Dialog ------------------------------------------------------------------

function ScheduleDialog({
  schedule,
  onClose,
}: {
  schedule?: CompanySchedule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!schedule;
  const [enterpriseName, setEnterpriseName] = useState(schedule?.enterprise_name ?? "");
  const [startDay, setStartDay] = useState(String(schedule?.start_day ?? "1"));
  const [endDay, setEndDay] = useState(String(schedule?.end_day ?? "10"));
  const [scope, setScope] = useState<string>(schedule?.scope ?? "ambos");
  const [status, setStatus] = useState<string>(schedule?.status ?? "ativo");

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        enterprise_name: enterpriseName,
        start_day: Number(startDay),
        end_day: Number(endDay),
        scope,
        status,
      };
      return isEdit
        ? api.patch(`/parameters/cronograma/${schedule!.id}`, body)
        : api.post("/parameters/cronograma", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-schedule"] });
      toast.success(isEdit ? "Cronograma atualizado!" : "Cronograma criado!");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao salvar."),
  });

  const canSave =
    enterpriseName.trim() && Number(startDay) >= 1 && Number(endDay) >= Number(startDay);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cronograma" : "Nova entrada"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Empreendimento (exato conforme BigQuery)</Label>
            <Input
              value={enterpriseName}
              onChange={(e) => setEnterpriseName(e.target.value)}
              placeholder="Ex: Residencial Primavera"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dia inicial</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Dia final</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cobranca">Cobrança</SelectItem>
                <SelectItem value="negativacao">Negativação</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
