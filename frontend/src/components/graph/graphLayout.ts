import { OntologyObject } from '../../types';

export type GraphPositionMap = Record<string, { x: number; y: number }>;

export function computeForceLayout(
  nodes: OntologyObject[],
  svgWidth: number,
  svgHeight: number,
): GraphPositionMap {
  const nodeIds = nodes.map(n => n.id);
  if (nodeIds.length === 0) return {};

  const pos: GraphPositionMap = {};
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;
  const radius = Math.min(svgWidth, svgHeight) * 0.38;

  nodeIds.forEach((id, i) => {
    const angle = (i / nodeIds.length) * Math.PI * 2 - Math.PI / 2;
    pos[id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });

  const margin = 50;
  const alphaMin = 0.001;
  const linkStrength = 0.3;
  const linkDistance = 200;
  const chargeStrength = -1200;
  const centerStrength = 0.005;
  const collisionRadius = 55;

  const linkSet = new Set<string>();
  const uniqueLinks: Array<{ source: string; target: string }> = [];
  nodes.forEach(obj => {
    (obj.links || []).forEach(link => {
      const key = [obj.id, link.targetId].sort().join(':::');
      if (!linkSet.has(key)) {
        linkSet.add(key);
        uniqueLinks.push({ source: obj.id, target: link.targetId });
      }
    });
  });

  function tick(alpha: number) {
    const velocities: Record<string, { vx: number; vy: number }> = {};
    nodeIds.forEach(id => { velocities[id] = { vx: 0, vy: 0 }; });

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = pos[nodeIds[i]];
        const b = pos[nodeIds[j]];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);
        const force = chargeStrength / distSq;
        velocities[nodeIds[i]].vx += (dx / dist) * force;
        velocities[nodeIds[i]].vy += (dy / dist) * force;
        velocities[nodeIds[j]].vx -= (dx / dist) * force;
        velocities[nodeIds[j]].vy -= (dy / dist) * force;
      }
    }

    uniqueLinks.forEach(link => {
      const a = pos[link.source];
      const b = pos[link.target];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - linkDistance) * linkStrength;
      velocities[link.source].vx += (dx / dist) * force;
      velocities[link.source].vy += (dy / dist) * force;
      velocities[link.target].vx -= (dx / dist) * force;
      velocities[link.target].vy -= (dy / dist) * force;
    });

    nodeIds.forEach(id => {
      velocities[id].vx += (cx - pos[id].x) * centerStrength;
      velocities[id].vy += (cy - pos[id].y) * centerStrength;
    });

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = pos[nodeIds[i]];
        const b = pos[nodeIds[j]];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < collisionRadius * 2) {
          const overlap = (collisionRadius * 2 - dist) * 0.8;
          velocities[nodeIds[i]].vx -= (dx / dist) * overlap;
          velocities[nodeIds[i]].vy -= (dy / dist) * overlap;
          velocities[nodeIds[j]].vx += (dx / dist) * overlap;
          velocities[nodeIds[j]].vy += (dy / dist) * overlap;
        }
      }
    }

    nodeIds.forEach(id => {
      pos[id].x += velocities[id].vx * alpha;
      pos[id].y += velocities[id].vy * alpha;
      pos[id].x = Math.max(margin, Math.min(svgWidth - margin, pos[id].x));
      pos[id].y = Math.max(margin, Math.min(svgHeight - margin, pos[id].y));
    });
  }

  let alpha = 1;
  const alphaDecay = 0.022;
  for (let i = 0; i < 500; i++) {
    if (alpha < alphaMin) break;
    tick(alpha);
    alpha *= 1 - alphaDecay;
  }

  return pos;
}
