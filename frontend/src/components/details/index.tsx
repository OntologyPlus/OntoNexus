import React from 'react';
import { OntologyObject } from '../../types';
import DoctorDetail from './DoctorDetail';
import HospitalDetail from './HospitalDetail';
import ProductDetail from './ProductDetail';
import SalesTargetDetail from './SalesTargetDetail';
import SalesRepDetail from './SalesRepDetail';
import GenericDetail from './GenericDetail';
import EventTimeline from './EventTimeline';

export { default as TimeSeriesDisplay } from './TimeSeriesDisplay';
export { default as RelatedLinksList } from './RelatedLinksList';
export { default as DoctorDetail } from './DoctorDetail';
export { default as HospitalDetail } from './HospitalDetail';
export { default as ProductDetail } from './ProductDetail';
export { default as SalesTargetDetail } from './SalesTargetDetail';
export { default as SalesRepDetail } from './SalesRepDetail';
export { default as GenericDetail } from './GenericDetail';
export { default as EventTimeline } from './EventTimeline';

const ObjectDetailPanel: React.FC<{ selectedObject: OntologyObject }> = ({ selectedObject }) => {
  const detailContent = (() => {
    switch (selectedObject.objectType) {
      case 'Doctor':
        return <DoctorDetail objectId={selectedObject.id} obj={selectedObject} />;
      case 'Hospital':
        return <HospitalDetail obj={selectedObject} />;
      case 'Product':
        return <ProductDetail obj={selectedObject} />;
      case 'SalesTarget':
        return <SalesTargetDetail obj={selectedObject} />;
      case 'SalesRep':
        return <SalesRepDetail obj={selectedObject} />;
      default:
        return <GenericDetail obj={selectedObject} />;
    }
  })();

  return (
    <div className="space-y-4">
      {detailContent}

      {selectedObject.events && selectedObject.events.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <EventTimeline events={selectedObject.events} />
        </div>
      )}
    </div>
  );
};

export default ObjectDetailPanel;
