import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: 'ADMINISTRADOR' | 'GERENTE' | 'GESTOR' | 'CADASTRO' | 'SUPERVISOR' | 'VENDEDOR' | 'ADESIONISTA';
  external_id: string | null;
  team_id: string | null;
  is_active: boolean;
  lemmit_limite_consultas: number | null;
  lemmit_consultas_mes_atual: number;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
