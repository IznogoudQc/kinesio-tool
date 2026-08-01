import { AlertTriangle, CheckCircle2, Loader2, Save, Send, X } from 'lucide-react'
import {
  FANTASTIC_SECTIONS,
  FANTASTIC_KEYS,
  fantasticIsBlank,
  fantasticLevel,
  fantasticScore,
  itemKey,
  selectableChoices,
  type FantasticData
} from '../../../lib/fantastic'
import { EAS_MAX, EAS_QUESTIONS, easScore, emptyEas } from '../../../lib/eas'

/**
 * Formulaire FANTASTIC côté kinésiologue.
 *
 * Contrairement à la version envoyée au client, celle-ci **montre le score** :
 * c'est l'outil de travail de Marie. Le client, lui, ne voit que sa progression
 * de remplissage — un résultat brut reçu seul devant son écran décourage sans
 * rien apprendre (voir `fantastic-form-html.ts`).
 *
 * Sert à deux usages : saisir les réponses d'un client qui a répondu sur papier,
 * et relire celles qu'il a renvoyées par code.
 *
 * Deux questionnaires en un : le FANTASTIC (25 énoncés, /100) et l'ÉAS (3
 * questions, /11). Ce dernier est coté **selon le sexe du client** — sans sexe
 * au dossier, on le dit plutôt que d'afficher un score faux une fois sur deux.
 */

export interface FantasticDraft {
  id: string | null
  type: 'fantastic'
  date: string
  data: FantasticData
}

