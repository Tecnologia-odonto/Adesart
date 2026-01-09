import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../Card';
import { AlertCircle, CheckCircle, Clock, User } from 'lucide-react';

interface ApiLog {
  id: string;
  user_email: string | null;
  endpoint: string;
  method: string;
  request_body: any;
  response_body: any;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function ApiLogsTable() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('api_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter === 'success') {
        query = query.eq('success', true);
      } else if (filter === 'error') {
        query = query.eq('success', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  const filteredLogs = logs;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('success')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Sucesso
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Erros
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600">Carregando logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-8 text-gray-600">Nenhum log encontrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left p-3 font-medium text-gray-700">Status</th>
                <th className="text-left p-3 font-medium text-gray-700">Usuário</th>
                <th className="text-left p-3 font-medium text-gray-700">Endpoint</th>
                <th className="text-left p-3 font-medium text-gray-700">Código</th>
                <th className="text-left p-3 font-medium text-gray-700">Duração</th>
                <th className="text-left p-3 font-medium text-gray-700">Data/Hora</th>
                <th className="text-left p-3 font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    {log.success ? (
                      <CheckCircle className={`w-5 h-5 ${getStatusColor(true)}`} />
                    ) : (
                      <AlertCircle className={`w-5 h-5 ${getStatusColor(false)}`} />
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{log.user_email || 'Anônimo'}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm">{log.endpoint}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        log.status_code && log.status_code < 400
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {log.status_code || '-'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-gray-600">{formatDate(log.created_at)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <Card
            className="max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">Detalhes do Log</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="flex items-center gap-2">
                    {selectedLog.success ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-green-600 font-medium">Sucesso</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-600 font-medium">Erro</span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuário
                  </label>
                  <p className="text-gray-900">{selectedLog.user_email || 'Anônimo'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint
                  </label>
                  <p className="text-gray-900">{selectedLog.endpoint}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data/Hora
                  </label>
                  <p className="text-gray-900">{formatDate(selectedLog.created_at)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duração
                  </label>
                  <p className="text-gray-900">
                    {selectedLog.duration_ms ? `${selectedLog.duration_ms}ms` : '-'}
                  </p>
                </div>

                {selectedLog.error_message && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensagem de Erro
                    </label>
                    <p className="text-red-600 bg-red-50 p-3 rounded">
                      {selectedLog.error_message}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request Body
                  </label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.request_body, null, 2)}
                  </pre>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Response Body
                  </label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.response_body, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
