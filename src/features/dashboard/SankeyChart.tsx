import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { formatMoney } from '../../lib/money';
import type { SankeyRawNode, SankeyRawLink } from './useDashboard';

interface Props {
  nodes: SankeyRawNode[];
  links: SankeyRawLink[];
  width?: number;
  height?: number;
}

interface LayoutNode extends SankeyRawNode {
  x: number; y: number; w: number; h: number;
  outCursor: number; inCursor: number;
}

interface LayoutLink {
  path: string;
  color: string;
  opacity: number;
  value: number;
  label: string;
}

const NODE_W  = 16;
const GAP     = 6;
const LABEL_W = 130;

function computeLayout(
  nodes: SankeyRawNode[],
  links: SankeyRawLink[],
  W: number,
  H: number,
): { lNodes: LayoutNode[]; lLinks: LayoutLink[] } {
  const colX = [LABEL_W, W / 2 - NODE_W / 2, W - LABEL_W - NODE_W];

  // Group + sort nodes by column (largest first)
  const byCols: SankeyRawNode[][] = [[], [], []];
  for (const n of nodes) byCols[n.column].push(n);
  for (const col of byCols) col.sort((a, b) => b.value - a.value);

  const lNodeMap = new Map<string, LayoutNode>();

  for (let ci = 0; ci < 3; ci++) {
    const colNodes = byCols[ci];
    if (!colNodes.length) continue;
    const totalVal = colNodes.reduce((s, n) => s + n.value, 0);
    const totalGap = GAP * (colNodes.length - 1);
    const avail    = H - totalGap;

    let y = 0;
    for (const n of colNodes) {
      const h = Math.max(4, (n.value / totalVal) * avail);
      lNodeMap.set(n.id, { ...n, x: colX[ci], y, w: NODE_W, h, outCursor: 0, inCursor: 0 });
      y += h + GAP;
    }
  }

  const lLinks: LayoutLink[] = [];

  for (const link of links) {
    const src = lNodeMap.get(link.sourceId);
    const tgt = lNodeMap.get(link.targetId);
    if (!src || !tgt || link.value <= 0) continue;

    const srcH = (link.value / src.value) * src.h;
    const tgtH = (link.value / tgt.value) * tgt.h;

    const x0 = src.x + src.w;
    const y0a = src.y + src.outCursor;
    const y0b = y0a + srcH;
    src.outCursor += srcH;

    const x1 = tgt.x;
    const y1a = tgt.y + tgt.inCursor;
    const y1b = y1a + tgtH;
    tgt.inCursor += tgtH;

    const mx = (x0 + x1) / 2;
    const path =
      `M${x0},${y0a} C${mx},${y0a} ${mx},${y1a} ${x1},${y1a}` +
      ` L${x1},${y1b} C${mx},${y1b} ${mx},${y0b} ${x0},${y0b} Z`;

    lLinks.push({ path, color: src.color, opacity: 0.35, value: link.value, label: formatMoney(link.value) });
  }

  return { lNodes: [...lNodeMap.values()], lLinks };
}

export default function SankeyChart({ nodes, links, width = 800, height = 360 }: Props) {
  const theme = useTheme();
  const textColor = theme.palette.text.primary;
  const secColor  = theme.palette.text.secondary;

  const { lNodes, lLinks } = useMemo(
    () => computeLayout(nodes, links, width, height),
    [nodes, links, width, height],
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ overflow: 'visible', display: 'block' }}
      aria-label="Cash flow Sankey diagram"
    >
      {/* Links */}
      {lLinks.map((l, i) => (
        <path key={i} d={l.path} fill={l.color} opacity={l.opacity}>
          <title>{l.label}</title>
        </path>
      ))}

      {/* Nodes + labels */}
      {lNodes.map(n => {
        const isLeft  = n.column === 0;
        const isRight = n.column === 2;
        const isMid   = n.column === 1;
        const labelX  = isLeft  ? n.x - 6
                      : isRight ? n.x + n.w + 6
                      : n.x + n.w / 2;
        const anchor  = isLeft ? 'end' : isRight ? 'start' : 'middle';
        const labelY  = isMid ? n.y - 4 : n.y + n.h / 2;
        const valY    = isMid ? n.y + n.h + 12 : n.y + n.h / 2 + 14;

        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} rx={3} />
            <text
              x={labelX} y={labelY}
              textAnchor={anchor}
              dominantBaseline={isMid ? 'auto' : 'middle'}
              fontSize={11}
              fill={textColor}
              fontWeight={500}
            >
              {n.label}
            </text>
            <text
              x={labelX} y={valY}
              textAnchor={anchor}
              dominantBaseline={isMid ? 'auto' : 'middle'}
              fontSize={10}
              fill={secColor}
            >
              {formatMoney(n.value)}
            </text>
          </g>
        );
      })}

      {/* Column headers */}
      {[
        { label: 'Income', x: LABEL_W + NODE_W / 2 },
        { label: 'Fund allocation', x: width / 2 },
        { label: 'Expenses & surplus', x: width - LABEL_W - NODE_W / 2 },
      ].map(h => (
        <text key={h.label} x={h.x} y={-14} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={secColor} letterSpacing={0.5}>
          {h.label.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
