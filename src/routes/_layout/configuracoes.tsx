import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/configuracoes")({ component: ConfigPage });

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Parameter {
  id: string;
  key: string;
  value: string;
  value_type: string;
  description?: string;
  status: string;
}

interface IgnoreRule {
  id: string;
  rule_type: "documento" | "parcela" | "processo";
  erp: "sienge" | "cv";
  value: string;
  scope: "negativacao" | "cobranca" | "ambos";
  status: "ativo" | "inativo";
  created_at: string;
}

interface Integration {
  id: string;
  base: "vca" | "lotear";
  username: string;
  secret: string;
  base_url: string;
  status: "ativo" | "inativo";
}

interface AppUser {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: "administrador" | "supervisor" | "cobrador" | "negativador";
  status: "ativo" | "inativo";
  createdAt: string;
}

interface CompanySchedule {
  id: string;
  enterprise_name: string;
  start_day: number;
  end_day: number;
  scope: "cobranca" | "negativacao" | "ambos";
  status: "ativo" | "inativo";
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConfigPage() {
  return (
    <ProtectedRoute perfis={["administrador"]}>
      <PageHeader titulo="ConfiguraÃ§Ãµes" descricao="ParÃ¢metros de negÃ³cio e regras do sistema" />
      <Tabs defaultValue="parametros">
        <TabsList className="mb-4">
          <TabsTrigger value="parametros">ParÃ¢metros</TabsTrigger>
          <TabsTrigger value="regras">Regras de Ignorar</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="integracoes">IntegraÃ§Ãµes</TabsTrigger>
          <TabsTrigger value="usuarios">UsuÃ¡rios</TabsTrigger>
        </TabsList>
        <TabsContent value="parametros"><ParametrosTab /></TabsContent>
        <TabsContent value="regras"><RegrasTab /></TabsContent>
        <TabsContent value="cronograma"><CronogramaTab /></TabsContent>
        <TabsContent value="integracoes"><IntegracoesTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
      </Tabs>
    </ProtectedRoute>
  );
}

// â”€â”€â”€ Aba: ParÃ¢metros â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PARAM_LABELS: Record<string, string> = {
  negativacao_dias: "Prazo base de negativaÃ§Ã£o (dias)",
  juridico_habitacao_dias: "Prazo jurÃ­dico â€” HabitaÃ§Ã£o (dias)",
  juridico_lote_dias: "Prazo jurÃ­dico â€” Lote (dias)",
  cobranca_dias: "Prazo base de cobranÃ§a (dias)",
};

function ParametrosTab() {
  const queryClient = useQueryClient();

  const { data: params, isLoading, isError } = useQuery<Parameter[]>({
    queryKey: ["parameters"],
    queryFn: () => api.get<Parameter[]>("/parameters"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, param, value }: { id: string; param: Parameter; value: string }) =>
      api.patch(`/parameters/${id}`, {
        key: param.key,
        value,
        valueType: param.value_type,
        description: param.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parameters"] });
      toast.success("ParÃ¢metro salvo com sucesso!");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar parÃ¢metro.");
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-24" />
          </CardContent></Card>
        ))}
      </div>
    );
  }

  if (isError || !params) {
    return <p className="text-sm text-destructive">NÃ£o foi possÃ­vel carregar os parÃ¢metros.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {params.map((param) => (
        <ParameterCard
          key={param.id}
          param={param}
          onSave={(value) => updateMutation.mutate({ id: param.id, param, value })}
          saving={updateMutation.isPending}
        />
      ))}
    </div>
  );
}

