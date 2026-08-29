import { useEffect, useMemo, useRef, useState } from 'react';
import { OntologyObject } from '../../types';
import { AssociationRule, ImplicitRelation } from '../../inference/ImplicitRelationMiner';
import { computeForceLayout, GraphPositionMap } from './graphLayout';
import GraphWorker from './graphCompute.worker.ts?worker';

export interface GraphMiningResult {
  implicitRelations: ImplicitRelation[];
  associationRules: AssociationRule[];
  networkMetrics: unknown[];
  anomalies: unknown[];
}

const EMPTY_MINING: GraphMiningResult = {
  implicitRelations: [],
  associationRules: [],
  networkMetrics: [],
  anomalies: [],
};

export function useGraphCompute(
  objects: OntologyObject[],
  width: number,
  height: number,
) {
  const [positions, setPositions] = useState<GraphPositionMap>({});
  const [miningResult, setMiningResult] = useState<GraphMiningResult>(EMPTY_MINING);
  const workerRef = useRef<Worker | null>(null);
  const tokenRef = useRef(0);

  const signature = useMemo(
    () => `${objects.map(o => o.id).join('|')}:${width}x${height}`,
    [objects, width, height],
  );

  useEffect(() => {
    if (objects.length === 0) {
      setPositions({});
      setMiningResult(EMPTY_MINING);
      return;
    }

    const token = ++tokenRef.current;
    try {
      if (!workerRef.current) {
        workerRef.current = new GraphWorker();
      }
      const worker = workerRef.current;
      worker.onmessage = (event: MessageEvent<{ positions: GraphPositionMap; mining: GraphMiningResult }>) => {
        if (token !== tokenRef.current) return;
        setPositions(event.data.positions || {});
        setMiningResult(event.data.mining || EMPTY_MINING);
      };
      worker.onerror = () => {
        if (token !== tokenRef.current) return;
        setPositions(computeForceLayout(objects, width, height));
        setMiningResult(EMPTY_MINING);
      };
      worker.postMessage({ objects, width, height });
    } catch {
      setPositions(computeForceLayout(objects, width, height));
      setMiningResult(EMPTY_MINING);
    }

    return () => {
      tokenRef.current += 1;
    };
  }, [signature, objects, width, height]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return { positions, miningResult };
}
