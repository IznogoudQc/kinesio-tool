import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bot, CheckCircle2, ClipboardCopy, Info, KeyRound, Lightbulb, Loader2, X } from 'lucide-react'
import type { MetricSelection } from '../../../contexts/AIAdviceContext'
import { AIAdviceError, aiAdviceService, formatAdviceAsText, type AIAdvice } from '../../../services/aiAdvice'
import { CATEGORY_FR } from '../../../lib/ai-metrics'
import { CATEGORY_COLORS, type Category } from '../../../lib/norms'

/**
 * Couleur d'une catégorie à partir de son libellé français.
 *
 * `MetricSelection` ne transporte que le libellé, pas la clé de catégorie — et
 * on ne lui en ajoute pas : cet objet part **tel quel** vers l'API, sa forme
 * n'est donc pas un détail d'affichage. On inverse `CATEGORY_FR` pour retrouver
 * la clé et réutiliser la palette du reste de l'app. Table dérivée : si un
 * libellé change, la couleur suit.
 */
const CATEGORY_BY_LABEL = Object.fromEntries(
  (Object.entries(CATEGORY_FR) as [Category, string][]).map(([key, label]) => [label, key])
) as Record<string, Category | undefined>

function categoryClass(label: string): string {
  const key = CATEGORY_BY_LABEL[label]
  return key ? CATEGORY_COLORS[key] : 'text-marine/60'
}

interface AIAnalysisPanelProps {
  sex: 'F' | 'M' | null
  age: number | null
  /** Toutes les métriques du bilan actif (collecte automatique). */
  metrics: MetricSelection[]
}

/**
 * Bouton « Analyser le bilan (IA) » + modales. L'IA lit tout le bilan (métriques
 * anonymes) et renvoie forces / points à travailler / pistes. Remplace l'ancienne
 * sélection manuelle métrique par métrique.
 */
