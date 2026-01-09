import { useState, useEffect } from 'react';
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

export function useConfigCadastro() {
  const [planos, setPlanos] = useState<PlanoMap[]>([]);
  const [parentescos, setParentescos] = useState<ParentescoMap[]>([]);
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

  useEffect(() => {
    loadPlanos();
    loadParentescos();
  }, []);

  return {
    planos,
    parentescos,
    loading,
    loadPlanos,
    loadParentescos,
    createPlano,
    updatePlano,
    deletePlano,
    createParentesco,
    updateParentesco,
    deleteParentesco,
  };
}
