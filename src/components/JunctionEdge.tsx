import { memo } from 'react';
import { BaseEdge, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

interface JunctionEdgeData {
  junctionId: string | null;
  renderEllipse: boolean;
  ellipseY: number;
}

const INTERACTION_WIDTH = 20;

function JunctionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const { junctionId, renderEllipse, ellipseY } = (data ?? {}) as Partial<JunctionEdgeData>;

  const ELLIPSE_RX = 20;
  const ELLIPSE_RY = 6;

  const selectedStyle = selected
    ? { ...style, stroke: '#3b82f6', strokeWidth: 2.5 }
    : style;

  if (junctionId && ellipseY != null) {
    const ellipseCenterY = ellipseY;
    const ellipseCenterX = targetX;

    const [upperPath] = getBezierPath({
      sourceX,
      sourceY,
      targetX: ellipseCenterX,
      targetY: ellipseCenterY - ELLIPSE_RY,
      sourcePosition,
      targetPosition,
    });

    const [lowerPath] = getBezierPath({
      sourceX: ellipseCenterX,
      sourceY: ellipseCenterY + ELLIPSE_RY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });

    return (
      <>
        <path
          d={upperPath}
          fill="none"
          stroke="transparent"
          strokeWidth={INTERACTION_WIDTH}
          className="react-flow__edge-interaction"
        />
        <BaseEdge id={`${id}-upper`} path={upperPath} style={selectedStyle} />
        {renderEllipse && (
          <>
            <ellipse
              cx={ellipseCenterX}
              cy={ellipseCenterY}
              rx={ELLIPSE_RX}
              ry={ELLIPSE_RY}
              className="junction-ellipse"
              fill="white"
              stroke={selected ? '#3b82f6' : 'var(--junction-color)'}
              strokeWidth={2}
            />
            <BaseEdge
              id={`${id}-lower`}
              path={lowerPath}
              style={selectedStyle}
              markerEnd={markerEnd}
            />
          </>
        )}
      </>
    );
  }

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={INTERACTION_WIDTH}
        className="react-flow__edge-interaction"
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={selectedStyle}
        markerEnd={markerEnd}
      />
    </>
  );
}

export const JunctionEdge = memo(JunctionEdgeComponent);
