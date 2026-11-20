import { useRef, useState } from "react";
import { PanResponder, useWindowDimensions } from "react-native";
import { useMiniMap } from "../components/MiniMapProvider";
import { bubbleBounds, clampBubble, isBubbleDrag } from "./bubbleDrag";

export default function useBubbleDrag(insets = {}) {
  const { width, height } = useWindowDimensions();
  const { bubblePosition, setBubblePosition } = useMiniMap();
  const [localPosition, setLocalPosition] = useState(null);
  const position = clampBubble(bubblePosition ?? localPosition, bubbleBounds(width, height, insets));
  const gesture = useRef({ start: position, dragged: false });
  const save = setBubblePosition || setLocalPosition;
  const latest = useRef(null);
  latest.current = { position, save, bounds: bubbleBounds(width, height, insets) };
  const move = (_, state) => {
    gesture.current.dragged = true;
    latest.current.save(clampBubble({ x: gesture.current.start.x + state.dx, y: gesture.current.start.y + state.dy }, latest.current.bounds));
  };
  const responder = useRef(null);
  if (!responder.current) responder.current = PanResponder.create({
    onStartShouldSetPanResponderCapture: () => {
      gesture.current = { start: latest.current.position, dragged: false };
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, state) => isBubbleDrag(state.dx, state.dy),
    onPanResponderGrant: move,
    onPanResponderMove: move,
    onPanResponderRelease: move,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  });
  return {
    position, panHandlers: responder.current.panHandlers,
    press: callback => event => {
      // Keyboard activation remains available after a mouse/touch drag.
      if (!gesture.current.dragged || event?.nativeEvent?.detail === 0) callback?.();
    },
  };
}
