export type FRTNodeType = 'injection' | 'desirable-effect' | 'negative-effect' | 'entity';

export type FRTNode = {
  id: string;
  text: string;
  type: FRTNodeType;
  injectionKind?: 'core' | 'supplementary';
  sourceUDEText?: string;
  addressed?: boolean;
  position?: { x: number; y: number };
  manuallyPositioned?: boolean;
};

export type FRTEdge = {
  id: string;
  source: string;
  target: string;
  junctionId?: string;
};

export type FRTTree = {
  schemaVersion: 1;
  id: string;
  title: string;
  goal: string;
  nodes: FRTNode[];
  edges: FRTEdge[];
  createdAt: string;
  updatedAt: string;
};
