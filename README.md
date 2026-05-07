# Sistema de Cobrança e Negativação — Frontend (mock)

Esqueleto frontend em React + TypeScript + TanStack Start, com dados mockados,
controle de acesso por perfil (RBAC no front) e arquitetura preparada para
plugar APIs reais.

## Como rodar

```bash
bun install
bun run dev
```

## Trocar usuário mockado

No header (canto superior direito), clique no avatar e escolha um dos
4 usuários mock:

- **Ana Admin** — perfil `admin`
- **Sergio Supervisor** — perfil `supervisor`
- **Carlos Cobrador** — perfil `cobrador`
- **Nina Negativador** — perfil `negativador`

A escolha é persistida em `localStorage` (`mock_user_id`). O menu/lateral
e as rotas se adaptam automaticamente ao perfil.

## Estrutura

```
src/
  components/
    app/             # Componentes reutilizáveis (DataTable, FilterBar, KpiCard,
                     # NotificationBell, AppHeader, AppSidebar, ProtectedRoute,
                     # PageHeader)
    ui/              # shadcn/ui
  features/
    auth/            # AuthContext (mock) — substituir por API real
    mocks/data.ts    # Dados mockados centralizados por domínio
  routes/
    __root.tsx
    _layout.tsx      # Layout com sidebar + header (rotas protegidas/autenticadas)
    _layout/
      index.tsx              # Dashboard
      consultas.tsx
      negativacao.tsx
      cobranca/
        meus-processos.tsx
        novo-processo.tsx
      admin/
        tratativa-interna.tsx
        cv-sienge.tsx
        empreendimento.tsx
      configuracoes.tsx
  types/             # Tipos das entidades (Usuário, Processo, Empresa, etc.)
```

## Onde plugar APIs reais

1. **Autenticação**: substitua `src/features/auth/AuthContext.tsx` por uma
   integração real (login, sessão, claims). Mantenha a interface `useAuth()`
   para evitar refatoração nas telas.
2. **Dados**: cada página importa de `src/features/mocks/data.ts`. Crie
   uma camada `src/features/<dominio>/services.ts` (ex.: `processosService.ts`)
   com funções `listProcessos()`, `getProcesso(id)` etc., e use TanStack
   Query (`useQuery`) nas telas no lugar dos imports diretos.
3. **Permissões**: o RBAC está em `ProtectedRoute` e no `AppSidebar`.
   Centralize em `usePermissions()` se evoluir para controle granular.

## Stack

- React 19 + TypeScript
- TanStack Start (Router + SSR-ready) + TanStack Query
- TailwindCSS + shadcn/ui
- Recharts (gráficos)
- lucide-react (ícones)
- sonner (toasts)
