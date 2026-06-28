// Lignes d'enveloppe DC/DW (chargement alterné) : moment ET effort tranchant.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DistributedEnvelopeResponse } from '@/api/types'
import { useDistributedEnvelope } from './useBeam'
import { EnvelopeChart } from './EnvelopeChart'
import type { SharedBeam } from './shared'

interface Props {
  shared: SharedBeam
  wDc: number
  wDw: number
}

const worst = (pts: { position: number; value: number }[]) =>
  pts.length
    ? pts.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a))
    : null

export function DistributedEnvelopes({ shared, wDc, wDw }: Props) {
  const enabled = shared.spans.length > 0 && shared.dx > 0 && (wDc > 0 || wDw > 0)
  const base = enabled
    ? {
        spans: shared.spans,
        target_x: 0,
        dx: shared.dx,
        unit_system: shared.unitSystem,
        w_dc: wDc,
        w_dw: wDw,
      }
    : null
  const m = useDistributedEnvelope(base ? { ...base, quantity: 'M' as const } : null)
  const v = useDistributedEnvelope(base ? { ...base, quantity: 'V' as const } : null)

  return (
    <>
      <EnvelopeCard
        title="Enveloppe — moment fléchissant (M)"
        kind="moment"
        data={m.data}
        fetching={m.isFetching}
        lengthUnit={shared.lengthUnit}
      />
      <EnvelopeCard
        title="Enveloppe — effort tranchant (V)"
        kind="shear"
        data={v.data}
        fetching={v.isFetching}
        lengthUnit={shared.lengthUnit}
      />
    </>
  )
}

function EnvelopeCard({
  title,
  kind,
  data,
  fetching,
  lengthUnit,
}: {
  title: string
  kind: 'moment' | 'shear'
  data?: DistributedEnvelopeResponse
  fetching: boolean
  lengthUnit: string
}) {
  const mid = data ? worst(data.midspan_points) : null
  const sup = data ? worst(data.support_points) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {data && (
          <CardDescription>
            {kind === 'moment' ? (
              <>
                {mid && (
                  <span className="block">
                    Max positif en travée :{' '}
                    <strong>
                      {mid.value.toFixed(2)} {data.unit}
                    </strong>{' '}
                    (x = {mid.position.toFixed(2)} {lengthUnit})
                  </span>
                )}
                {sup && (
                  <span className="block">
                    Max négatif sur appui :{' '}
                    <strong>
                      {sup.value.toFixed(2)} {data.unit}
                    </strong>{' '}
                    (x = {sup.position.toFixed(2)} {lengthUnit})
                  </span>
                )}
              </>
            ) : (
              <span className="block">
                Gouvernant :{' '}
                <strong>
                  {data.governing.value.toFixed(2)} {data.unit}
                </strong>{' '}
                (x = {data.governing.position.toFixed(2)} {lengthUnit})
              </span>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {data ? (
          <EnvelopeChart data={data} lengthUnit={lengthUnit} kind={kind} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {fetching ? 'Calcul…' : 'Saisissez w_DC / w_DW.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
