export const darkColors = { background: '#101C19', surface: '#1C2B26', text: '#E5F2EC', muted: '#ADC4B9', border: '#395248', primary: '#83D8B4' };
export const lightColors = { background: '#F4F8F5', surface: '#FFFFFF', text: '#173C31', muted: '#52645E', border: '#DCE7E1', primary: '#39775F' };

// Existing colors retain their semantic role: pale panels become tinted surfaces,
// dark ink becomes readable ink, and solid action colors retain white labels.
export function darkColor(value, role = 'color') {
  if (typeof value !== 'string' || value === 'transparent') return value;
  let channels, alpha = 1;
  if (/^#[\da-f]{3,8}$/i.test(value)) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
    if (hex.length !== 6 && hex.length !== 8) return value;
    channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    if (hex.length === 8) alpha = parseInt(hex.slice(6), 16) / 255;
  } else if (/^rgba?\(/.test(value)) {
    const parts = value.match(/[\d.]+/g).map(Number);
    channels = parts.slice(0, 3); alpha = parts[3] ?? 1;
  } else if (value === 'white') channels = [255, 255, 255];
  else if (value === 'black') channels = [0, 0, 0];
  else return value;
  const [r, g, b] = channels;
  const brightness = (r * .2126 + g * .7152 + b * .0722) / 255;
  if (role === 'shadowColor') return '#000000';
  if (role.toLowerCase().includes('border')) return darkColors.border;
  if (role === 'backgroundColor') {
    if (brightness < .62) return value;
    channels = channels.map((c, i) => Math.round(c * .12 + [12, 24, 19][i]));
  } else {
    if (brightness > .82) return value;
    const inkLift = Math.max(...channels) - Math.min(...channels) < 85 ? .82 : .5;
    channels = channels.map(c => Math.round(c + (255 - c) * inkLift));
  }
  return `rgba(${channels.join(',')},${alpha})`;
}

export function darkStyles(base) {
  return Object.fromEntries(Object.entries(base).map(([name, style]) => [name,
    Object.fromEntries(Object.entries(style).map(([property, value]) => [property,
      property === 'backgroundColor' && ['safeArea', 'screen', 'page', 'mobileContainer'].includes(name)
        ? darkColors.background : /color$/i.test(property) ? darkColor(value, property) : value
    ]))
  ]));
}
