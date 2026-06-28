// Présentation pure : trace une ligne d'influence déjà calculée (Recharts).
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
import type { InfluenceLineResponse } from '@/api/types'

/** Zone chargée à ombrer (le « damier » du chargement alterné DC/DW). */
export interface ShadedZone {
  range: [number, number]
  color: string
}

interface Props {
  data: InfluenceLineResponse
  lengthUnit: string
  zones?: ShadedZone[]
}

export function InfluenceLineChart({ data, lengthUnit, zones }: Props) {
  const points = data.x.map((x, i) => ({ x, y: data.y[i] }))
  const q = data.meta.quantity

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={points} margin={{ top: 12, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="x"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickCount={9}
          tickFormatter={(v: number) => v.toFixed(0)}
          label={{ value: `x [${lengthUnit}]`, position: 'insideBottom', offset: -12 }}
        />
        <YAxis
          tickFormatter={(v: number) => v.toFixed(2)}
          label={{ value: `η ${q}(x)`, angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          formatter={(v) => [Number(v).toFixed(3), `η ${q}`]}
          labelFormatter={(l) => `x = ${Number(l).toFixed(2)} ${lengthUnit}`}
        />
        {zones?.map((z, i) => (
          <ReferenceArea
            key={`z${i}`}
            x1={z.range[0]}
            x2={z.range[1]}
            fill={z.color}
            fillOpacity={1}
            stroke="none"
          />
        ))}
        <ReferenceLine y={0} stroke="#94a3b8" />
        <ReferenceLine
          x={data.meta.target_x}
          stroke="#b45309"
          strokeDasharray="4 3"
          label={{ value: 'section', position: 'top', fill: '#b45309', fontSize: 11 }}
        />
        <Line
          type="linear"
          dataKey="y"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {data.meta.support_positions.map((sx) => (
          <ReferenceDot key={sx} x={sx} y={0} r={5} fill="#b91c1c" stroke="none" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
