import React, { createContext, useContext, useState } from "react";

const MiniMapContext = createContext({ minimize: null, openGoogleMaps: null });

export default function MiniMapProvider({ onMinimize, onOpenGoogleMaps, children }) {
  const [bubblePosition, setBubblePosition] = useState(null);
  return <MiniMapContext.Provider value={{ minimize: onMinimize, openGoogleMaps: onOpenGoogleMaps, bubblePosition, setBubblePosition }}>{children}</MiniMapContext.Provider>;
}

export function useMiniMap() { return useContext(MiniMapContext); }
