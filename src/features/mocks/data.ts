import type {
  Cliente,
  Empreendimento,
  Empresa,
  HistoricoAcao,
  MapeamentoCVSienge,
  Notificacao,
  ParametroSistema,
  Processo,
  Tratativa,
  Usuario,
} from "@/types";

export const usuariosMock: Usuario[] = [
  { id: "u1", nome: "Ana Admin", email: "ana@empresa.com", perfil: "administrador" },
  { id: "u2", nome: "Sergio Supervisor", email: "sergio@empresa.com", perfil: "supervisor" },
  { id: "u3", nome: "Carlos Cobrador", email: "carlos@empresa.com", perfil: "cobrador" },
  { id: "u4", nome: "Nina Negativador", email: "nina@empresa.com", perfil: "negativador" },
];

export const empresasMock: Empresa[] = [
  { id: "e1", nome: "Construtora Alvorada", cnpj: "12.345.678/0001-90" },
  { id: "e2", nome: "Incorporadora Sol", cnpj: "98.765.432/0001-10" },
  { id: "e3", nome: "Loteadora Vista", cnpj: "11.222.333/0001-44" },
];

export const clientesMock: Cliente[] = [
  { id: "c1", nome: "João Silva", documento: "123.456.789-00", telefone: "(11) 99999-1111" },
  { id: "c2", nome: "Maria Souza", documento: "987.654.321-00", telefone: "(11) 99999-2222" },
  { id: "c3", nome: "Pedro Lima", documento: "456.789.123-00", telefone: "(11) 99999-3333" },
  { id: "c4", nome: "Lucia Reis", documento: "321.654.987-00", telefone: "(11) 99999-4444" },
];

export const processosMock: Processo[] = [
  {
    id: "p1", clienteId: "c1", empresaId: "e1", responsavelId: "u3",
    origem: "Sienge", prioridade: "alta", status: "em_andamento",
    vencimento: "2025-03-10", diasVencidos: 58, valor: 12500,
    observacoes: "Cliente prometeu pagamento dia 15.", criadoEm: "2025-03-12",
  },
  {
    id: "p2", clienteId: "c2", empresaId: "e2", responsavelId: "u3",
    origem: "CV", prioridade: "media", status: "negociado",
    vencimento: "2025-04-01", diasVencidos: 36, valor: 8200,
    criadoEm: "2025-04-05",
  },
  {
    id: "p3", clienteId: "c3", empresaId: "e1", responsavelId: "u3",
    origem: "Sienge", prioridade: "baixa", status: "novo",
    vencimento: "2025-04-25", diasVencidos: 12, valor: 3400,
    criadoEm: "2025-04-26",
  },
  {
    id: "p4", clienteId: "c4", empresaId: "e3", responsavelId: "u4",
    origem: "Sienge", prioridade: "alta", status: "negativado",
    vencimento: "2024-12-01", diasVencidos: 157, valor: 22800,
    criadoEm: "2025-01-15",
  },
];

export const historicoMock: HistoricoAcao[] = [
  { id: "h1", processoId: "p1", tipo: "cobranca", descricao: "Ligação realizada", usuarioId: "u3", data: "2025-04-30" },
  { id: "h2", processoId: "p1", tipo: "observacao", descricao: "Cliente solicitou boleto novo", usuarioId: "u3", data: "2025-05-02" },
  { id: "h3", processoId: "p1", tipo: "status", descricao: "Status alterado para Em andamento", usuarioId: "u2", data: "2025-05-03" },
  { id: "h4", processoId: "p4", tipo: "negativacao", descricao: "Enviado para negativação Innove", usuarioId: "u4", data: "2025-04-20" },
];

export const tratativasMock: Tratativa[] = [
  { id: "t1", titulo: "Acordo padrão até 30 dias", descricao: "Conceder até 30 dias com 5% desconto.", criadoPor: "u2", atualizadoEm: "2025-04-10" },
  { id: "t2", titulo: "Negativação após 90 dias", descricao: "Após 90 dias sem retorno, encaminhar para negativação.", criadoPor: "u2", atualizadoEm: "2025-04-12" },
];

export const mapeamentoMock: MapeamentoCVSienge[] = [
  { id: "m1", billId: "BILL-1001", reservaId: "RES-2001", afiliado: "Afiliado A", empresaId: "e1" },
  { id: "m2", billId: "BILL-1002", reservaId: "RES-2002", afiliado: "Afiliado B", empresaId: "e2" },
];

export const empreendimentosMock: Empreendimento[] = [
  { id: "emp1", nome: "Residencial Alvorada I", empresaId: "e1", categoria: "Incorporacao" },
  { id: "emp2", nome: "Loteamento Vista Verde", empresaId: "e3", categoria: "Lote" },
  { id: "emp3", nome: "Empreendimento Novo X", empresaId: "e2", categoria: null },
  { id: "emp4", nome: "Empreendimento Novo Y", empresaId: "e1", categoria: null },
];

export const parametrosMock: ParametroSistema = {
  dataMinimaCobranca: "2024-01-01",
  documentosIgnorados: ["000.000.000-00"],
  apiKeyInnove: "sk_live_innove_abcdef123456",
  ultimaAlteracaoPor: "Ana Admin",
  ultimaAlteracaoEm: "2025-05-01 14:32",
};

export const notificacoesMock: Notificacao[] = [
  { id: "n1", tipo: "reserva_pendente", mensagem: "2 reservas pendentes de mapeamento", criadoEm: "2025-05-06", lida: false },
  { id: "n2", tipo: "empreendimento_sem_categoria", mensagem: "2 empreendimentos sem categorização", criadoEm: "2025-05-06", lida: false },
];

// Dados para gráficos do dashboard
export const evolucaoCobrancasMock = [
  { periodo: "Jan", cobrancas: 120, negativacoes: 12 },
  { periodo: "Fev", cobrancas: 145, negativacoes: 18 },
  { periodo: "Mar", cobrancas: 180, negativacoes: 22 },
  { periodo: "Abr", cobrancas: 210, negativacoes: 28 },
  { periodo: "Mai", cobrancas: 175, negativacoes: 19 },
];

export const empresasSemCobrancaMock = [
  { empresa: "Construtora Alvorada", dias: 45 },
  { empresa: "Incorporadora Sol", dias: 120 },
  { empresa: "Loteadora Vista", dias: 365 }, // cap visual
  { empresa: "Empresa Z", dias: 365 }, // representa "Infinito"
];
