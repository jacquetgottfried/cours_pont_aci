// Présentation pure : les champs de saisie (shadcn/ui). Aucun calcul, aucun fetch.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Quantity, UnitSystem } from '@/api/types'
import { QUANTITY_LABELS, lengthUnit } from '@/lib/units'

interface Props {
  spansText: string
  quantity: Quantity
  dx: number
  unitSystem: UnitSystem
  onSpansText: (s: string) => void
  onQuantity: (q: Quantity) => void
  onDx: (n: number) => void
  onUnitSystem: (s: UnitSystem) => void
}

export function BeamControls(props: Props) {
  const lu = lengthUnit(props.unitSystem)
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="unit">Système d'unités</Label>
        <Select
          value={props.unitSystem}
          onValueChange={(v) => props.onUnitSystem(v as UnitSystem)}
        >
          <SelectTrigger id="unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SI">SI (m, kN)</SelectItem>
            <SelectItem value="US">US (ft, kip)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="spans">Travées ({lu}, séparées par des virgules)</Label>
        <Input
          id="spans"
          value={props.spansText}
          onChange={(e) => props.onSpansText(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="quantity">Grandeur</Label>
        <Select
          value={props.quantity}
          onValueChange={(v) => props.onQuantity(v as Quantity)}
        >
          <SelectTrigger id="quantity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="R">{QUANTITY_LABELS.R}</SelectItem>
            <SelectItem value="M">{QUANTITY_LABELS.M}</SelectItem>
            <SelectItem value="V">{QUANTITY_LABELS.V}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="dx">Discrétisation dx ({lu})</Label>
        <Input
          id="dx"
          type="number"
          min={0.05}
          step="any"
          value={props.dx}
          onChange={(e) => props.onDx(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
