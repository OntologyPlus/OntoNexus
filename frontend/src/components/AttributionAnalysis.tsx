import React, { useState, useEffect, useCallback } from 'react';
import { 
  AttributionResult, 
  ValidationResults, 
  AttributionMethod, 
  AttributionPeriod, 
  AttributionMetric,
  attributionEngine 
} from '../analysis/AttributionEngine';
import apiClient from '../api/client';

interface AttributionAnalysisProps {
  targetId: string;
  targetName?: string;
  initialMetric?: AttributionMetric;
  initialPeriod?: AttributionPeriod;
  initialMethod?: AttributionMethod;
}

const AttributionAnalysis: React.FC<AttributionAnalysisProps> = ({
  targetId,
  targetName,
  initialMetric = 'prescription_volume',
  initialPeriod = '90d',
  initialMethod = 'shapley',
}) => {
  const [metric, setMetric] = useState<AttributionMetric>(initialMetric);
  const [period, setPeriod] = useState<AttributionPeriod>(initialPeriod);
  const [method, setMethod] = useState<AttributionMethod>(initialMethod);
  const [loading, setLoading] = useState(false);
  const [attributionData, setAttributionData] = useState<AttributionResult | null>(null);
  const [validationData, setValidationData] = useState<ValidationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attribution' | 'validation' | 'recommendations'>('attribution');

  const fetchAttribution = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        target_id: targetId,
        target_metric: metric,
        period,
        method,
      });

      const response = await apiClient.request<AttributionResult>(`/api/reasoning/attribution?${params.toString()}`, {
        method: 'POST',
      });
      setAttributionData(response);

      const validationResponse = await apiClient.request<ValidationResults>(
        `/api/reasoning/attribution/validate?target_id=${targetId}&target_metric=${metric}&period=${period}`,
        { method: 'POST' }
      );
      setValidationData(validationResponse);
    } catch (err: any) {
      setError(err.response?.data?.detail || '获取归因分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [targetId, metric, period, method]);

  useEffect(() => {
    fetchAttribution();
  }, [fetchAttribution]);

  const renderLoading = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-500">正在分析归因...</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <p className="text-red-600">{error}</p>
    </div>
  );

  const renderControls = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">目标指标</label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as AttributionMetric)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="prescription_volume">处方量</option>
          <option value="achievement_rate">达成率</option>
          <option value="churn_risk">流失风险</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">分析周期</label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as AttributionPeriod)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="30d">近 30 天</option>
          <option value="90d">近 90 天</option>
          <option value="180d">近 180 天</option>
          <option value="1y">近 1 年</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">归因方法</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as AttributionMethod)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="shapley">Shapley 值归因</option>
          <option value="regression">回归系数归因</option>
          <option value="decomposition">时间序列分解</option>
          <option value="comparison">对比分析归因</option>
        </select>
      </div>
    </div>
  );

  const renderSummaryCard = () => {
    if (!attributionData) return null;

    const totalChange = attributionData.totalChange || 0;
    const unexplained = attributionData.unexplained || 0;
    const modelFit = attributionData.modelFit || 0;
    const direction = totalChange > 0 ? '上升' : totalChange < 0 ? '下降' : '持平';
    const changeColor = totalChange > 0 ? 'text-green-600' : totalChange < 0 ? 'text-red-600' : 'text-gray-600';

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {targetName || attributionData.targetName}
            </h3>
            <p className="text-sm text-gray-600">
              {attributionEngine.getMetricLabel(metric)} · {attributionEngine.getPeriodLabel(period)}
            </p>
          </div>
          <div className={`text-2xl font-bold ${changeColor}`}>
            {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500">总变化</p>
            <p className={`text-lg font-semibold ${changeColor}`}>
              {direction} {Math.abs(totalChange).toFixed(1)}
            </p>
          </div>

          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500">已解释</p>
            <p className="text-lg font-semibold text-blue-600">
              {((1 - unexplained / Math.abs(totalChange || 1)) * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500">模型拟合度</p>
            <p className="text-lg font-semibold text-indigo-600">
              {(modelFit * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500">归因方法</p>
            <p className="text-sm font-semibold text-purple-600 truncate">
              {attributionEngine.getMethodLabel(method)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderWaterfallChart = () => {
    if (!attributionData || !attributionData.attributionFactors || attributionData.attributionFactors.length === 0) return null;

    const factors = attributionEngine.sortFactorsByContribution(attributionData.attributionFactors);
    const contributions = factors.map(f => Math.abs(f.contribution || 0));
    const maxAbsContribution = contributions.length > 0 ? Math.max(...contributions) : 0;

    return (
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-800 mb-3">贡献度瀑布图</h4>
        <div className="space-y-3">
          {factors.map((factor) => {
            const contrib = factor.contribution || 0;
            const contribPct = factor.contributionPercent || 0;
            const direction = factor.direction || 'neutral';
            const barWidth = maxAbsContribution > 0 ? (Math.abs(contrib) / maxAbsContribution) * 100 : 0;
            const barColor = direction === 'positive' 
              ? 'bg-green-500' 
              : direction === 'negative' 
              ? 'bg-red-500' 
              : 'bg-gray-400';
            
            return (
              <div key={factor.factor} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{factor.factorLabel || factor.factor}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      direction === 'positive' ? 'text-green-600' : 
                      direction === 'negative' ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {contrib > 0 ? '+' : ''}{contrib.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {contribPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`${barColor} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500">
                  {factor.evidence}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFactorTable = () => {
    if (!attributionData || !attributionData.attributionFactors || attributionData.attributionFactors.length === 0) return null;

    const factors = attributionEngine.sortFactorsByContribution(attributionData.attributionFactors);

    return (
      <div className="mb-6 overflow-x-auto">
        <h4 className="text-md font-semibold text-gray-800 mb-3">因素详细分析</h4>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">因素</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">贡献值</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">贡献度</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">方向</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">置信度</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {factors.map((factor) => {
              const contrib = factor.contribution || 0;
              const contribPct = factor.contributionPercent || 0;
              const confidence = factor.confidence || 0;
              const dir = factor.direction || 'neutral';
              const label = factor.factorLabel || factor.factor;

              return (
              <tr key={factor.factor} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{label}</td>
                <td className={`px-4 py-3 text-sm text-right font-semibold ${
                  dir === 'positive' ? 'text-green-600' : 
                  dir === 'negative' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {contrib > 0 ? '+' : ''}{contrib.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700">
                  {contribPct.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    dir === 'positive' ? 'bg-green-100 text-green-800' : 
                    dir === 'negative' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {dir === 'positive' ? '↑ 正向' : 
                     dir === 'negative' ? '↓ 负向' : '— 中性'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          confidence > 0.8 ? 'bg-green-500' :
                          confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{(confidence * 100).toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderConfidenceRadar = () => {
    if (!validationData) return null;

    const sensitivityAnalysis = validationData.sensitivityAnalysis || {};
    const avgSensitivity = sensitivityAnalysis.avg_sensitivity || 0;

    const metrics = [
      { label: '整体置信度', value: validationData.overallConfidence || 0 },
      { label: '回测准确度', value: validationData.backtestAccuracy || 0 },
      { label: '稳定性分数', value: validationData.stabilityScore || 0 },
      { label: '敏感性评分', value: avgSensitivity },
    ];

    return (
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-800 mb-3">验证指标</h4>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      m.value > 0.7 ? 'bg-green-500' :
                      m.value > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${m.value * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                  {(m.value * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">验证状态</p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            validationData.validationStatus === 'validated' ? 'bg-green-100 text-green-800' :
            validationData.validationStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {validationData.validationStatus === 'validated' ? '✓ 已验证' :
             validationData.validationStatus === 'partial' ? '⚠ 部分验证' : '✗ 置信度低'}
          </span>
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!validationData || !validationData.recommendations) return null;

    return (
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-800 mb-3">验证建议</h4>
        <ul className="space-y-2">
          {validationData.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-blue-500 mt-0.5">•</span>
              <span className="text-sm text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderTabs = () => (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {[
          { id: 'attribution', label: '归因分析' },
          { id: 'validation', label: '验证结果' },
          { id: 'recommendations', label: '建议' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'attribution':
        return (
          <>
            {renderSummaryCard()}
            {renderWaterfallChart()}
            {renderFactorTable()}
          </>
        );
      case 'validation':
        return (
          <>
            {renderConfidenceRadar()}
          </>
        );
      case 'recommendations':
        return (
          <>
            {renderRecommendations()}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">归因分析</h2>
        <button
          onClick={fetchAttribution}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '分析中...' : '重新分析'}
        </button>
      </div>

      {renderControls()}
      {renderTabs()}

      {loading && renderLoading()}
      {error && renderError()}
      {!loading && !error && renderContent()}
    </div>
  );
};

export default AttributionAnalysis;
