// Présentation pure : entrées du tablier (géométrie, charges, facteurs). Aucun calcul.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DeckCatalog, DeckDesignRequest, UnitSystem } from '@/api/types'
import { forceUnit, lengthUnit } from '@/lib/units'

interface Props {
  req: DeckDesignRequest
  catalog?: DeckCatalog
  onChange: (patch: Partial<DeckDesignRequest>) => void
  onUnitSystem: (sys: UnitSystem) => void
}

function NumField({
  id,
  label,
  value,
  step,
  min,
  onChange,
}: {
  id: string
  label: string
  value: number
  step?: string
  min?: number
  onChange: (n: number) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step ?? 'any'}
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function DeckControls({ req, catalog, onChange, onUnitSystem }: Props) {
  const lu = lengthUnit(req.unit_system)
  const wu = `${forceUnit(req.unit_system)}/${lu}`

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="deck-unit">Système d'unités</Label>
        <Select
          value={req.unit_system}
          onValueChange={(v) => onUnitSystem(v as UnitSystem)}
        >
          <SelectTrigger id="deck-unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SI">SI (m, kN)</SelectItem>
            <SelectItem value="US">US (ft, kip)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm font-medium">Géométrie</p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          id="n"
          label="Nb longerons"
          value={req.n_girders}
          step="1"
          min={2}
          onChange={(n) => onChange({ n_girders: Math.round(n) })}
        />
        <NumField
          id="s"
          label={`Entraxe S (${lu})`}
          value={req.spacing}
          min={0.1}
          onChange={(spacing) => onChange({ spacing })}
        />
        <NumField
          id="oh"
          label={`Porte-à-faux (${lu})`}
          value={req.overhang}
          min={0}
          onChange={(overhang) => onChange({ overhang })}
        />
        <NumField
          id="ddx"
          label={`dx transversal (${lu})`}
          value={req.dx}
          min={0.01}
          onChange={(dx) => onChange({ dx })}
        />
      </div>

      <p className="text-sm font-medium">Charges permanentes</p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          id="wdc"
          label={`DC dalle (${wu})`}
          value={req.w_dc}
          min={0}
          onChange={(w_dc) => onChange({ w_dc })}
        />
        <NumField
          id="wdw"
          label={`DW revêt. (${wu})`}
          value={req.w_dw}
          min={0}
          onChange={(w_dw) => onChange({ w_dw })}
        />
      </div>

      <p className="text-sm font-medium">Charge vive (roue HL-93)</p>
      <p className="text-xs text-muted-foreground">
        {catalog
          ? `P = ${catalog.P} ${forceUnit(req.unit_system)} · gage = ${catalog.gage} ${lu} · IM = ${Math.round(catalog.im * 100)} %`
          : 'roue : —'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          id="mpf"
          label="Présence multiple (MPF)"
          value={req.mpf}
          step="0.05"
          min={0.1}
          onChange={(mpf) => onChange({ mpf })}
        />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={req.impact}
            onChange={(e) => onChange({ impact: e.target.checked })}
          />
          Majoration IM
        </label>
      </div>

      <p className="text-sm font-medium">Facteurs de charge (Strength I)</p>
      <div className="grid grid-cols-3 gap-3">
        <NumField
          id="gdc"
          label="γ_DC"
          value={req.gamma_dc}
          step="0.05"
          min={0.1}
          onChange={(gamma_dc) => onChange({ gamma_dc })}
        />
        <NumField
          id="gdw"
          label="γ_DW"
          value={req.gamma_dw}
          step="0.05"
          min={0.1}
          onChange={(gamma_dw) => onChange({ gamma_dw })}
        />
        <NumField
          id="gll"
          label="γ_LL"
          value={req.gamma_ll}
          step="0.05"
          min={0.1}
          onChange={(gamma_ll) => onChange({ gamma_ll })}
        />
      </div>
    </div>
  )
}
