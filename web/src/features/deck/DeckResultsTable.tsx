// Présentation pure : tableau des moments de calcul (par unité de largeur).
import type { DeckDesignResponse } from '@/api/types'

interface Props {
  data: DeckDesignResponse
  stripUnitLabel: string
}

export function DeckResultsTable({ data, stripUnitLabel }: Props) {
  const ue = data.unit_line
  const f = (v: number) => v.toFixed(2)
  const rows = [
    ['Positif (mi-baie)', data.sections.positive],
    ['Négatif (sur longeron)', data.sections.negative],
    ['Porte-à-faux', data.sections.overhang],
  ] as const

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="py-2 pr-2 text-left font-medium">Section</th>
          <th className="px-2 py-2 text-right font-medium">M_DC ({ue})</th>
          <th className="px-2 py-2 text-right font-medium">M_DW ({ue})</th>
          <th className="px-2 py-2 text-right font-medium">M_LL+IM ({ue})</th>
          <th className="px-2 py-2 text-right font-medium">E ({stripUnitLabel})</th>
          <th className="py-2 pl-2 text-right font-medium">Mu ({ue})</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, s]) => (
          <tr key={label} className="border-b last:border-0">
            <td className="py-2 pr-2">{label}</td>
            <td className="px-2 py-2 text-right tabular-nums">{f(s.M_DC)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{f(s.M_DW)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{f(s.M_LL)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{s.E.toFixed(1)}</td>
            <td className="py-2 pl-2 text-right font-semibold tabular-nums text-primary">
              {f(s.Mu)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
