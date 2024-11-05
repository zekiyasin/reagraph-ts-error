import React, { FC, useMemo, useState } from 'react';
import { ClusterGroup, animationConfig, useHoverIntent } from '../utils';
import { useSpring, a } from '@react-spring/three';
import { Color, DoubleSide } from 'three';
import { useStore } from '../store';
import { Label } from './Label';
import { useCursor } from 'glodrei';
import { ThreeEvent } from '@react-three/fiber';
import { useDrag } from '../utils/useDrag';
import { Vector3 } from 'three';
import { useCameraControls } from 'CameraControls';

export type ClusterEventArgs = Omit<ClusterGroup, 'position'>;

export interface ClusterProps extends ClusterGroup {
  /**
   * Whether the circle should be animated.
   */
  animated?: boolean;

  /**
   * The radius of the circle. Default 1.
   */
  radius?: number;

  /**
   * The padding of the circle. Default 20.
   */
  padding?: number;

  /**
   * The url for the label font.
   */
  labelFontUrl?: string;

  /**
   * Whether the node is disabled.
   */
  disabled?: boolean;

  /**
   * When the cluster was clicked.
   */
  onClick?: (cluster: ClusterEventArgs, event: ThreeEvent<MouseEvent>) => void;

  /**
   * When a cluster receives a pointer over event.
   */
  onPointerOver?: (
    cluster: ClusterEventArgs,
    event: ThreeEvent<PointerEvent>
  ) => void;

  /**
   * When cluster receives a pointer leave event.
   */
  onPointerOut?: (
    cluster: ClusterEventArgs,
    event: ThreeEvent<PointerEvent>
  ) => void;

  /**
   * Whether the cluster is draggable
   */
  draggable?: boolean;

  /**
   * Triggered after a cluster was dragged
   */
  onDragged?: (cluster: ClusterEventArgs) => void;
}

export const Cluster: FC<ClusterProps> = ({
  animated,
  position,
  padding,
  labelFontUrl,
  disabled,
  radius,
  nodes,
  label,
  onClick,
  onPointerOver,
  onPointerOut,
  draggable = false,
  onDragged
}) => {
  const theme = useStore(state => state.theme);
  const rad = Math.max(position.width, position.height) / 2;
  const offset = rad - radius + padding;
  const [active, setActive] = useState<boolean>(false);
  const center = useStore(state => state.centerPosition);
  const cameraControls = useCameraControls();

  const isActive = useStore(state =>
    state.actives?.some(id => nodes.some(n => n.id === id))
  );
  const hoveredNodeId = useStore(state => state.hoveredNodeId);

  const isSelected = useStore(state =>
    state.selections?.some(id => nodes.some(n => n.id === id))
  );

  const hasSelections = useStore(state => state.selections?.length > 0);

  const opacity = hasSelections
    ? isSelected || active || isActive
      ? theme.cluster?.selectedOpacity
      : theme.cluster?.inactiveOpacity
    : theme.cluster?.opacity;

  const labelPositionOffset = useMemo(() => {
    const defaultPosition = [0, -offset, 2];
    const themeOffset = theme.cluster?.label?.offset;
    if (themeOffset) {
      return [
        defaultPosition[0] - themeOffset[0],
        defaultPosition[1] - themeOffset[1],
        defaultPosition[2] - themeOffset[2]
      ];
    }

    return defaultPosition;
  }, [offset, theme.cluster?.label?.offset]);

  const { circleOpacity, circlePosition, labelPosition } = useSpring({
    from: {
      circlePosition: [center.x, center.y, -1],
      circleOpacity: 0,
      labelPosition: labelPositionOffset
    },
    to: {
      labelPosition: labelPositionOffset,
      circlePosition: position ? [position.x, position.y, -1] : [0, 0, -1],
      circleOpacity: opacity
    },
    config: {
      ...animationConfig,
      duration: animated ? undefined : 0
    }
  });

  const normalizedStroke = useMemo(
    () => new Color(theme.cluster?.stroke),
    [theme.cluster?.stroke]
  );

  const normalizedFill = useMemo(
    () => new Color(theme.cluster?.fill),
    [theme.cluster?.fill]
  );

  const draggingIds = useStore(state => state.draggingIds);
  const setDraggingIds = useStore(state => state.setDraggingIds);
  const setClusterPosition = useStore(state => state.setClusterPosition);

  const isDraggingCurrent = draggingIds.includes(label);
  const isDragging = draggingIds.length > 0;

  const bind = useDrag({
    draggable: draggable && !hoveredNodeId,
    position: {
      x: position.x,
      y: position.y,
      z: -1
    } as any,
    set: (pos: Vector3) => setClusterPosition(label, pos as any),
    onDragStart: () => {
      setDraggingIds([...new Set([...draggingIds, label])]);
      setActive(true);
    },
    onDragEnd: () => {
      setDraggingIds(draggingIds.filter(id => id !== label));
      setActive(false);
      onDragged?.({ nodes, label });
    }
  });

  useCursor(active && !isDragging && onClick !== undefined, 'pointer');
  useCursor(
    active && draggable && !isDraggingCurrent && onClick === undefined,
    'grab'
  );
  useCursor(isDraggingCurrent, 'grabbing');

  const { pointerOver, pointerOut } = useHoverIntent({
    disabled,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      setActive(true);
      cameraControls.controls.truckSpeed = 0;
      onPointerOver?.(
        {
          nodes,
          label
        },
        event
      );
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      setActive(false);
      cameraControls.controls.truckSpeed = 2.0;
      onPointerOut?.(
        {
          nodes,
          label
        },
        event
      );
    }
  });

  const cluster = useMemo(
    () =>
      theme.cluster && (
        <a.group
          position={circlePosition as any}
          onPointerOver={pointerOver}
          onPointerOut={pointerOut}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            if (!disabled && !isDraggingCurrent) {
              onClick?.({ nodes, label }, event);
            }
          }}
          {...(bind() as any)}
        >
          <mesh>
            <ringGeometry attach="geometry" args={[offset, 0, 128]} />
            <a.meshBasicMaterial
              attach="material"
              color={normalizedFill}
              transparent={true}
              depthTest={false}
              opacity={theme.cluster?.fill ? circleOpacity : 0}
              side={DoubleSide}
              fog={true}
            />
          </mesh>
          <mesh>
            <ringGeometry
              attach="geometry"
              args={[offset, rad + padding, 128]}
            />
            <a.meshBasicMaterial
              attach="material"
              color={normalizedStroke}
              transparent={true}
              depthTest={false}
              opacity={circleOpacity}
              side={DoubleSide}
              fog={true}
            />
          </mesh>
          {theme.cluster?.label && (
            <a.group position={labelPosition as any}>
              <Label
                text={label}
                opacity={opacity}
                fontUrl={labelFontUrl}
                stroke={theme.cluster.label.stroke}
                active={false}
                color={theme.cluster?.label.color}
                fontSize={theme.cluster?.label.fontSize ?? 12}
              />
            </a.group>
          )}
        </a.group>
      ),
    [
      theme.cluster,
      circlePosition,
      pointerOver,
      pointerOut,
      offset,
      normalizedFill,
      circleOpacity,
      rad,
      padding,
      normalizedStroke,
      labelPosition,
      label,
      opacity,
      labelFontUrl,
      disabled,
      onClick,
      nodes,
      bind,
      isDraggingCurrent
    ]
  );

  return cluster;
};

Cluster.defaultProps = {
  radius: 2,
  padding: 40,
  draggable: false
};
