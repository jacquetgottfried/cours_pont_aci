// Vue partagée d'une section : éditeur Konva + ligne d'influence, avec un overlay
// optionnel (convoi HL-93 OU zones chargées DC/DW). Réutilisée par les deux sous-onglets.
import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AxlePosition, InfluenceLineResponse, Quantity } from '@/api/types'
import { BeamEditor } from './BeamEditor'
import { InfluenceLineChart, type ShadedZone } from './InfluenceLineChart'

interface Props {
  ilData?: InfluenceLineResponse
  ilFetching: boolean
  quantity: Quantity
  targetX: number
  spanLength: number
  supports: number[]
  snapTargets: number[]
  lengthUnit: string
  forceUnit: string
  onTargetXChange: (x: number) => void
  axles?: AxlePosition[] | null
  zones?: ShadedZone[]
  editorDescription: string
  chartHeaderRight?: ReactNode
  chartCaption?: ReactNode
}

export function SectionView({
  ilData,
  ilFetching,
  quantity,
  targetX,
  spanLength,
  supports,
  snapTargets,
  lengthUnit,
  forceUnit,
  onTargetXChange,
  axles = null,
  zones,
  editorDescription,
  chartHeaderRight,
  chartCaption,
}: Props) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Éditeur de poutre</CardTitle>
          <CardDescription>{editorDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {snapTargets.length > 0 ? (
            <BeamEditor
              spanLength={spanLength}
              supports={supports}
              targetX={targetX}
              snapTargets={snapTargets}
              axles={axles}
              loadedZones={zones}
              forceUnit={forceUnit}
              lengthUnit={lengthUnit}
              onTargetXChange={onTargetXChange}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Saisissez des travées valides.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Ligne d'influence — {quantity} à x = {targetX.toFixed(1)} {lengthUnit}
            </CardTitle>
            {chartHeaderRight}
          </div>
          {chartCaption ? <CardDescription>{chartCaption}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {ilData ? (
            <InfluenceLineChart data={ilData} lengthUnit={lengthUnit} zones={zones} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {ilFetching ? 'Calcul…' : 'En attente de calcul.'}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
