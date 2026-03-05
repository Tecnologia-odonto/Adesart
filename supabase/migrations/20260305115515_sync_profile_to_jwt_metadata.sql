/*
  # Sync Profile to JWT Metadata

  1. Problema
    - app_metadata do JWT não está populado com role, team_id, is_active
    - Precisamos sincronizar profiles → auth.users.raw_app_meta_data

  2. Solução
    - Criar trigger que atualiza auth.users.raw_app_meta_data
    - Sempre que profiles mudar, atualiza o JWT
    - Fazer sync inicial de todos os profiles existentes

  3. Segurança
    - raw_app_meta_data não pode ser alterado pelo usuário
    - Apenas admin pode alterar
    - Perfeito para autorização
*/

-- ============================================
-- FUNÇÃO PARA SINCRONIZAR PROFILE → JWT
-- ============================================

CREATE OR REPLACE FUNCTION sync_profile_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualiza raw_app_meta_data do auth.users
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(NEW.role)
      ),
      '{team_id}',
      CASE WHEN NEW.team_id IS NOT NULL 
        THEN to_jsonb(NEW.team_id::text)
        ELSE 'null'::jsonb
      END
    ),
    '{is_active}',
    to_jsonb(NEW.is_active)
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGER PARA SINCRONIZAR AUTOMATICAMENTE
-- ============================================

DROP TRIGGER IF EXISTS sync_profile_to_jwt_trigger ON profiles;

CREATE TRIGGER sync_profile_to_jwt_trigger
  AFTER INSERT OR UPDATE OF role, team_id, is_active
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_to_jwt();

-- ============================================
-- SINCRONIZAR TODOS OS PROFILES EXISTENTES
-- ============================================

DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id, role, team_id, is_active FROM profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(raw_app_meta_data, '{}'::jsonb),
          '{role}',
          to_jsonb(profile_record.role)
        ),
        '{team_id}',
        CASE WHEN profile_record.team_id IS NOT NULL 
          THEN to_jsonb(profile_record.team_id::text)
          ELSE 'null'::jsonb
        END
      ),
      '{is_active}',
      to_jsonb(profile_record.is_active)
    )
    WHERE id = profile_record.id;
  END LOOP;
END $$;
