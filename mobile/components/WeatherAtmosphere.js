import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, View } from 'react-native';
import { GLView } from 'expo-gl';
import { createWeatherRenderer } from '../utils/weatherAtmosphereRenderer';

// Text and controls stay in the caller, above this pointer-free background.
export default function WeatherAtmosphere({ scene, dark, cardRect, active = true, onReady, onError }) {
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const renderer = useRef(null);
  const size = useRef({ width: 0, height: 0 });
  const canvas = useRef(null);
  const latest = useRef({ scene, dark, cardRect, active, onReady });
  const atmosphericScene = ['sun', 'cloud', 'rain', 'night'].includes(scene) ? scene : null;
  latest.current = { scene: atmosphericScene, dark, cardRect: reduceTransparency ? null : cardRect, active, onReady, onError };
  const time = useRef(12);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  const [ready, setReady] = useState(false);

  const draw = useCallback(() => {
    if (!renderer.current || !latest.current.scene || !size.current.width || !size.current.height) return;
    try {
      if (renderer.current.draw({ ...latest.current, ...size.current, time: time.current }) !== false) {
        setReady(true);
        latest.current.onError?.(null);
      }
    } catch (error) {
      console.warn('Weather drawing failed:', error.message);
      latest.current.onError?.(error.message);
      renderer.current.dispose(); renderer.current = null;
      setReady(false); latest.current.onReady?.(false);
    }
  }, []);
  const initialize = useCallback(gl => {
    if (!gl) { latest.current.onReady?.(false); return; }
    try {
      renderer.current?.dispose();
      renderer.current = createWeatherRenderer(gl);
      draw();
    } catch (error) { console.warn('Weather renderer initialization failed:', error.message); latest.current.onError?.(error.message); setReady(false); latest.current.onReady?.(false); }
  }, [draw]);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (alive) setReduceMotion(value); })
      .catch(() => { if (alive) setReduceMotion(true); });
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then(value => { if (alive) setReduceTransparency(value); })
        .catch(() => { if (alive) setReduceTransparency(true); });
    } else setReduceTransparency(false);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', value => setAppActive(value === 'active'));
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { alive = false; motion.remove(); state.remove(); transparency.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || !canvas.current) return undefined;
    const element = canvas.current;
    const open = () => initialize(element.getContext('webgl', { alpha: false, antialias: false }));
    const lost = event => { event.preventDefault(); renderer.current = null; setReady(false); latest.current.onReady?.(false); };
    open();
    element.addEventListener('webglcontextlost', lost);
    element.addEventListener('webglcontextrestored', open);
    return () => { element.removeEventListener('webglcontextlost', lost); element.removeEventListener('webglcontextrestored', open); };
  }, [initialize]);
  useEffect(() => { latest.current.onReady?.(ready && !reduceTransparency); }, [ready, reduceTransparency]);
  useEffect(() => { draw(); }, [scene, dark, cardRect, reduceTransparency, draw]);
  useEffect(() => {
    if (!ready || !active || !appActive || reduceMotion || !atmosphericScene) return undefined;
    let frame, last = 0;
    const tick = now => {
      const visible = Platform.OS !== 'web' || !document.hidden;
      if (!visible) last = 0;
      else if (!last || now - last >= 1000 / 24) {
        if (last) time.current += Math.min((now - last) / 1000, .1);
        last = now; draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, active, appActive, reduceMotion, atmosphericScene, draw]);
  useEffect(() => () => { renderer.current?.dispose(); renderer.current = null; }, []);

  const layout = event => {
    size.current = event.nativeEvent.layout;
    if (canvas.current) {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.current.width = Math.max(1, Math.round(size.current.width * ratio));
      canvas.current.height = Math.max(1, Math.round(size.current.height * ratio));
    }
    draw();
  };
  return (
    <View collapsable={false} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={layout} style={[StyleSheet.absoluteFill, { backgroundColor: dark ? '#101d24' : '#eaf1ed' }]}>
      {Platform.OS === 'web'
        ? React.createElement('canvas', { ref: canvas, 'aria-hidden': true, style: { width: '100%', height: '100%', display: 'block', opacity: ready && atmosphericScene ? 1 : 0 } })
        : <GLView style={StyleSheet.absoluteFill} onContextCreate={initialize} msaaSamples={0} />}
      {Platform.OS !== 'web' && (!ready || !atmosphericScene) && <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? '#101d24' : '#eaf1ed' }]} />}
    </View>
  );
}
