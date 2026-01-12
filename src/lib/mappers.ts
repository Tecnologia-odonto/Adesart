import { formatCPF, formatDate, removeCPFMask } from './cpf';

export interface LemitResponse {
  nome?: string;
  nome_mae?: string;
  data_nascimento?: string;
  sexo?: string;
  celulares?: Array<{ numero: string }>;
  telefones_fixos?: Array<{ numero: string }>;
  emails?: Array<{ email: string }>;
  enderecos?: Array<{
    cep?: string;
    tipo_logradouro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  }>;
  [key: string]: unknown;
}

export interface CadastroContato {
  tipo: 'celular' | 'fixo' | 'email' | 'whatsapp';
  valor: string;
  principal?: boolean;
}

export interface CadastroEndereco {
  cep: string;
  tipoLogradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  idTipoLogradouro?: number;
  idBairro?: number;
  idMunicipio?: number;
  idUf?: number;
  ufSigla?: string;
}

export interface Dependente {
  tipo: number;
  nome: string;
  dataNascimento: string;
  cpf: string;
  sexo: number;
  sexoDescricao: string;
  plano: number;
  planoValor: string;
  nomeMae: string;
  carenciaAtendimento: number;
  funcionarioCadastro: number;
}

export interface ContatoResponsavelFinanceiro {
  tipo: number;
  dado: string;
}

export interface CadastroFormData {
  cpf: string;
  nome: string;
  dataNascimento: string;
  sexo: string;
  sexoCodigo: number;
  contatos: CadastroContato[];
  endereco: CadastroEndereco;
  nomeMae?: string;
  dependentes?: Dependente[];
  numeroMatricula?: string;
  codigoContrato?: string;
}

export function mapLemitToCadastro(lemitData: LemitResponse, cpf: string): Partial<CadastroFormData> {
  const contatos: CadastroContato[] = [];

  if (lemitData.celulares && Array.isArray(lemitData.celulares)) {
    lemitData.celulares.forEach((cel, index) => {
      if (cel.numero) {
        contatos.push({
          tipo: 'celular',
          valor: removeCPFMask(cel.numero),
          principal: index === 0,
        });
      }
    });
  }

  if (lemitData.telefones_fixos && Array.isArray(lemitData.telefones_fixos)) {
    lemitData.telefones_fixos.forEach((tel) => {
      if (tel.numero) {
        contatos.push({
          tipo: 'fixo',
          valor: removeCPFMask(tel.numero),
          principal: false,
        });
      }
    });
  }

  if (lemitData.emails && Array.isArray(lemitData.emails)) {
    lemitData.emails.forEach((emailObj, index) => {
      if (emailObj.email) {
        contatos.push({
          tipo: 'email',
          valor: emailObj.email,
          principal: index === 0,
        });
      }
    });
  }

  let endereco: CadastroEndereco | undefined;
  if (lemitData.enderecos && Array.isArray(lemitData.enderecos) && lemitData.enderecos.length > 0) {
    const endLemit = lemitData.enderecos[0];
    endereco = {
      cep: removeCPFMask(endLemit.cep || ''),
      tipoLogradouro: endLemit.tipo_logradouro || '',
      logradouro: endLemit.logradouro || '',
      numero: endLemit.numero || '',
      complemento: endLemit.complemento || '',
      bairro: endLemit.bairro || '',
      cidade: endLemit.cidade || '',
      uf: endLemit.uf || '',
    };
  }

  let sexoCodigo = 0;
  const sexoStr = (lemitData.sexo || '').toUpperCase();
  if (sexoStr === 'M' || sexoStr === 'MASCULINO') {
    sexoCodigo = 1;
  } else if (sexoStr === 'F' || sexoStr === 'FEMININO') {
    sexoCodigo = 0;
  }

  return {
    cpf: removeCPFMask(cpf),
    nome: lemitData.nome || '',
    dataNascimento: lemitData.data_nascimento || '',
    sexo: sexoStr,
    sexoCodigo,
    contatos,
    endereco,
    nomeMae: lemitData.nome_mae,
  };
}

export function buildERPPayload(cadastro: CadastroFormData, empresaId: number, vendedorCodigo?: string | null, funcionarioCadastroId?: number | null): Record<string, unknown> {
  const sexoDescricao = cadastro.sexoCodigo === 1 ? 'Masculino' : 'Feminino';

  const codigoParceiro = vendedorCodigo
    ? parseInt(vendedorCodigo)
    : (funcionarioCadastroId || 0);

  const contatosRespFin = cadastro.contatos.map(contato => {
    let tipo: number;
    if (contato.tipo === 'celular') {
      tipo = 8;
    } else if (contato.tipo === 'whatsapp') {
      tipo = 10;
    } else if (contato.tipo === 'fixo') {
      tipo = 1;
    } else if (contato.tipo === 'email') {
      tipo = 50;
    } else {
      tipo = 8;
    }

    return {
      tipo,
      dado: contato.valor,
    };
  });

  const responsavelFinanceiro: Record<string, any> = {
    codigoContrato: cadastro.codigoContrato || empresaId,
    nome: cadastro.nome,
    dataNascimento: formatDate(cadastro.dataNascimento),
    cpf: formatCPF(cadastro.cpf),
    sexo: cadastro.sexoCodigo,
    grupoFaturamento: 0,
    sexoDescricao: sexoDescricao,
    identidadeNumero: '123456789',
    identidadeOrgaoExpeditor: 'SSPDS',
    endereco: {
      cep: cadastro.endereco.cep,
      tipoLogradouro: cadastro.endereco.idTipoLogradouro?.toString() || '816',
      logradouro: cadastro.endereco.logradouro,
      numero: cadastro.endereco.numero,
      complemento: cadastro.endereco.complemento || 'N/D',
      bairro: cadastro.endereco.idBairro?.toString() || '1262',
      municipio: cadastro.endereco.idMunicipio?.toString() || '2',
      uf: cadastro.endereco.idUf?.toString() || '5',
      descricaoUf: cadastro.endereco.ufSigla || cadastro.endereco.uf,
    },
    contatoResponsavelFinanceiro: contatosRespFin,
    fl_AlteraSituacao: 1,
  };

  if (cadastro.numeroMatricula) {
    responsavelFinanceiro.Matricula = cadastro.numeroMatricula;
  }

  responsavelFinanceiro.dataApresentacao = new Date().toISOString();

  const payload = {
    dados: {
      parceiro: {
        codigo: codigoParceiro,
        tipoCobranca: 1,
      },
      parcelaRetidaComissao: '0',
      responsavelFinanceiro: responsavelFinanceiro,
      dependente: [
        ...(cadastro.dependentes || []).map((dep) => ({
          tipo: dep.tipo,
          nome: dep.nome,
          dataNascimento: dep.dataNascimento,
          cpf: formatCPF(dep.cpf),
          sexo: dep.sexo,
          sexoDescricao: dep.sexoDescricao,
          plano: dep.plano,
          planoValor: dep.planoValor,
          nomeMae: dep.nomeMae,
          carenciaAtendimento: dep.carenciaAtendimento,
          funcionarioCadastro: codigoParceiro,
        })),
      ],
    },
    empresa: empresaId.toString(),
  };

  return payload;
}
