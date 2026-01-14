import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface PlanoMap {
  id: string;
  plano_id: number;
  nome_exibicao: string;
  registro_produto: string | null;
  regra_valor: 'titular' | 'dependente' | 'agregado' | 'fixo' | 'manual';
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParentescoMap {
  id: string;
  parentesco_id: number;
  label: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CadastroConfig {
  id: number;
  ativar_lemmit: boolean;
  situacoes_que_barram: number[];
  planos_validos: number[];
  planos_ocultos: string[];
  created_at: string;
  updated_at: string;
}

interface ConfigCadastroContextData {
  planos: PlanoMap[];
  parentescos: ParentescoMap[];
  config: CadastroConfig | null;
  loading: boolean;
  loadPlanos: () => Promise<void>;
  loadParentescos: () => Promise<void>;
  loadConfig: () => Promise<CadastroConfig | null>;
  createPlano: (plano: Omit<PlanoMap, 'id' | 'created_at' | 'updated_at'>) => Promise<PlanoMap>;
  updatePlano: (id: string, plano: Partial<PlanoMap>) => Promise<void>;
  deletePlano: (id: string) => Promise<void>;
  createParentesco: (parentesco: Omit<ParentescoMap, 'id' | 'created_at' | 'updated_at'>) => Promise<ParentescoMap>;
  updateParentesco: (id: string, parentesco: Partial<ParentescoMap>) => Promise<void>;
  deleteParentesco: (id: string) => Promise<void>;
  updateConfig: (updates: Partial<CadastroConfig>) => Promise<void>;
}

const ConfigCadastroContext = createContext<ConfigCadastroContextData | undefined>(undefined);

export function ConfigCadastroProvider({ children }: { children: ReactNode }) {
  const [planos, setPlanos] = useState<PlanoMap[]>([]);
  const [parentescos, setParentescos] = useState<ParentescoMap[]>([]);
  const [config, setConfig] = useState<CadastroConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPlanos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cadastro_planos_map')
        .select('*')
        .order('plano_id', { ascending: true });

      if (error) throw error;
      setPlanos(data || []);
    } catch (error) {
      console.error('Error loading planos:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadParentescos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cadastro_parentesco_map')
        .select('*')
        .order('parentesco_id', { ascending: true });

      if (error) throw error;
      setParentescos(data || []);
    } catch (error) {
      console.error('Error loading parentescos:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('cadastro_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
      return data;
    } catch (error) {
      console.error('Error loading config:', error);
      throw error;
    }
  };

  const createPlano = async (plano: Omit<PlanoMap, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('cadastro_planos_map')
      .insert([plano])
      .select()
      .single();

    if (error) throw error;
    await loadPlanos();
    return data;
  };

  const updatePlano = async (id: string, plano: Partial<PlanoMap>) => {
    const { error } = await supabase
      .from('cadastro_planos_map')
      .update(plano)
      .eq('id', id);

    if (error) throw error;
    await loadPlanos();
  };

  const deletePlano = async (id: string) => {
    const { error } = await supabase
      .from('cadastro_planos_map')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await loadPlanos();
  };

  const createParentesco = async (parentesco: Omit<ParentescoMap, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('cadastro_parentesco_map')
      .insert([parentesco])
      .select()
      .single();

    if (error) throw error;
    await loadParentescos();
    return data;
  };

  const updateParentesco = async (id: string, parentesco: Partial<ParentescoMap>) => {
    const { error } = await supabase
      .from('cadastro_parentesco_map')
      .update(parentesco)
      .eq('id', id);

    if (error) throw error;
    await loadParentescos();
  };

  const deleteParentesco = async (id: string) => {
    const { error } = await supabase
      .from('cadastro_parentesco_map')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await loadParentescos();
  };

  const updateConfig = async (updates: Partial<CadastroConfig>) => {
    const { data, error } = await supabase
      .from('cadastro_config')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('Error updating config:', error);
      throw error;
    }

    if (data) {
      setConfig(data as CadastroConfig);
    }
  };

  useEffect(() => {
    loadPlanos();
    loadParentescos();
    loadConfig();

    const configSubscription = supabase
      .channel('cadastro_config_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cadastro_config',
          filter: 'id=eq.1'
        },
        (payload) => {
          console.log('Realtime update recebido:', payload.new);
          setConfig(payload.new as CadastroConfig);
        }
      )
      .subscribe();

    return () => {
      configSubscription.unsubscribe();
    };
  }, []);

  return (
    <ConfigCadastroContext.Provider
      value={{
        planos,
        parentescos,
        config,
        loading,
        loadPlanos,
        loadParentescos,
        loadConfig,
        createPlano,
        updatePlano,
        deletePlano,
        createParentesco,
        updateParentesco,
        deleteParentesco,
        updateConfig,
      }}
    >
      {children}
    </ConfigCadastroContext.Provider>
  );
}

export function useConfigCadastro() {
  const context = useContext(ConfigCadastroContext);
  if (context === undefined) {
    throw new Error('useConfigCadastro must be used within a ConfigCadastroProvider');
  }
  return context;
}
