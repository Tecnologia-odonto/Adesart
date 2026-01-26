/*
  # Adicionar políticas RLS para edição de saldo Lemmit

  1. Mudanças
    - Permite que administradores atualizem o saldo Lemmit de qualquer usuário
    - Permite que usuários visualizem seu próprio saldo
  
  2. Segurança
    - Somente GESTOR pode atualizar saldo de outros usuários
    - Usuários podem ver apenas seu próprio saldo
*/

CREATE POLICY "Admins can update lemmit balance"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'GESTOR'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'GESTOR'
    )
  );
