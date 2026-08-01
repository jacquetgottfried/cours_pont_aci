// Présentation pure : ligne d'influence transversale (Recharts) avec longerons,
// zones de charge permanente ombrées et files de roues placées.
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DeckILView } from '@/api/types'

interface Props {
  il: DeckILView
  lengthUnit: string
  quantity?: 'M' | 'V'
  /** Repère de la section d'étude (ligne orange pointillée « section »). */
  targetX?: number
}

export function DeckILChart({ il, lengthUnit, quantity = 'M', targetX }: Props) {
  const points = il.x.map((x, i) => ({ x, y: il.y[i] }))
  const etaLabel = `η ${quantity}`

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={points} margin={{ top: 12, right: 20, bottom: 20, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="x"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => v.toFixed(0)}
          label={{ value: `position transversale [${lengthUnit}]`, position: 'insideBottom', offset: -10 }}
        />
        <YAxis tickFormatter={(v: number) => v.toFixed(2)} />
        <Tooltip
          formatter={(v) => [Number(v).toFixed(3), etaLabel]}
          labelFormatter={(l) => `x = ${Number(l).toFixed(2)} ${lengthUnit}`}
        />
        {il.dead_zones.map(([a, b], i) => (
          <ReferenceArea key={`z${i}`} x1={a} x2={b} fill="#059669" fillOpacity={0.08} />
        ))}
        <ReferenceLine y={0} stroke="#94a3b8" />
        {targetX !== undefined && (
          <ReferenceLine
            x={targetX}
            stroke="#b45309"
            strokeWidth={2}
            strokeDasharray="6 3"
            label={{ value: 'section', fill: '#b45309', position: 'top', fontSize: 11 }}
          />
        )}
        {il.wheels.map((w, i) => (
          <ReferenceLine key={`w${i}`} x={w.x} stroke="#dc2626" strokeDasharray="3 2" />
        ))}
        <Line
          type="linear"
          dataKey="y"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {il.support_positions.map((s) => (
          <ReferenceDot key={s} x={s} y={0} r={4} fill="#b91c1c" stroke="none" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
