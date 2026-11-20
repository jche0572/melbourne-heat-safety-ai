export const BUBBLE_WIDTH = 54;
export const BUBBLE_HEIGHT = 106;
export const DRAG_THRESHOLD = 8;

export function bubbleBounds(width, height, insets = {}) {
  const left = Math.min((insets.left || 0) + 12, Math.max(0, width - BUBBLE_WIDTH));
  const top = Math.min((insets.top || 0) + 12, Math.max(0, height - BUBBLE_HEIGHT));
  return {
    left, top,
    right: Math.max(left, width - (insets.right || 0) - 12 - BUBBLE_WIDTH),
    bottom: Math.max(top, height - Math.max(96, (insets.bottom || 0) + 76) - BUBBLE_HEIGHT),
  };
}

export function clampBubble(position, bounds) {
  return {
    x: Math.min(bounds.right, Math.max(bounds.left, position?.x ?? bounds.right)),
    y: Math.min(bounds.bottom, Math.max(bounds.top, position?.y ?? bounds.bottom)),
  };
}

export function isBubbleDrag(dx, dy) {
  return Math.hypot(dx, dy) > DRAG_THRESHOLD;
}
