import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Play, AlertCircle, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { OntologyAction } from '../types';
import { useOntologyContext } from '../contexts/OntologyContext';

interface ActionExecuteModalProps {
  action: OntologyAction;
  objectId: string;
  objectType: string;
  objectName: string;
  onClose: () => void;
}

const ActionExecuteModal: React.FC<ActionExecuteModalProps> = ({
  action,
  objectId,
  objectType: _objectType,
  objectName,
  onClose,
}) => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { executeAction } = useOntologyContext();

  const handleParamChange = (name: string, value: any) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    try {
      await executeAction(action.id, objectId, params);
      setResult({ success: true, message: `动作 "${action.name}" 执行成功` });
    } catch (e: any) {
      setResult({ success: false, message: e.message || '执行失败' });
    } finally {
      setExecuting(false);
    }
  };

  const missingRequired = action.parameters
    .filter(p => p.required && !params[p.name] && !p.defaultValue)
    .length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{action.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">对象: {objectName}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {action.description && (
            <p className="text-sm text-gray-600">{action.description}</p>
          )}

          {action.requiresApproval && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={16} className="text-amber-600" />
              <span className="text-sm text-amber-800">此动作需要审批</span>
            </div>
          )}

          {action.preconditions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">前置条件</h4>
              <div className="space-y-1">
                {action.preconditions.map((pc, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <ChevronRight size={12} className="text-gray-400" />
                    {pc}
                  </div>
                ))}
              </div>
            </div>
          )}

          {action.parameters.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">参数</h4>
              <div className="space-y-3">
                {action.parameters.map(param => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {param.name}
                      {param.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    {param.type === 'boolean' ? (
                      <select
                        value={params[param.name] ?? param.defaultValue ?? 'true'}
                        onChange={e => handleParamChange(param.name, e.target.value === 'true')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    ) : param.type === 'number' ? (
                      <input
                        type="number"
                        value={params[param.name] ?? param.defaultValue ?? ''}
                        onChange={e => handleParamChange(param.name, Number(e.target.value))}
                        placeholder={param.description || `输入${param.name}`}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={params[param.name] ?? param.defaultValue ?? ''}
                        onChange={e => handleParamChange(param.name, e.target.value)}
                        placeholder={param.description || `输入${param.name}`}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    )}
                    {param.description && param.type !== 'string' && (
                      <p className="text-xs text-gray-400 mt-1">{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {action.sideEffects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">副作用</h4>
              <div className="space-y-1">
                {action.sideEffects.map((se, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <ChevronRight size={12} className="text-gray-400" />
                    {se}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
            }`}>
              {result.success ? <CheckCircle size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
              <span className={`text-sm ${result.success ? 'text-emerald-800' : 'text-rose-800'}`}>{result.message}</span>
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            关闭
          </button>
          {!result?.success && (
            <button
              onClick={handleExecute}
              disabled={executing || missingRequired}
              className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {executing ? '执行中...' : '执行动作'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ActionExecuteModal;
