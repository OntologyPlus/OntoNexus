import React from 'react';
import { Brain, Calendar, CheckCircle, FileText, User, XCircle, XOctagon } from 'lucide-react';
import { motion } from 'framer-motion';
import { COPY, typeLabel } from '../copy';
import { HubAction } from '../hooks/useHubOverview';
import { useAuth } from '../contexts/AuthContext';

interface ApproveModalProps {
  action: HubAction;
  error?: string;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const ApproveModal: React.FC<ApproveModalProps> = ({ action, error, onClose, onApprove, onReject }) => {
  const { user } = useAuth();
  const evidence = action.reasoningChain?.evidence || [];
  const isSubmitter = Boolean(action.proposedBy && action.proposedBy === user?.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-100/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/20">
                <FileText className="text-brand-400" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-700">{action.title}</h2>
                <p className="text-sm text-gray-800 mt-0.5">建议详情</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2.5 hover:bg-gray-50 rounded-xl transition-colors">
              <XCircle size={22} className="text-gray-800" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
              <FileText size={16} className="mr-2 text-brand-400" />
              说明
            </h3>
            <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl leading-relaxed">{action.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                <User size={16} className="text-gray-800" />
                <span className="text-xs font-bold text-gray-700">对象</span>
              </div>
              <div className="text-sm text-gray-600">{action.entityName}</div>
              <div className="text-xs text-gray-500 mt-1">{typeLabel(action.entityType)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar size={16} className="text-gray-800" />
                <span className="text-xs font-bold text-gray-700">提交时间</span>
              </div>
              <div className="text-sm text-gray-600">
                {action.timestamp ? new Date(action.timestamp).toLocaleString('zh-CN') : '—'}
              </div>
            </div>
          </div>

          {action.reasoningChain?.conclusion && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                <Brain size={16} className="mr-2 text-purple-400" />
                {COPY.today.evidence}
              </h3>
              <div className="mb-3 p-3 bg-brand-50 rounded-xl">
                <div className="text-sm font-medium text-gray-700 mb-1">结论</div>
                <div className="text-sm text-gray-600">{action.reasoningChain.conclusion}</div>
              </div>
              <div className="space-y-2">
                {evidence.map((item: any, index: number) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-400">{index + 1}</span>
                    </div>
                    <div className="text-sm text-gray-700">{item.content || item.observation || item.source}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4 border-t border-gray-100">
            {error ? <div className="text-xs text-rose-600 w-full">{error}</div> : null}
            {isSubmitter ? (
              <p className="text-sm text-amber-700">{COPY.today.needManager}</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onReject(action.id)}
                  className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center space-x-2"
                >
                  <XOctagon size={18} />
                  <span className="font-medium">{COPY.today.reject}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(action.id)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:from-brand-600 transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle size={18} />
                  <span className="font-medium">{COPY.today.approve}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ApproveModal;
