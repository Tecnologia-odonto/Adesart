/*
  # Habilitar Realtime para profiles e api_logs
  
  1. Configurações
    - Habilita realtime para tabela `profiles` (especificamente para lemmit_balance)
    - Habilita realtime para tabela `api_logs` (para novos logs de consulta)
  
  2. Motivo
    - Permite que o frontend receba atualizações em tempo real do saldo
    - Permite que a lista de logs seja atualizada automaticamente
*/

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE api_logs;
