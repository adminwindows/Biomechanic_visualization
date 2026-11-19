export function numberText(value: number) {
  return Number(value.toFixed(1)).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function formatPosition(value: number, unit = '°') {
  return numberText(value) + (unit === '°' ? '°' : ' ' + unit);
}

export function formatSigned(value: number | null, unit: string) {
  if (value === null) return 'Unavailable';
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  const sign = rounded === 0 ? '' : value > 0 ? '+' : '−';
  return sign + numberText(rounded) + (unit ? ' ' + unit : '');
}

export function describeResistanceDifference(a: number | null, b: number | null, unit: string, position: string) {
  if (a === null || b === null) {
    const missing = a === null && b === null ? 'both exercises' : a === null ? 'A' : 'B';
    return 'Resistance is unavailable for ' + missing + ' at ' + position + '.';
  }
  const difference = b - a;
  const magnitude = numberText(Math.abs(difference)) + ' ' + unit;
  if (difference === 0) return 'Both exercises have the same resistance at ' + position + '.';
  if (Math.abs(difference) < 0.05) return 'The difference at ' + position + ' is less than 0.1 ' + unit + '.';
  if (a * b < 0) {
    const opposing = a > 0 ? 'A' : 'B';
    const assisting = opposing === 'A' ? 'B' : 'A';
    return opposing + ' resists while ' + assisting + ' assists at ' + position + '. The difference is ' + magnitude + '.';
  }
  if (a <= 0 && b <= 0) {
    return (difference < 0 ? 'B' : 'A') + ' provides ' + magnitude + ' more assistance at ' + position + '.';
  }
  return (difference > 0 ? 'B' : 'A') + ' has ' + magnitude + ' more resistance at ' + position + '.';
}
