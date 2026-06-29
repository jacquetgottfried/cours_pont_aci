// Présentation pure : efforts de calcul (par unité de largeur) + transparence des
// coefficients (décomposition DC, effet par nombre de voies chargées avec leur MPF).
import type { DeckLaneCase, DeckSection, DeckDesignResponse } from '@/api/types'

interface Props {
  data: DeckDesignResponse
  stripUnitLabel: string
}

const f2 = (v: number) => v.toFixed(2)
const f3 = (v: number) => v.toFixed(3)

/** Cas gouvernant (plus grand |M_LL|) parmi les voies chargées. */
function governingLane(lanes: DeckLaneCase[]): DeckLaneCase {
  return lanes.reduce((b, c) => (Math.abs(c.M_LL) > Math.abs(b.M_LL) ? c : b), lanes[0])
}

export function DeckResultsTable({ data, stripUnitLabel }: Props) {
  const ue = data.unit_line
  const us = data.unit_shear_line
  const { positive, negative, shear, overhang } = data.sections
  const moments = [
    ['Positif (mi-baie)', positive],
    ['Négatif (sur longeron)', negative],
    ['Porte-à-faux', overhang],
  ] as const

  // Effet vif par nombre de voies, pour les 3 sections sur ligne d'influence.
  const liSections: Array<[string, DeckSection, string]> = [
    ['Positif', positive, ue],
    ['Négatif', negative, ue],
    ['Eff. tranchant', shear, us],
  ]

  return (
    <div className="grid gap-5 text-sm">
      {/* --- Moments (par unité de largeur) --- */}
      <div>
        <p className="mb-1 font-medium">Moments de calcul ({ue})</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium">Section</th>
              <th className="px-2 py-1.5 text-right font-medium">M_DC</th>
              <th className="px-2 py-1.5 text-right font-medium">M_DW</th>
              <th className="px-2 py-1.5 text-right font-medium">M_LL+IM</th>
              <th className="px-2 py-1.5 text-right font-medium">E ({stripUnitLabel})</th>
              <th className="py-1.5 pl-2 text-right font-medium">Mu</th>
            </tr>
          </thead>
          <tbody>
            {moments.map(([label, s]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(s.M_DC)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(s.M_DW)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(s.M_LL)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.E.toFixed(1)}</td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-primary">
                  {f2(s.Mu)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Effort tranchant (unité distincte : force/longueur) --- */}
      <div>
        <p className="mb-1 font-medium">Effort tranchant au longeron intérieur ({us})</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium">Section</th>
              <th className="px-2 py-1.5 text-right font-medium">V_DC</th>
              <th className="px-2 py-1.5 text-right font-medium">V_DW</th>
              <th className="px-2 py-1.5 text-right font-medium">V_LL+IM</th>
              <th className="px-2 py-1.5 text-right font-medium">E ({stripUnitLabel})</th>
              <th className="py-1.5 pl-2 text-right font-medium">Vu</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1.5 pr-2">Tranchant</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f2(shear.M_DC)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f2(shear.M_DW)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f2(shear.M_LL)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{shear.E.toFixed(1)}</td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-primary">
                {f2(shear.Mu)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* --- Décomposition DC (transparence permanentes) --- */}
      <div>
        <p className="mb-1 font-medium">Décomposition M_DC (charges permanentes)</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium">Section</th>
              <th className="px-2 py-1.5 text-right font-medium">DC réparti</th>
              <th className="px-2 py-1.5 text-right font-medium">DC barrière</th>
              <th className="px-2 py-1.5 text-right font-medium">DC glissière</th>
              <th className="py-1.5 pl-2 text-right font-medium">DC total</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['Positif', positive],
              ['Négatif', negative],
              ['Tranchant', shear],
              ['Porte-à-faux', overhang],
            ] as const).map(([label, s]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(s.M_DC_dist)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(s.M_DC_barrier)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(s.M_DC_rail)}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{f2(s.M_DC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Charge vive : effet par nombre de voies chargées (MPF transparents) --- */}
      <div>
        <p className="mb-1 font-medium">
          Charge vive — effet par nombre de voies chargées (MPF appliqué)
        </p>
        <p className="mb-1 text-xs text-muted-foreground">
          Effet par unité de largeur ; le cas gouvernant (|effet| max) est en gras.
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium">Section</th>
              {[1, 2, 3].map((n) => {
                const c = positive.live_lanes.find((l) => l.n_lanes === n)
                return (
                  <th key={n} className="px-2 py-1.5 text-right font-medium">
                    {n} voie{n > 1 ? 's' : ''} (MPF {c ? c.mpf.toFixed(2) : '—'})
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {liSections.map(([label, s, unit]) => {
              const gov = governingLane(s.live_lanes)
              return (
                <tr key={label} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    {label} <span className="text-xs text-muted-foreground">({unit})</span>
                  </td>
                  {[1, 2, 3].map((n) => {
                    const c = s.live_lanes.find((l) => l.n_lanes === n)
                    const isGov = c && c.n_lanes === gov.n_lanes
                    return (
                      <td
                        key={n}
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          isGov ? 'font-semibold text-primary' : ''
                        }`}
                      >
                        {c ? f3(c.M_LL) : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
