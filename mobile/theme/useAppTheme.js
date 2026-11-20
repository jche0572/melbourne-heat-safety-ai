import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColor, darkColors, lightColors, darkStyles } from './palette';

const WeatherTheme = createContext({ weatherNight: false, setWeatherNight: () => {}, previewDark: null, setPreviewDark: () => {} });

export function AppThemeProvider({ children }) {
  const [weatherNight, setWeatherNight] = useState(false);
  const [previewDark, setPreviewDark] = useState(null);
  const value = useMemo(() => ({ weatherNight, setWeatherNight, previewDark, setPreviewDark }), [weatherNight, previewDark]);
  return React.createElement(WeatherTheme.Provider, { value }, children);
}

export function useAppTheme(forceDark) {
  const scheme = useColorScheme();
  const { weatherNight, setWeatherNight, previewDark, setPreviewDark } = useContext(WeatherTheme);
  const dark = forceDark ?? previewDark ?? (weatherNight || scheme === 'dark');
  return useMemo(() => ({
    dark, setWeatherNight, setPreviewDark, colors: dark ? darkColors : lightColors,
    color: (value, role) => dark ? darkColor(value, role) : value,
    styles: base => dark ? darkStyles(base) : base,
  }), [dark, setWeatherNight, setPreviewDark]);
}

export function useThemedStyles(base) {
  const theme = useAppTheme();
  const styles = useMemo(() => theme.styles(base), [theme, base]);
  return { styles, theme };
}
