-- ============================================================================
-- BOOTSTRAP DO PRIMEIRO ADMINISTRADOR
-- ============================================================================
--
-- Este script deve ser executado APÓS criar o primeiro usuário no Supabase Auth.
--
-- PASSOS:
-- 1. Vá em Authentication > Users no Supabase Dashboard
-- 2. Clique em "Add user" > "Create new user"
-- 3. Preencha:
--    - Email: admin@adesaomais.com (ou seu email desejado)
--    - Password: sua-senha-segura
--    - Auto Confirm User: SIM (marque esta opção)
-- 4. Clique em "Create user"
-- 5. Copie o UUID do usuário criado (aparece na lista de usuários)
-- 6. Cole o UUID abaixo substituindo 'COLE_O_USER_ID_AQUI'
-- 7. Execute este script no SQL Editor do Supabase
--
-- ============================================================================

-- IMPORTANTE: Substitua 'COLE_O_USER_ID_AQUI' pelo UUID real do usuário
-- Exemplo: '123e4567-e89b-12d3-a456-426614174000'

INSERT INTO profiles (id, name, email, role, is_active)
VALUES (
  'COLE_O_USER_ID_AQUI',  -- UUID do usuário do Auth
  'Administrador Principal',
  'admin@adesaomais.com',  -- Mesmo email usado no Auth
  'ADMINISTRADOR',
  true
);

-- Verificar se foi criado com sucesso
SELECT * FROM profiles WHERE role = 'ADMINISTRADOR';

-- ============================================================================
-- OPCIONAL: Criar equipes de exemplo
-- ============================================================================

-- Descomente as linhas abaixo se quiser criar equipes de exemplo

-- INSERT INTO teams (name, is_active) VALUES
--   ('Equipe Vendas', true),
--   ('Equipe Adesão', true),
--   ('Equipe Suporte', true);

-- Ver equipes criadas
-- SELECT * FROM teams ORDER BY name;