interface Props {
  value: FantasticDraft
  onChange: (d: FantasticDraft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  /** Ouvre la modale d'import d'un code renvoyé par le client. */
  onImport?: () => void
  /** Sexe du client — la cotation de l'ÉAS en dépend entièrement. */
  sex?: 'F' | 'M' | null
}

/** Teinte du bandeau de score — verte au-dessus de « Bien », ambre en dessous. */
function tonScore(sur100: number | null): string {
  if (sur100 === null) return 'bg-cream-dark/40 text-marine/60'
  if (sur100 >= 70) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (sur100 >= 55) return 'bg-sky-50 text-sky-800 border-sky-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

export function FantasticForm({ value, onChange, onCancel, onSave, saving, onImport, sex }: Props) {
  const { data } = value
  const score = fantasticScore(data.answers)
  const niveau = fantasticLevel(score.sur100)
  const eas = data.eas ?? emptyEas()
  const scoreEas = easScore(eas, sex)

  function setEas(key: keyof typeof eas, v: number) {
    onChange({
      ...value,
      // Recliquer sur la réponse déjà choisie l'annule, comme pour le FANTASTIC.
      data: { ...data, eas: { ...eas, [key]: eas[key] === v ? null : v } }
    })
  }

  function setAnswer(key: string, v: number) {
    onChange({
      ...value,
      data: {
        ...data,
        // Recliquer sur la réponse déjà choisie l'annule : sans ça, une erreur
        // de clic ne se rattrape pas — il n'y a aucun moyen de « dé-répondre ».
        answers: { ...data.answers, [key]: data.answers[key] === v ? null : v }
      }
    })
  }

  return (
    <section className="bg-white border border-cream-dark rounded-lg shadow-sm">
      <header className="px-5 py-4 border-b border-cream-dark flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-marine font-semibold text-lg">Habitudes de vie</h3>
          <p className="text-marine/50 text-sm">Questionnaire sur la participation à des activités physiques</p>
        </div>
        <div className="flex items-center gap-2">
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white text-marine font-semibold rounded-md text-sm border border-cream-dark hover:border-gold/60 transition-colors"
            >
              <Send size={15} className="rotate-180" /> Importer un code
            </button>
          )}
          <input
            type="date"
            value={value.date}
            onChange={e => onChange({ ...value, date: e.target.value })}
            className="px-3 py-2 border border-cream-dark rounded-md text-sm text-marine bg-white"
          />
        </div>
      </header>

      {/* Provenance — Marie doit savoir si c'est le client qui a répondu. */}
      {data.source === 'client' && (
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
          <p className="text-emerald-800 text-sm">
            Réponses transmises par le client
            {data.receivedAt && ` — reçues le ${new Date(data.receivedAt).toLocaleDateString('fr-CA')}`}
          </p>
        </div>
      )}

      {/* Score — visible ici, jamais dans le formulaire envoyé au client. */}
      <div className={`px-5 py-3 border-b flex items-baseline gap-3 flex-wrap ${tonScore(score.sur100)}`}>
        {score.sur100 === null ? (
          <p className="text-sm">Aucune réponse pour l’instant.</p>
        ) : (
          <>
            <span className="text-2xl font-bold tabular-nums">{score.sur100}</span>
            <span className="text-sm font-semibold">sur 100 — {niveau}</span>
            {!score.complete && (
              <span className="text-xs opacity-80">
                (calculé sur {score.answered} énoncé{score.answered > 1 ? 's' : ''} répondu
                {score.answered > 1 ? 's' : ''} sur {FANTASTIC_KEYS.length})
              </span>
            )}
          </>
        )}
      </div>

      <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
        {FANTASTIC_SECTIONS.map((section, si) => (
          <div key={section.key}>
            <h4 className="text-marine font-semibold text-sm mb-2 flex items-center gap-2">
              <span className="grid place-items-center w-5 h-5 rounded-full bg-marine text-cream text-[11px] font-bold shrink-0">
                {si + 1}
              </span>
              {section.title}
            </h4>
            <div className="space-y-2.5">
              {section.items.map(item => {
                const key = itemKey(section, item)
                const choisi = data.answers[key]
                // Seules les colonnes portant un libellé sont des réponses —
                // deux énoncés n'en ont que deux (Parfois / Jamais).
                const choix = selectableChoices(item)
                return (
                  <div key={key} className="border border-cream-dark rounded-md p-2.5">
                    <p className="text-marine/85 text-sm mb-1.5">{item.label}</p>
                    <div
                      className="grid gap-1"
                      style={{ gridTemplateColumns: `repeat(${choix.length}, minmax(0, 1fr))` }}
                    >
                      {choix.map(({ value, label }) => {
                        const actif = choisi === value
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAnswer(key, value)}
                            aria-pressed={actif}
                            className={`px-1.5 py-1.5 rounded text-[11px] leading-tight border transition-colors ${
                              actif
                                ? 'bg-marine text-cream border-marine font-semibold'
                                : 'bg-white text-marine/60 border-cream-dark hover:border-gold/60'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* ── Partie 2 : ÉAS (Figure 4-6) ─────────────────────────────── */}
        <div className="pt-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="text-marine font-semibold text-sm">Participation à l’activité physique</h4>
            {scoreEas.sexeManquant ? (
              // La grille du guide a une colonne Homme et une colonne Femme :
              // sans sexe au dossier, coter reviendrait à tirer à pile ou face.
              <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                <AlertTriangle size={12} /> Sexe manquant à la fiche — score non calculable
              </span>
            ) : scoreEas.points !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  scoreEas.points >= 6
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : scoreEas.points >= 4
                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span className="tabular-nums">{scoreEas.points}</span> / {EAS_MAX} — {scoreEas.category}
                {!scoreEas.complete && ' (partiel)'}
              </span>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {EAS_QUESTIONS.map(q => (
              <div key={q.key} className="border border-cream-dark rounded-md p-2.5">
                <p className="text-marine/85 text-sm font-medium">
                  <span className="text-gold-dark font-bold">#{q.numero}</span> {q.titre}
                </p>
                <p className="text-marine/55 text-xs mb-1.5 leading-snug">{q.question}</p>
                <div className="flex flex-col gap-1">
                  {q.choices.map((c, ci) => {
                    const actif = eas[q.key] === ci
                    return (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => setEas(q.key, ci)}
                        aria-pressed={actif}
                        className={`text-left px-2.5 py-1.5 rounded text-xs border transition-colors ${
                          actif
                            ? 'bg-marine text-cream border-marine font-semibold'
                            : 'bg-white text-marine/70 border-cream-dark hover:border-gold/60'
                        }`}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-marine/70 text-sm font-medium mb-1">Notes</label>
          <textarea
            value={data.notes ?? ''}
            onChange={e => onChange({ ...value, data: { ...data, notes: e.target.value } })}
            rows={3}
            className="w-full px-3 py-2 border border-cream-dark rounded-md text-sm text-marine bg-white resize-y"
            placeholder="Observations, éléments à reprendre en rencontre…"
          />
        </div>
      </div>

      <footer className="px-5 py-3 border-t border-cream-dark flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-marine/70 font-semibold rounded-md text-sm hover:bg-cream-dark/40 transition-colors disabled:opacity-50"
        >
          <X size={15} /> Annuler
        </button>
        <button
          type="button"
          onClick={onSave}
          // Rien de saisi : enregistrer créerait une fiche vide dans l'historique,
          // qu'il faudrait ensuite supprimer à la main.
          disabled={saving || fantasticIsBlank(data)}
          title={fantasticIsBlank(data) ? 'Répondez à au moins un énoncé' : undefined}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
        </button>
      </footer>
    </section>
  )
}
