import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff } from "lucide-react";
import { parametrosMock } from "@/features/mocks/data";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/configuracoes")({ component: ConfigPage });

function ConfigPage() {
  return (
    <ProtectedRoute perfis={["admin"]}>
      <PageHeader titulo="Configurações" descricao="Parâmetros e acessos do sistema" />
      <Conteudo />
    </ProtectedRoute>
  );
}

function Conteudo() {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros do sistema</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Data mínima de cobrança</Label>
            <Input type="date" defaultValue={parametrosMock.dataMinimaCobranca} />
          </div>
          <div><Label>Documentos a ignorar (um por linha)</Label>
            <Textarea rows={3} defaultValue={parametrosMock.documentosIgnorados.join("\n")} />
          </div>
          <Button onClick={() => toast.success("Parâmetros salvos (mock)")}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Chaves de API — Innove</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <Input type={show ? "text" : "password"} defaultValue={parametrosMock.apiKeyInnove} />
            <Button variant="outline" size="icon" onClick={() => setShow(!show)} aria-label="Mostrar/ocultar">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Última alteração por <b>{parametrosMock.ultimaAlteracaoPor}</b> em {parametrosMock.ultimaAlteracaoEm}
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Acessos e perfis</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Configure permissões por perfil. (Em breve)</p>
        </CardContent>
      </Card>
    </div>
  );
}
