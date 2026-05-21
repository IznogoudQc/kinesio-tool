import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { type Category, type NormsType, getCategorization } from '../../../lib/norms'
import { BILAN_TO_TEST_KEY } from '../../../lib/norms/bilan-keys'

interface StrengthsAndWeaknessesProps {
  data: BilanData
  age: number | null
  sex: 'F' | 'M' | null
  norms: NormsType
}

interface FieldDef {
  key: keyof BilanData
  label: string
  unit?: string
}

const FIELDS: FieldDef[] = [
  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²' },
  { key: 'pourcentage_gras', label: '% gras', unit: '%' },
  { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm' },
  { key: 'pushups', label: 'Push-ups', unit: 'reps' },
  { key: 'situps', label: 'Sit-ups', unit: 'reps' },
  { key: 'flexion_tronc_cm', label: 'Flexion du tronc', unit: 'cm' },
  { key: 'endurance_dos_sec', label: 'Endurance du dos', unit: 's' }
]

interface Entry {
  field: FieldDef
  value: number
  category: Category
}

const STRENGTH_CATEGORIES: Category[] = ['TRES_BIEN', 'EXCELLENT']
const WEAKNESS_CATEGORIES: Category[] = ['A_AMELIORER', 'ACCEPTABLE']

export function StrengthsAndWeaknesses({ data, age, sex, norms }: StrengthsAndWeaknessesProps) {
  if (age === null || sex === null) {
    return (
      <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
        <p className="text-marine/45 text-sm">
          Complétez le profil (date de naissance + sexe) pour activer l'analyse forces / axes d'amélioration.
        </p>
      </div>
    )
  }

  const entries: Entry[] = FIELDS.flatMap(field => {
    const v = data[field.key]
    if (typeof v !== 'number') return []
    const testKey = BILAN_TO_TEST_KEY[field.key]
    if (!testKey) return []
    const category = getCategorization(testKey, v, age, sex, norms)
    if (!category) return []
    return [{ field, value: v, category }]
  })

  const strengths = entries.filter(e => STRENGTH_CATEGORIES.includes(e.category))
  const weaknesses = entries.filter(e => WEAKNESS_CATEGORIES.includes(e.category))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Panel
        title="Forces"
        icon={CheckCircle2}
        iconColor="text-green-600"
        accentBg="bg-green-50/60"
        accentBorder="border-green-200/50"
        items={strengths}
        emptyText="Aucun test à un niveau Très bien ou Excellent dans ce bilan."
      />
      <Panel
        title="À travailler"
        icon={AlertTriangle}
        iconColor="text-amber-600"
        accentBg="bg-amber-50/60"
        accentBorder="border-amber-200/50"
        items={weaknesses}
        emptyText="Aucun test à un niveau Acceptable ou À améliorer — bravo !"
      />
    </div>
  )
}

interface PanelProps {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  accentBg: string
  accentBorder: string
  items: Entry[]
  emptyText: string
}

function Panel({ title, icon: Icon, iconColor, accentBg, accentBorder, items, emptyText }: PanelProps) {
  return (
    <div className={`${accentBg} border ${accentBorder} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={iconColor} />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-marine/45 text-sm">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(e => (
            <li key={e.field.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-marine font-medium">{e.field.label}</span>
              <span className="text-marine/55 text-xs font-mono tabular-nums">
                {e.value}
                {e.field.unit ? ` ${e.field.unit}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