export function AIAnalysisPanel({ sex, age, metrics }: AIAnalysisPanelProps) {
  const navigate = useNavigate()
  const [stage, setStage] = useState<'idle' | 'payload' | 'loading' | 'result' | 'no-key'>('idle')
  const [advice, setAdvice] = useState<AIAdvice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (stage === 'idle') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [stage])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (stage === 'payload' || stage === 'result' || stage === 'no-key') setStage('idle')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage])

  async function handleGenerate() {
    setStage('loading')
    setError(null)
    try {
      const result = await aiAdviceService.generate({ sex, age, metrics })
      setAdvice(result)
      setStage('result')
    } catch (err) {
      if (err instanceof AIAdviceError && err.code === 'NO_API_KEY') {
        setStage('no-key')
        return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStage('payload')
    }
  }

  async function handleCopy() {
    if (!advice) return
    try {
      await navigator.clipboard.writeText(formatAdviceAsText(advice))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore — pas critique
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStage('payload')}
        disabled={metrics.length === 0}
        title={metrics.length === 0 ? 'Aucune métrique catégorisable dans ce bilan' : undefined}
        className="inline-flex items-center gap-2 px-3.5 py-2 bg-marine text-cream font-medium rounded-md text-sm hover:bg-marine-light transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Bot size={15} />
        Analyser avec l'IA
      </button>

      {/* Modal payload preview */}
      {stage === 'payload' && (
        <Modal title="Analyse du bilan par l'IA" icon={Bot} onClose={() => setStage('idle')} wide>
          <p className="text-marine/65 text-sm mb-3">
            Données anonymes envoyées ({metrics.length} métrique{metrics.length > 1 ? 's' : ''}) :
          </p>
          {/* Tableau aligné plutôt qu'un bloc à chasse fixe : les valeurs, les
              catégories et les percentiles étaient enfilés sur une même ligne
              séparés par des points médians, dans une fenêtre de 512 px avec sa
              propre barre de défilement — deux barres imbriquées, et rien
              d'alignable à l'œil. Ici chaque information a sa colonne, les
              nombres sont en chiffres tabulaires et la fenêtre est élargie. */}
          <div className="rounded-md border border-cream-dark/40 bg-cream/40 mb-4 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-cream-dark/40 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-marine/45 text-xs uppercase tracking-wide font-semibold">Profil</span>
              <span className="text-marine text-sm font-medium">
                {sex === 'F' ? 'Femme' : sex === 'M' ? 'Homme' : 'Sexe non renseigné'}
                {age !== null && ` · ${age} ans`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {metrics.map(m => (
                    <tr key={m.key} className="border-t border-cream-dark/30">
                      <td className="px-4 py-2 text-marine/60">{m.label}</td>
                      <td className="px-2 py-2 text-right text-marine font-semibold tabular-nums whitespace-nowrap">
                        {m.value}
                        {m.unit && <span className="text-marine/40 font-normal"> {m.unit}</span>}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {m.category && (
                          <span className={`font-medium ${categoryClass(m.category)}`}>{m.category}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-marine/40 tabular-nums whitespace-nowrap">
                        {typeof m.percentile === 'number' ? `${Math.round(m.percentile)}ᵉ perc.` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gold/10 border border-gold/30 rounded-md p-3 text-marine/70 text-xs flex items-start gap-2 mb-4">
            <Info size={14} className="text-gold-dark shrink-0 mt-0.5" />
            <span>Aucune donnée identifiable (pas de nom, courriel, notes). Le client reste anonyme côté API.</span>
          </div>
          {error && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setStage('idle')}
              className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors"
            >
              Analyser
            </button>
          </div>
        </Modal>
      )}

      {/* Modal loading */}
      {stage === 'loading' && (
        <Modal title="Analyse du bilan par l'IA" icon={Bot} onClose={undefined}>
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 size={32} className="text-gold-dark animate-spin" />
            <p className="text-marine/70 text-sm mt-3">Analyse en cours… (2-5 secondes)</p>
            <p className="text-marine/40 text-xs mt-1">Identification des forces et des points à travailler.</p>
          </div>
        </Modal>
      )}

      {/* Modal NO_API_KEY */}
      {stage === 'no-key' && (
        <Modal title="Clé API requise" icon={KeyRound} onClose={() => setStage('idle')}>
          <p className="text-marine/75 text-sm mb-4">
            Aucune clé API Anthropic configurée. Allez dans{' '}
            <span className="font-medium text-marine">Réglages → Conseils IA</span> pour en ajouter une.
          </p>
          <p className="text-marine/50 text-xs mb-5">
            Vous pouvez obtenir une clé sur <span className="font-mono">console.anthropic.com</span>.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setStage('idle')}
              className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-sm transition-colors"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('idle')
                navigate('/settings')
              }}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors"
            >
              Ouvrir les réglages
            </button>
          </div>
        </Modal>
      )}

      {/* Modal résultat */}
      {stage === 'result' && advice && (
        <Modal title="Forces & à travailler — analyse IA" icon={Bot} onClose={() => setStage('idle')} wide>
          <div className="space-y-5">
            {advice.synthese && (
              <p className="text-marine/80 text-sm leading-relaxed bg-cream/50 border border-cream-dark/40 rounded-md px-4 py-3">
                {advice.synthese}
              </p>
            )}

            <section>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <h4 className="text-marine font-semibold text-sm uppercase tracking-wide">Forces</h4>
              </div>
              {advice.forces.length === 0 ? (
                <p className="text-marine/45 text-sm">Aucune force marquante identifiée dans ce bilan.</p>
              ) : (
                <div className="space-y-2">
                  {advice.forces.map((f, i) => (
                    <div key={i} className="bg-green-50/60 border border-green-200/50 rounded-md px-4 py-2.5">
                      <p className="text-marine font-semibold text-sm">{f.titre}</p>
                      <p className="text-marine/70 text-sm mt-0.5">{f.explication}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h4 className="text-marine font-semibold text-sm uppercase tracking-wide">À travailler</h4>
              </div>
              {advice.aTravailler.length === 0 ? (
                <p className="text-marine/45 text-sm">Aucun point faible marquant — beau bilan !</p>
              ) : (
                <div className="space-y-2">
                  {advice.aTravailler.map((w, i) => (
                    <div key={i} className="bg-amber-50/60 border border-amber-200/50 rounded-md px-4 py-2.5">
                      <p className="text-marine font-semibold text-sm">{w.titre}</p>
                      <p className="text-marine/70 text-sm mt-0.5">{w.explication}</p>
                      <p className="text-marine/80 text-sm mt-1.5 flex items-start gap-1.5">
                        <Lightbulb size={14} className="text-gold-dark shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium">Piste :</span> {w.piste}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {advice.warnings.length > 0 && (
              <section>
                <h4 className="text-marine/55 text-xs uppercase tracking-wide font-semibold mb-1.5">Avertissements</h4>
                <ul className="space-y-1 text-marine/80 text-sm">
                  {advice.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-red-500 shrink-0">⚠</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-cream-dark/40">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-marine/75 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-sm transition-colors"
            >
              <ClipboardCopy size={14} />
              {copied ? '✓ Copié' : 'Copier en texte'}
            </button>
            <button
              type="button"
              onClick={() => setStage('idle')}
              className="px-4 py-2 bg-marine text-cream font-semibold rounded-md text-sm hover:bg-marine-light transition-colors"
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────

interface ModalProps {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  onClose?: () => void
  wide?: boolean
  children: React.ReactNode
}

function Modal({ title, icon: Icon, onClose, wide, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-marine/40 backdrop-blur-sm p-6 overflow-y-auto">
      <div className={`bg-cream rounded-lg shadow-2xl border border-cream-dark my-6 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="px-5 py-4 border-b border-cream-dark flex items-center gap-2.5">
          <Icon size={18} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-lg flex-1">{title}</h3>
          {onClose && (
            <button type="button" onClick={onClose} className="text-marine/45 hover:text-marine" aria-label="Fermer">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
