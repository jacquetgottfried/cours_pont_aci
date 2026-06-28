// Sous-onglet « Charges permanentes DC/DW » : chargement alterné (damier) + enveloppes.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDistributedEffect } from './useBeam'
import { SectionView } from './SectionView'
import { DistributedEnvelopes } from './DistributedEnvelopes'
import type { ShadedZone } from './InfluenceLineChart'
import type { SharedBeam } from './shared'

const GREEN = 'rgba(5,150,105,0.18)' // zone chargée pour le max (η > 0)
const RED = 'rgba(220,38,38,0.16)' // zone chargée pour le min (η < 0)

export function DistributedPanel({ shared }: { shared: SharedBeam }) {
  const defaults = shared.unitSystem === 'US' ? { wdc: 1.0, wdw: 0.3 } : { wdc: 10, wdw: 3 }
  const [wDc, setWDc] = useState(defaults.wdc)
  const [wDw, setWDw] = useState(defaults.wdw)
  const [mode, setMode] = useState<'permanent' | 'alterne'>('alterne')

  const { quantity, targetX, lengthUnit: lu } = shared
  const hasLoad = wDc > 0 || wDw > 0

  const req =
    hasLoad && shared.ilData
      ? {
          spans: shared.spans,
          quantity,
          target_x: targetX,
          dx: shared.dx,
          unit_system: shared.unitSystem,
          w_dc: wDc,
          w_dw: wDw,
        }
      : null
  const effect = useDistributedEffect(req)
  const data = effect.data

  const zones: ShadedZone[] = !data
    ? []
    : mode === 'permanent'
      ? data.full.zones.map((r) => ({ range: [r[0], r[1]] as [number, number], color: GREEN }))
      : [
          ...data.max.zones.map((r) => ({ range: [r[0], r[1]] as [number, number], color: GREEN })),
          ...data.min.zones.map((r) => ({ range: [r[0], r[1]] as [number, number], color: RED })),
        ]

  const modeToggle = (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={mode === 'permanent' ? 'default' : 'outline'}
        onClick={() => setMode('permanent')}
      >
        Permanent
      </Button>
      <Button
        size="sm"
        variant={mode === 'alterne' ? 'default' : 'outline'}
        onClick={() => setMode('alterne')}
      >
        Alterné
      </Button>
    </div>
  )

  const caption = !data ? null : mode === 'permanent' ? (
    <span className="block">
      Toute la poutre chargée :{' '}
      <strong>
        {data.full.total.toFixed(2)} {data.unit}
      </strong>{' '}
      (DC {data.full.dc.toFixed(1)} + DW {data.full.dw.toFixed(1)})
    </span>
  ) : (
    <>
      <span className="block">
        Alterné max (charge η&gt;0, vert) :{' '}
        <strong>
          {data.max.total.toFixed(2)} {data.unit}
        </strong>
      </span>
      <span className="block">
        Alterné min (charge η&lt;0, rouge) :{' '}
        <strong>
          {data.min.total.toFixed(2)} {data.unit}
        </strong>
      </span>
    </>
  )

  const wu = `${shared.forceUnit}/${lu}`

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="wdc">DC poids propre ({wu})</Label>
          <Input
            id="wdc"
            type="number"
            min={0}
            step="any"
            value={wDc}
            className="w-32"
            onChange={(e) => setWDc(Number(e.target.value))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wdw">DW revêtement ({wu})</Label>
          <Input
            id="wdw"
            type="number"
            min={0}
            step="any"
            value={wDw}
            className="w-32"
            onChange={(e) => setWDw(Number(e.target.value))}
          />
        </div>
        {!hasLoad && (
          <p className="text-sm text-muted-foreground">
            Au moins une charge doit être &gt; 0.
          </p>
        )}
      </div>

      <SectionView
        ilData={shared.ilData}
        ilFetching={shared.ilFetching}
        quantity={quantity}
        targetX={targetX}
        spanLength={shared.spanLength}
        supports={shared.supports}
        snapTargets={shared.snapTargets}
        lengthUnit={lu}
        forceUnit={shared.forceUnit}
        onTargetXChange={shared.onTargetXChange}
        zones={zones}
        editorDescription="Les zones ombrées sont les travées chargées (chargement alterné « en damier »)."
        chartHeaderRight={modeToggle}
        chartCaption={caption}
      />

      <DistributedEnvelopes shared={shared} wDc={wDc} wDw={wDw} />
    </div>
  )
}
