import React from 'react';
import { OntologyObject } from '../../types';
import DoctorTimeline from '../DoctorTimeline';
import { User, Briefcase, Stethoscope, Shield, Star, FileText, Calendar, CalendarClock } from 'lucide-react';
import TimeSeriesDisplay from './TimeSeriesDisplay';
import RelatedLinksList from './RelatedLinksList';

interface DoctorDetailProps {
  objectId: string;
  obj: OntologyObject;
}

const DoctorDetail: React.FC<DoctorDetailProps> = ({ objectId, obj }) => {
  const props = obj.properties || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Briefcase size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">职称</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.title || '主任医师'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Stethoscope size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">科室</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.department || '心内科'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 col-span-2">
          <div className="flex items-center space-x-2 mb-1">
            <Shield size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">专科</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(props.specialty) ? props.specialty : (props.specialty ? [props.specialty] : ['冠心病', '高血压'])).map((s: string, i: number) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{s}</span>
            ))}
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <FileText size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">处方权</span>
          </div>
          <div className={`text-sm font-medium ${props.prescription_power === true || props.prescription_power === '是' ? 'text-emerald-600' : 'text-gray-700'}`}>
            {props.prescription_power === true || props.prescription_power === '是' ? '有' : props.prescription_power === false || props.prescription_power === '否' ? '无' : '有'}
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Star size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">影响力评分</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.influence_score ?? '85'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <User size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">处方量</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{typeof props.prescription_volume === 'number' ? props.prescription_volume.toLocaleString() : (props.prescription_volume || '1,200')}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">最近拜访</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.last_visit_date || '2024-01-15'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 col-span-2">
          <div className="flex items-center space-x-2 mb-1">
            <CalendarClock size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">下次建议拜访</span>
          </div>
          <div className="text-sm font-medium text-amber-700">{props.next_recommended_visit_date || '2024-02-15'}</div>
        </div>
      </div>

      <TimeSeriesDisplay timeSeries={obj.timeSeries || {}} />

      <RelatedLinksList links={obj.links} />

      <DoctorTimeline doctorId={objectId} />
    </div>
  );
};

export default DoctorDetail;
