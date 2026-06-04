export function generateBarChartSVG(data: { label: string; value: number }[], title: string): string {
  const width = 600;
  const height = 400;
  const padding = 40;
  const maxVal = Math.max(...data.map(d => d.value));
  const barWidth = (width - padding * 2) / data.length;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border-radius:8px; font-family:sans-serif;">`;
  
  // Title
  svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold">${title}</text>`;

  // Bars
  data.forEach((d, i) => {
    const barHeight = (d.value / maxVal) * (height - padding * 2 - 20);
    const x = padding + i * barWidth + 10;
    const y = height - padding - barHeight;
    
    // Bar
    svg += `<rect x="${x}" y="${y}" width="${barWidth - 20}" height="${barHeight}" fill="#3b82f6" rx="4" />`;
    // Value
    svg += `<text x="${x + (barWidth - 20) / 2}" y="${y - 5}" text-anchor="middle" font-size="12" fill="#333">${d.value}</text>`;
    // Label
    svg += `<text x="${x + (barWidth - 20) / 2}" y="${height - padding + 15}" text-anchor="middle" font-size="12" fill="#666">${d.label}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

export function generatePieChartSVG(data: { label: string; value: number }[], title: string): string {
  // Simplified pie chart placeholder
  return `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <circle cx="200" cy="200" r="150" fill="#3b82f6" />
    <text x="200" y="200" text-anchor="middle" fill="#fff">${title} (Mock Pie)</text>
  </svg>`;
}
