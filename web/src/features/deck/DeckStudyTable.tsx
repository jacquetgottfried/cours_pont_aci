// Présentation pure : effets à la section d'étude — permanentes décomposées puis
// charge vive et combinaison PAR NOMBRE DE VOIES (M et V côte à côte).
import type { DeckSectionStudyResponse, DeckStudyLaneCase } from '@/api/types'

interface Props {
  study: DeckSectionStudyResponse
  nLanes: 1 | 2 | 3
  stripUnitLabel: string
}

const f2 = (v: number) => v.toFixed(2)
const f3 = (v: number) => v.toFixed(3)

/** Cas gouvernant (plus grand |M_LL|) parmi les voies chargées. */
function governingLane(lanes: DeckStudyLaneCase[]): DeckStudyLaneCase {
  return lanes.reduce((b, c) => (Math.abs(c.M_LL) > Math.abs(b.M_LL) ? c : b), lanes[0])
}

export function DeckStudyTable({ study, nLanes, stripUnitLabel }: Props) {
  const { moment, shear } = study
  const ue = study.unit_line
  const us = study.unit_shear_line
  const govM = governingLane(moment.live_lanes)
  const govV = governingLane(shear.live_lanes)

  const permanents = [
    ['DC réparti (dalle)', moment.M_DC_dist, shear.M_DC_dist],
    ['DC barrière', moment.M_DC_barrier, shear.M_DC_barrier],
    ['DC glissière', moment.M_DC_rail, shear.M_DC_rail],
    ['DC total', moment.M_DC, shear.M_DC],
    ['DW (revêtement)', moment.M_DW, shear.M_DW],
  ] as const

  return (
    <div className="grid gap-5 text-sm">
      {/* --- Charges permanentes (décomposées) --- */}
      <div>
        <p className="mb-1 font-medium">Charges permanentes à la section</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium">Charge</th>
              <th className="px-2 py-1.5 text-right font-medium">Moment ({ue})</th>
              <th className="py-1.5 pl-2 text-right font-medium">Tranchant ({us})</th>
            </tr>
          </thead>
          <tbody>
            {permanents.map(([label, m, v]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{f2(m)}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{f2(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Charge vive et combinaison par nombre de voies --- */}
      <div>
        <p className="mb-1 font-medium">
          Charge vive et combinaison par nombre de voies (MPF appliqué)
        </p>
        <p className="mb-1 text-xs text-muted-foreground">
          Cas gouvernant (|effet| max) en gras · ligne surlignée = cas affiché sur les LI.
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium">Voies chargées</th>
              <th className="px-2 py-1.5 text-right font-medium">M_LL+IM ({ue})</th>
              <th className="px-2 py-1.5 text-right font-medium">Mu</th>
              <th className="px-2 py-1.5 text-right font-medium">V_LL+IM ({us})</th>
              <th className="py-1.5 pl-2 text-right font-medium">Vu</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((n) => {
              const cm = moment.live_lanes.find((c) => c.n_lanes === n)
              const cv = shear.live_lanes.find((c) => c.n_lanes === n)
              if (!cm || !cv) return null
              const selected = n === nLanes
              return (
                <tr
                  key={n}
                  className={`border-b last:border-0 ${selected ? 'bg-muted' : ''}`}
                >
                  <td className="py-1.5 pr-2">
                    {n} voie{n > 1 ? 's' : ''}{' '}
                    <span className="text-xs text-muted-foreground">
                      (MPF {cm.mpf.toFixed(2)})
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${
                      cm.n_lanes === govM.n_lanes ? 'font-semibold text-primary' : ''
                    }`}
                  >
                    {f3(cm.M_LL)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${
                      cm.n_lanes === govM.n_lanes ? 'font-semibold text-primary' : ''
                    }`}
                  >
                    {f2(cm.Mu)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${
                      cv.n_lanes === govV.n_lanes ? 'font-semibold text-primary' : ''
                    }`}
                  >
                    {f3(cv.M_LL)}
                  </td>
                  <td
                    className={`py-1.5 pl-2 text-right tabular-nums ${
                      cv.n_lanes === govV.n_lanes ? 'font-semibold text-primary' : ''
                    }`}
                  >
                    {f2(cv.Mu)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted-foreground">
          E moment = {moment.E.toFixed(1)} {stripUnitLabel} (bande{' '}
          {moment.strip_kind === 'negative' ? 'négative' : 'positive'}) · E tranchant ={' '}
          {shear.E.toFixed(1)} {stripUnitLabel} (bande négative, choix pédagogique — pas
          de formule AASHTO en cisaillement).
        </p>
      </div>
    </div>
  )
}
