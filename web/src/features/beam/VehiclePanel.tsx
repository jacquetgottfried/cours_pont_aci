// Sous-onglet « Charge mobile HL-93 » : convoi + position critique sur la section.
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Vehicle, VehicleEnvelopeResponse } from '@/api/types'
import { useVehicleSweep } from './useBeam'
import { SectionView } from './SectionView'
import type { SharedBeam } from './shared'

export function VehiclePanel({ shared }: { shared: SharedBeam }) {
  const [vehicle, setVehicle] = useState<Vehicle>('truck')
  const [placement, setPlacement] = useState<VehicleEnvelopeResponse | null>(null)
  // V : côté de la coupure visualisé (avant = gauche/négatif, après = droite/positif).
  const [vSide, setVSide] = useState<'avant' | 'apres'>('avant')
  const sweep = useVehicleSweep()

  const { quantity, targetX, geomKey, lengthUnit: lu } = shared

  // Le convoi placé devient obsolète dès qu'une entrée change.
  useEffect(() => {
    setPlacement(null)
  }, [geomKey, quantity, targetX, vehicle])

  const findCritical = () => {
    sweep.mutate(
      {
        spans: shared.spans,
        quantity,
        target_x: targetX,
        dx: shared.dx,
        unit_system: shared.unitSystem,
        vehicle,
        impact: true,
      },
      {
        onSuccess: (res) => {
          setPlacement(res)
          setVSide(
            Math.abs(res.min.value) >= Math.abs(res.max.value) ? 'avant' : 'apres',
          )
        },
      },
    )
  }

  // V : « avant » (gauche, min négatif) et « après » (droite, max positif) sont deux
  // efforts de calcul distincts. R/M (continus) : un seul effet gouvernant.
  const activeExtreme =
    placement == null
      ? null
      : quantity === 'V'
        ? vSide === 'avant'
          ? placement.min
          : placement.max
        : placement.governing

  const vToggle = placement && quantity === 'V' && (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={vSide === 'avant' ? 'default' : 'outline'}
        onClick={() => setVSide('avant')}
      >
        Avant coupure
      </Button>
      <Button
        size="sm"
        variant={vSide === 'apres' ? 'default' : 'outline'}
        onClick={() => setVSide('apres')}
      >
        Après coupure
      </Button>
    </div>
  )

  const caption =
    !placement ? null : quantity === 'V' ? (
      <>
        <span className="block">
          Avant la coupure (gauche) :{' '}
          <strong>
            {placement.min.value.toFixed(2)} {placement.unit}
          </strong>{' '}
          (tête à {placement.min.lead_pos.toFixed(2)} {lu})
        </span>
        <span className="block">
          Après la coupure (droite) :{' '}
          <strong>
            {placement.max.value.toFixed(2)} {placement.unit}
          </strong>{' '}
          (tête à {placement.max.lead_pos.toFixed(2)} {lu})
        </span>
      </>
    ) : (
      <>
        Effet gouvernant :{' '}
        <strong>
          {placement.governing.value.toFixed(2)} {placement.unit}
        </strong>{' '}
        (essieu de tête à {placement.governing.lead_pos.toFixed(2)} {lu})
      </>
    )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="vehicle">Convoi HL-93</Label>
          <Select value={vehicle} onValueChange={(v) => setVehicle(v as Vehicle)}>
            <SelectTrigger id="vehicle" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="truck">Camion de calcul</SelectItem>
              <SelectItem value="tandem">Tandem</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={findCritical} disabled={!shared.ilData || sweep.isPending}>
          {sweep.isPending ? 'Calcul…' : 'Position critique du convoi'}
        </Button>
        {sweep.isError && (
          <p className="text-sm text-destructive">Erreur : {sweep.error?.message}</p>
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
        axles={activeExtreme?.axle_positions ?? null}
        editorDescription={
          quantity === 'R'
            ? "Glissez le repère sur un appui (la réaction n'existe qu'aux appuis)."
            : 'Glissez le repère pour choisir la section, puis « Position critique ».'
        }
        chartHeaderRight={vToggle}
        chartCaption={caption}
      />
    </div>
  )
}
