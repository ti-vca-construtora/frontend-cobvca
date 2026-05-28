export type Perfil = "administrador" | "supervisor" | "cobrador" | "negativador";

export interface Usuario {
  id: string;
  userId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  empresaId?: string;
  avatarUrl?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  email?: string;
  telefone?: string;
}

export type StatusProcesso =
  | "novo"
  | "em_andamento"
  | "negociado"
  | "pago"
  | "negativado"
  | "encerrado";

export interface Processo {
  id: string;
  clienteId: string;
  empresaId: string;
  responsavelId: string;
  origem: "Sienge" | "CV";
  prioridade: "baixa" | "media" | "alta";
  status: StatusProcesso;
  vencimento: string;
  diasVencidos: number;
  valor: number;
  observacoes?: string;
  criadoEm: string;
}

export interface Tratativa {
  id: string;
  titulo: string;
  descricao: string;
  criadoPor: string;
  atualizadoEm: string;
}

export interface MapeamentoCVSienge {
  id: string;
  billId: string;
  reservaId: string;
  afiliado: string;
  empresaId: string;
}

export type CategoriaEmpreendimento = "Lote" | "Incorporacao" | null;

export interface Empreendimento {
  id: string;
  nome: string;
  empresaId: string;
  categoria: CategoriaEmpreendimento;
}

export interface ParametroSistema {
  dataMinimaCobranca: string;
  documentosIgnorados: string[];
  apiKeyInnove: string;
  ultimaAlteracaoPor: string;
  ultimaAlteracaoEm: string;
}

export interface Notificacao {
  id: string;
  tipo: "reserva_pendente" | "empreendimento_sem_categoria" | "info";
  mensagem: string;
  criadoEm: string;
  lida: boolean;
}

export interface HistoricoAcao {
  id: string;
  processoId: string;
  tipo: "cobranca" | "negativacao" | "observacao" | "status";
  descricao: string;
  usuarioId: string;
  data: string;
}