function ParameterCard({ param, onSave, saving }: { param: Parameter; onSave: (v: string) => void; saving: boolean }) {
  const [value, setValue] = useState(param.value);
  useEffect(() => { setValue(param.value); }, [param.value]);
  const label = PARAM_LABELS[param.key] ?? param.key;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        {param.description && <p className="text-xs text-muted-foreground">{param.description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={param.key}>Valor</Label>
          <Input
            id={param.key}
            type={param.value_type === "integer" ? "number" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={param.value_type === "integer" ? 1 : undefined}
          />
        </div>
        <Button size="sm" disabled={value === param.value || saving} onClick={() => onSave(value)}>
          {saving ? "Salvandoâ€¦" : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

// â”€â”€â”€ Aba: Regras de Ignorar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SCOPE_LABEL: Record<string, string> = { negativacao: "NegativaÃ§Ã£o", cobranca: "CobranÃ§a", ambos: "Ambos" };
const TYPE_LABEL: Record<string, string> = { documento: "Documento", parcela: "Parcela", processo: "Processo" };

function RegrasTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rules, isLoading } = useQuery<IgnoreRule[]>({
    queryKey: ["ignore-rules"],
    queryFn: () => api.get<IgnoreRule[]>("/ignore-rules"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ignore-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ignore-rules"] });
      toast.success("Regra removida.");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover regra.");
    },
  });

  const columns: Column<IgnoreRule>[] = [
    { key: "type", header: "Tipo", render: (r) => TYPE_LABEL[r.rule_type] },
    { key: "erp", header: "ERP", render: (r) => <Badge variant="outline">{r.erp.toUpperCase()}</Badge> },
    { key: "value", header: "Valor", render: (r) => <code className="text-xs bg-muted px-1 py-0.5 rounded">{r.value}</code> },
    { key: "scope", header: "Escopo", render: (r) => SCOPE_LABEL[r.scope] },
    {
      key: "status", header: "Status",
      render: (r) => <Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    {
      key: "acoes", header: "",
      render: (r) => (
        <Button
          size="icon" variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate(r.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nova regra</Button>
          </DialogTrigger>
          <CreateRuleDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <DataTable data={rules ?? []} columns={columns} />
      )}
    </div>
  );
}

function CreateRuleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ruleType, setRuleType] = useState<string>("documento");
  const [erp, setErp] = useState<string>("sienge");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<string>("ambos");

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/ignore-rules", { ruleType, erp, value, scope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ignore-rules"] });
      toast.success("Regra criada com sucesso!");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar regra.");
    },
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Nova regra de ignorar</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={ruleType} onValueChange={setRuleType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="documento">Documento</SelectItem>
              <SelectItem value="parcela">Parcela</SelectItem>
              <SelectItem value="processo">Processo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>ERP</Label>
          <Select value={erp} onValueChange={setErp}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sienge">Sienge</SelectItem>
              <SelectItem value="cv">CV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Valor</Label>
          <Input placeholder="Ex: CESD ou 000.000.000-00" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Escopo</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="negativacao">NegativaÃ§Ã£o</SelectItem>
              <SelectItem value="cobranca">CobranÃ§a</SelectItem>
              <SelectItem value="ambos">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={!value.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? "Salvandoâ€¦" : "Criar regra"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// â”€â”€â”€ Aba: IntegraÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BASE_LABEL: Record<string, string> = { vca: "CV/VCA", lotear: "Lotear" };

function IntegracoesTab() {
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<Integration | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => api.get<Integration[]>("/integrations"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("IntegraÃ§Ã£o removida.");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover.");
    },
  });

  const columns: Column<Integration>[] = [
    { key: "base", header: "Base", render: (r) => <Badge variant="outline">{BASE_LABEL[r.base] ?? r.base}</Badge> },
    { key: "username", header: "UsuÃ¡rio", accessor: (r) => r.username },
    { key: "secret", header: "Segredo", render: (r) => <code className="text-xs bg-muted px-1 py-0.5 rounded">{r.secret}</code> },
    { key: "base_url", header: "URL Base", accessor: (r) => r.base_url },
    {
      key: "status", header: "Status",
      render: (r) => <Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    {
      key: "acoes", header: "",
      render: (r) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditItem(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon" variant="ghost"
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Nova integraÃ§Ã£o
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <DataTable data={integrations ?? []} columns={columns} />
      )}
      {createOpen && <IntegrationDialog onClose={() => setCreateOpen(false)} />}
      {editItem && <IntegrationDialog integration={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

function IntegrationDialog({
  integration,
  onClose,
}: {
  integration?: Integration;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!integration;

  const [base, setBase] = useState<string>(integration?.base ?? "vca");
  const [username, setUsername] = useState(integration?.username ?? "");
  const [secret, setSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState(integration?.base_url ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.patch(`/integrations/${integration!.id}`, { base, username, secret, baseUrl })
        : api.post("/integrations", { base, username, secret, baseUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success(isEdit ? "IntegraÃ§Ã£o atualizada!" : "IntegraÃ§Ã£o criada!");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    },
  });

  const canSave = username.trim() && secret.trim() && baseUrl.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar integraÃ§Ã£o" : "Nova integraÃ§Ã£o"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Base</Label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vca">CV/VCA</SelectItem>
                <SelectItem value="lotear">Lotear</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>UsuÃ¡rio</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{isEdit ? "Novo segredo (deixe em branco para nÃ£o alterar)" : "Segredo"}</Label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={isEdit ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label>URL Base</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvandoâ€¦" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€â”€ Aba: UsuÃ¡rios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ROLE_LABEL: Record<string, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  cobrador: "Cobrador",
  negativador: "Negativador",
};

function UsuariosTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<AppUser | null>(null);

  const { data: users, isLoading } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get<AppUser[]>("/users"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("UsuÃ¡rio removido.");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover.");
    },
  });

  const columns: Column<AppUser>[] = [
    { key: "name", header: "Nome", accessor: (r) => r.fullName },
    { key: "email", header: "E-mail", accessor: (r) => r.email },
    {
      key: "role", header: "Perfil",
      render: (r) => <Badge variant="outline">{ROLE_LABEL[r.role] ?? r.role}</Badge>,
    },
    {
      key: "status", header: "Status",
      render: (r) => <Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    {
      key: "acoes", header: "",
      render: (r) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditItem(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon" variant="ghost"
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Novo usuÃ¡rio
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <DataTable data={users ?? []} columns={columns} />
      )}
      {createOpen && <UserDialog onClose={() => setCreateOpen(false)} />}
      {editItem && <UserDialog user={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

function UserDialog({ user, onClose }: { user?: AppUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!user;

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(user?.role ?? "cobrador");
  const [status, setStatus] = useState<string>(user?.status ?? "ativo");

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.patch(`/users/${user!.id}`, { fullName, role, status })
        : api.post("/users", { fullName, email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(isEdit ? "UsuÃ¡rio atualizado!" : "UsuÃ¡rio criado!");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    },
  });

  const canSave = fullName.trim() && (isEdit || (email.trim() && password.length >= 8));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuÃ¡rio" : "Novo usuÃ¡rio"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Senha inicial (mÃ­n. 8 caracteres)</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="administrador">Administrador</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="cobrador">Cobrador</SelectItem>
                <SelectItem value="negativador">Negativador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvandoâ€¦" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba: Cronograma ──────────────────────────────────────────────────────────

const SCOPE_SCHED_LABEL: Record<string, string> = { cobranca: "Cobrança", negativacao: "Negativação", ambos: "Ambos" };

function CronogramaTab() {
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
      key: "today", header: "Hoje",
      render: (r) => (
        <Badge variant={today >= r.start_day && today <= r.end_day ? "default" : "secondary"}>
          {today >= r.start_day && today <= r.end_day ? "Ativo" : "Fora"}
        </Badge>
      ),
    },
    { key: "scope", header: "Escopo", render: (r) => SCOPE_SCHED_LABEL[r.scope] },
    {
      key: "status", header: "Status",
      render: (r) => <Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    {
      key: "acoes", header: "",
      render: (r) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditItem(r)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate(r.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Dia atual: <strong>{today}</strong></p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova entrada</Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <DataTable data={schedules ?? []} columns={columns} />
      )}
      {open && <ScheduleDialog onClose={() => setOpen(false)} />}
      {editItem && <ScheduleDialog schedule={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

function ScheduleDialog({ schedule, onClose }: { schedule?: CompanySchedule; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!schedule;
  const [enterpriseName, setEnterpriseName] = useState(schedule?.enterprise_name ?? "");
  const [startDay, setStartDay] = useState(String(schedule?.start_day ?? "1"));
  const [endDay, setEndDay] = useState(String(schedule?.end_day ?? "10"));
  const [scope, setScope] = useState<string>(schedule?.scope ?? "ambos");
  const [status, setStatus] = useState<string>(schedule?.status ?? "ativo");

  const mutation = useMutation({
    mutationFn: () => {
      const body = { enterprise_name: enterpriseName, start_day: Number(startDay), end_day: Number(endDay), scope, status };
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

  const canSave = enterpriseName.trim() && Number(startDay) >= 1 && Number(endDay) >= Number(startDay);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar cronograma" : "Nova entrada"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Empreendimento (exato conforme BigQuery)</Label>
            <Input value={enterpriseName} onChange={(e) => setEnterpriseName(e.target.value)} placeholder="Ex: Residencial Primavera" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dia inicial</Label>
              <Input type="number" min={1} max={31} value={startDay} onChange={(e) => setStartDay(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Dia final</Label>
              <Input type="number" min={1} max={31} value={endDay} onChange={(e) => setEndDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}