/*
  # Corrigir recursão infinita em política RLS de lemmit_balance
  
  1. Problema
    - A política "Admins can update lemmit balance" causa recursão infinita
    - Ela faz SELECT na tabela profiles dentro de uma política de profiles
  
  2. Solução
    - Remover a política problemática
    - A funcionalidade já é coberta pela política "Admins can update any profile"
    - Administradores podem atualizar qualquer campo de profiles, incluindo lemmit_balance
  
  3. Segurança
    - Mantém a restrição: somente ADMINISTRADOR pode editar profiles de outros usuários
    - Usuários comuns podem atualizar apenas seu próprio perfil
*/

DROP POLICY IF EXISTS "Admins can update lemmit balance" ON profiles;
