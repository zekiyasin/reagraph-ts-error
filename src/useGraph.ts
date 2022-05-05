import { useRef, useState, useCallback, useEffect } from 'react';
import { nodeSizeProvider, SizingType } from './sizing';
import { LayoutTypes, layoutProvider, LayoutStrategy } from './layout';
import ngraph from 'ngraph.graph';
import { calcLabelVisibility, LabelVisibilityType } from './utils/visibility';
import { tick } from './layout/layoutUtils';
import {
  GraphEdge,
  GraphNode,
  InternalGraphEdge,
  InternalGraphNode
} from './types';

export interface GraphInputs {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layoutType?: LayoutTypes;
  sizingType?: SizingType;
  labelType?: LabelVisibilityType;
  sizingAttribute?: string;
}

export const useGraph = ({
  layoutType,
  sizingType,
  labelType,
  sizingAttribute,
  nodes,
  edges
}: GraphInputs) => {
  const graph = useRef<any>(ngraph());
  const layoutMounted = useRef<boolean>(false);
  const layout = useRef<LayoutStrategy | null>(null);
  const [internalNodes, setInternalNodes] = useState<InternalGraphNode[]>([]);
  const [internalEdges, setInternalEdges] = useState<InternalGraphEdge[]>([]);

  const updateLayout = useCallback(
    (curLayout?: any) => {
      layout.current =
        curLayout ||
        layoutProvider({
          type: layoutType,
          graph: graph.current
        });

      tick(layout.current, () => {
        const result = transformGraph({
          graph: graph.current,
          layout: layout.current,
          sizingType,
          labelType,
          sizingAttribute
        });

        setInternalEdges(result.edges);
        setInternalNodes(result.nodes);
      });
    },
    [graph, layoutType, sizingType, sizingAttribute, labelType]
  );

  // Create the nggraph object
  useEffect(() => {
    buildGraph(graph.current, nodes, edges);
    updateLayout();

    // queue this in a frame so it only happens after the graph is built
    requestAnimationFrame(() => (layoutMounted.current = true));

    // eslint-disable-next-line
  }, [nodes, edges, graph]);

  // Update layout on type changes
  useEffect(() => {
    if (layoutMounted.current) {
      updateLayout();
    }
  }, [graph, layoutType, updateLayout]);

  // Update layout on size, label changes
  useEffect(() => {
    if (layoutMounted.current) {
      updateLayout(layout.current);
    }
  }, [graph, sizingType, sizingAttribute, labelType, updateLayout]);

  return {
    graph: graph.current,
    nodes: internalNodes,
    edges: internalEdges
  };
};

function buildGraph(graph, nodes: GraphNode[], edges: GraphEdge[]) {
  graph.clear();
  graph.beginUpdate();

  for (const node of nodes) {
    graph.addNode(node.id, node);
  }

  for (const edge of edges) {
    graph.addLink(edge.source, edge.target, edge);
  }

  graph.endUpdate();
}

interface TransformGraphInput {
  graph: any;
  layout: any;
  sizingType?: SizingType;
  labelType?: LabelVisibilityType;
  sizingAttribute?: string;
}

function transformGraph({
  graph,
  layout,
  sizingType,
  labelType,
  sizingAttribute
}: TransformGraphInput) {
  const nodes = [];
  const edges = [];
  const map = new Map();

  const sizes = nodeSizeProvider(graph, sizingType, sizingAttribute);
  const nodeCount = graph.getNodesCount();
  const checkVisibility = calcLabelVisibility(nodeCount, labelType);

  graph.forEachNode((node: InternalGraphNode) => {
    if (node.data) {
      const position = layout.getNodePosition(node.id);
      const { data, fill, icon, label, size, ...rest } = node.data;
      const nodeSize = sizes.getSizeForNode(node.id, size);
      const labelVisible = checkVisibility('node', nodeSize);

      const n = {
        ...node,
        size: nodeSize,
        labelVisible,
        label,
        icon,
        fill,
        data: {
          ...rest,
          ...(data || {})
        },
        position: {
          ...position,
          z: position.z || 1
        }
      };

      map.set(node.id, n);
      nodes.push(n);
    }
  });

  graph.forEachLink((link: InternalGraphEdge) => {
    const from = map.get(link.fromId);
    const to = map.get(link.toId);

    if (from && to) {
      const { data, id, label, size, ...rest } = link.data;
      const labelVisible = checkVisibility('edge', link.size);

      edges.push({
        ...link,
        id,
        label,
        labelVisible,
        size,
        from,
        to,
        data: {
          ...rest,
          ...(data || {})
        },
        position: {
          from: from.position,
          to: to.position
        }
      });
    }
  });

  return {
    nodes,
    edges
  };
}