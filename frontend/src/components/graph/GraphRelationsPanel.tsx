import { ChevronRight, Sparkles } from 'lucide-react';
import { AssociationRule, ImplicitRelation } from '../../inference/ImplicitRelationMiner';
import { GraphMiningResult } from './useGraphCompute';

interface GraphRelationsPanelProps {
  miningResult: GraphMiningResult;
  selectedRelation: ImplicitRelation | null;
  onSelectRelation: (relation: ImplicitRelation) => void;
}

export default function GraphRelationsPanel({
  miningResult,
  selectedRelation,
  onSelectRelation,
}: GraphRelationsPanelProps) {
  if (miningResult.implicitRelations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-800">
        <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂未发现隐含关系</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white0/8 rounded-lg p-3 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-purple-400" />
          <span className="font-medium text-purple-400 text-sm">隐含关系挖掘结果</span>
        </div>
        <div className="text-xs text-purple-400/80">
          发现 {miningResult.implicitRelations.length} 条隐含关系
        </div>
      </div>
      {miningResult.implicitRelations.slice(0, 5).map((relation) => (
        <div
          key={relation.id}
          onClick={() => onSelectRelation(relation)}
          className={`p-3 rounded-lg border transition cursor-pointer ${
            selectedRelation?.id === relation.id
              ? 'border-purple-500/30 bg-white0/8'
              : 'border-gray-100 bg-gray-50 hover:border-purple-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-800">{relation.discoveryMethod}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              relation.confidence > 0.8 ? 'bg-white0/10 text-emerald-400' :
              relation.confidence > 0.6 ? 'bg-white0/10 text-amber-700' :
              'bg-white/5 text-gray-800'
            }`}>
              {(relation.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-sm font-medium text-gray-700">
            {relation.sourceName}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-800 my-1">
            <ChevronRight size={12} />
            <span className="text-purple-400 font-medium">{relation.relationType}</span>
            <ChevronRight size={12} />
          </div>
          <div className="text-sm font-medium text-gray-700">
            {relation.targetName}
          </div>
          {relation.evidence.length > 0 && (
            <div className="mt-2 text-xs text-gray-800 truncate">
              证据: {relation.evidence[0]}
            </div>
          )}
        </div>
      ))}
      {miningResult.associationRules.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-800 mb-2">关联规则</div>
          {miningResult.associationRules.slice(0, 3).map((rule: AssociationRule) => (
            <div key={rule.id} className="p-2 bg-gray-50 rounded text-xs mb-1">
              <div className="text-gray-800">
                {rule.antecedent.join(' → ')} ⇒ {rule.consequent.join(', ')}
              </div>
              <div className="text-gray-800 mt-1">
                置信度: {(rule.confidence * 100).toFixed(0)}% | Lift: {rule.lift.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
