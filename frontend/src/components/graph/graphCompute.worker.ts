import { OntologyObject } from '../../types';
import { ImplicitRelationMiner } from '../../inference/ImplicitRelationMiner';
import { computeForceLayout } from './graphLayout';

export interface GraphComputeRequest {
  objects: OntologyObject[];
  width: number;
  height: number;
}

self.onmessage = (event: MessageEvent<GraphComputeRequest>) => {
  const { objects, width, height } = event.data || { objects: [], width: 0, height: 0 };
  const positions = computeForceLayout(objects || [], width || 1200, height || 700);
  const miner = new ImplicitRelationMiner(objects || []);
  const mining = miner.mineAll();
  postMessage({ positions, mining });
};
