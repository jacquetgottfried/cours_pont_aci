// Présentation pure : une ligne d'enveloppe (Recharts) — max / min / permanent + points.
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DistributedEnvelopeResponse } from '@/api/types'

interface Props {
  data: DistributedEnvelopeResponse
  lengthUnit: string
  /** moment : marque max mi-travée (rouge) + max sur appui (bleu). shear : gouvernant. */
  kind: 'moment' | 'shear'
}

export function EnvelopeChart({ data, lengthUnit, kind }: Props) {
  const u = data.unit
  const rows = data.positions.map((x, i) => ({
    x,
    max: data.max[i],
    min: data.min[i],
    full: data.full[i],
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 10, right: 20, bottom: 22, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="x"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => v.toFixed(0)}
          label={{ value: `x [${lengthUnit}]`, position: 'insideBottom', offset: -12 }}
        />
        <YAxis tickFormatter={(v: number) => v.toFixed(0)} />
        <Tooltip
          formatter={(v) => Number(v).toFixed(2)}
          labelFormatter={(l) => `x = ${Number(l).toFixed(2)} ${lengthUnit}`}
        />
        <Legend />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Line
          name={`Alterné max (${u})`}
          dataKey="max"
          stroke="#dc2626"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          name={`Alterné min (${u})`}
          dataKey="min"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          name={`Permanent (${u})`}
          dataKey="full"
          stroke="#6b7280"
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
        />
        {kind === 'moment' &&
          data.midspan_points.map((p, i) => (
            <ReferenceDot
              key={`mid${i}`}
              x={p.position}
              y={p.value}
              r={5}
              fill="#dc2626"
              stroke="white"
            />
          ))}
        {kind === 'moment' &&
          data.support_points.map((p, i) => (
            <ReferenceDot
              key={`sup${i}`}
              x={p.position}
              y={p.value}
              r={5}
              fill="#2563eb"
              stroke="white"
            />
          ))}
        {kind === 'shear' && (
          <ReferenceDot
            x={data.governing.position}
            y={data.governing.value}
            r={6}
            fill="#b45309"
            stroke="white"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
