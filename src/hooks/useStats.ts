import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CadastroStats {
  cadastro_total: number;
  cadastro_cadastros: number;
  cadastro_dependentes: number;
  cadastro_incompletos: number;
  cadastro_incompletos_cadastros: number;
  cadastro_incompletos_dependentes: number;
  cadastro_enviados: number;
  cadastro_enviados_cadastros: number;
  cadastro_enviados_dependentes: number;
  inclusao_total: number;
  inclusao_cadastros: number;
  inclusao_dependentes: number;
  inclusao_incompletos: number;
  inclusao_incompletos_cadastros: number;
  inclusao_incompletos_dependentes: number;
  inclusao_enviados: number;
  inclusao_enviados_cadastros: number;
  inclusao_enviados_dependentes: number;
}

export function useStats() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<CadastroStats>({
    cadastro_total: 0,
    cadastro_cadastros: 0,
    cadastro_dependentes: 0,
    cadastro_incompletos: 0,
    cadastro_incompletos_cadastros: 0,
    cadastro_incompletos_dependentes: 0,
    cadastro_enviados: 0,
    cadastro_enviados_cadastros: 0,
    cadastro_enviados_dependentes: 0,
    inclusao_total: 0,
    inclusao_cadastros: 0,
    inclusao_dependentes: 0,
    inclusao_incompletos: 0,
    inclusao_incompletos_cadastros: 0,
    inclusao_incompletos_dependentes: 0,
    inclusao_enviados: 0,
    inclusao_enviados_cadastros: 0,
    inclusao_enviados_dependentes: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    console.log('[useStats] 🔄 fetchStats iniciado');
    console.log('[useStats] 👤 Profile ID:', profile?.id);

    if (!profile?.id) {
      console.log('[useStats] ❌ Sem profile.id, abortando');
      return;
    }

    try {
      setLoading(true);
      console.log('[useStats] ⏳ Loading iniciado');

      const startTime = performance.now();
      const { data, error } = await supabase.rpc('get_stats_from_cache', {
        p_user_id: profile.id,
      });
      const endTime = performance.now();

      console.log('[useStats] ⚡ RPC executado em', (endTime - startTime).toFixed(2), 'ms');
      console.log('[useStats] 📊 Data recebida:', data);
      console.log('[useStats] ❗ Error:', error);

      if (error) {
        console.error('[useStats] 🔴 Erro na RPC:', error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log('[useStats] ✅ Setando stats com dados:', data[0]);
        setStats(data[0]);
      } else {
        console.log('[useStats] ⚠️ Nenhum dado retornado, setando zeros');
        setStats({
          cadastro_total: 0,
          cadastro_cadastros: 0,
          cadastro_dependentes: 0,
          cadastro_incompletos: 0,
          cadastro_incompletos_cadastros: 0,
          cadastro_incompletos_dependentes: 0,
          cadastro_enviados: 0,
          cadastro_enviados_cadastros: 0,
          cadastro_enviados_dependentes: 0,
          inclusao_total: 0,
          inclusao_cadastros: 0,
          inclusao_dependentes: 0,
          inclusao_incompletos: 0,
          inclusao_incompletos_cadastros: 0,
          inclusao_incompletos_dependentes: 0,
          inclusao_enviados: 0,
          inclusao_enviados_cadastros: 0,
          inclusao_enviados_dependentes: 0
        });
      }
    } catch (error) {
      console.error('[useStats] 🔴 ERRO FATAL:', error);
    } finally {
      setLoading(false);
      console.log('[useStats] ✅ Loading finalizado');
    }
  }, [profile?.id]);

  return {
    stats,
    loading,
    fetchStats,
  };
}
