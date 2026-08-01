import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, X } from 'lucide-react'
import { decodeHabitudesCode } from '../../../lib/habitudes-code'
import { FANTASTIC_KEYS, fantasticLevel, fantasticScore, type FantasticAnswers } from '../../../lib/fantastic'
import { EAS_MAX, EAS_QUESTIONS, easScore, type EasAnswers } from '../../../lib/eas'

/**
 * Import des réponses renvoyées par un client.
 *
 * Deux chemins, parce qu'un client n'a pas toujours les mêmes moyens : coller le
 * code reçu dans un courriel (marche depuis un téléphone, sans pièce jointe), ou
 * choisir le fichier qu'il a enregistré.
 *
 * Rien n'est importé sans que Marie ait vu ce qui va l'être : le score et le
 * nombre de réponses s'affichent avant confirmation. Un code abîmé pendant le
 * voyage est refusé avec sa raison, jamais accepté à moitié.
 */

interface Props {
  clientName: string
  /** Sexe du client — l’ÉAS n’est cotable que par sexe. */
  sex?: 'F' | 'M' | null
  onCancel: () => void
  onConfirm: (answers: FantasticAnswers, eas: EasAnswers) => void
}

type Etat =
  | { ok: true; answers: FantasticAnswers; eas: EasAnswers; answered: number; easAnswered: number }
  | { ok: false; reason: string }
  | null

export function FantasticImportModal({ clientName, sex, onCancel, onConfirm }: Props) {
  const [texte, setTexte] = useState('')
  const [etat, setEtat] = useState<Etat>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  function analyser(brut: string) {
    setTexte(brut)
    if (brut.trim() === '') {
      setEtat(null)
      return
    }
    const res = decodeHabitudesCode(brut)
    setEtat(
      res.ok
        ? { ok: true, answers: res.answers, eas: res.eas, answered: res.answered, easAnswered: res.easAnswered }
        : { ok: false, reason: res.reason }
    )
  }

  async function chargerFichier(f: File) {
    try {
      const contenu = await f.text()
      // Le fichier enregistré par le formulaire est un JSON contenant `code`.
      // On accepte aussi qu'on nous donne directement un fichier de code brut.
      let code = contenu
      try {
        const parsed = JSON.parse(contenu) as { code?: unknown }
        if (typeof parsed.code === 'string') code = parsed.code
      } catch {
        // Pas du JSON : on tente le contenu tel quel.
      }
      analyser(code)
    } catch {
      setEtat({ ok: false, reason: 'Ce fichier n’a pas pu être lu.' })
    }
  }

  const apercu = etat?.ok ? fantasticScore(etat.answers) : null
  const apercuEas = etat?.ok ? easScore(etat.eas, sex) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-4">
      <div className="bg-cream rounded-lg shadow-2xl border border-cream-dark w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col">
        <header className="px-5 py-4 border-b border-cream-dark flex items-center justify-between gap-3">
          <h3 className="text-marine font-semibold text-lg">Importer les réponses</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="text-marine/50 hover:text-marine transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4 overflow-y-auto min-h-0">
          <p className="text-marine/70 text-sm">
            Collez le code que {clientName.split(' ')[0]} vous a renvoyé, ou choisissez le fichier qu’il a enregistré.
          </p>

          <div>
            <label className="block text-marine/70 text-sm font-medium mb-1">Code reçu</label>
            <textarea
              value={texte}
              onChange={e => analyser(e.target.value)}
              rows={3}
              autoFocus
              spellCheck={false}
              placeholder="FT201 23401 23401 …"
              className="w-full px-3 py-2 border border-cream-dark rounded-md text-marine bg-white font-mono text-sm resize-y"
            />
          </div>

          <div>
            <input
              ref={fichierRef}
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) chargerFichier(f)
              }}
            />
            <button
              type="button"
              onClick={() => fichierRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white text-marine font-semibold rounded-md text-sm border border-cream-dark hover:border-gold/60 transition-colors"
            >
              <FileUp size={15} /> Choisir le fichier reçu
            </button>
          </div>

          {etat && !etat.ok && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{etat.reason}</p>
            </div>
          )}

          {etat?.ok && apercu && apercuEas && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                <p className="text-emerald-900 text-sm font-semibold">Code valide</p>
              </div>
              <ul className="text-emerald-800 text-sm mt-1.5 ml-[26px] space-y-1">
                <li>
                  <span className="font-medium">Habitudes de vie</span> — {etat.answered} / {FANTASTIC_KEYS.length}{' '}
                  énoncés
                  {apercu.sur100 !== null && (
                    <>
                      {' · '}
                      <strong className="tabular-nums">{apercu.sur100}</strong> sur 100 —{' '}
                      {fantasticLevel(apercu.sur100)}
                      {!apercu.complete && ' (sur les énoncés répondus)'}
                    </>
                  )}
                </li>
                <li>
                  <span className="font-medium">Participation</span> — {etat.easAnswered} / {EAS_QUESTIONS.length}{' '}
                  questions
                  {apercuEas.points !== null ? (
                    <>
                      {' · '}
                      <strong className="tabular-nums">{apercuEas.points}</strong> sur {EAS_MAX} — {apercuEas.category}
                      {!apercuEas.complete && ' (partiel)'}
                    </>
                  ) : apercuEas.sexeManquant ? (
                    // On importe quand même : les réponses sont bonnes, c'est la
                    // fiche du client qui est incomplète. Marie ajoutera le sexe
                    // et le score apparaîtra — rien n'est perdu.
                    <span className="text-amber-800"> · score en attente du sexe à la fiche</span>
                  ) : null}
                </li>
              </ul>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-cream-dark flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-marine/70 font-semibold rounded-md text-sm hover:bg-cream-dark/40 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!etat?.ok}
            onClick={() => etat?.ok && onConfirm(etat.answers, etat.eas)}
            className="px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Importer
          </button>
        </footer>
      </div>
    </div>
  )
}
