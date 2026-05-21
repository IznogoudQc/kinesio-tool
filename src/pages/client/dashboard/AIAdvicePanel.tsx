import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ClipboardCopy, Info, KeyRound, Loader2, Mail, X } from 'lucide-react'
import { useAIAdvice, type MetricSelection } from '../../../contexts/AIAdviceContext'
import { computeAge } from '../../../lib/norms'
import { AIAdviceError, aiAdviceService, formatAdviceAsText, type AIAdvice } from '../../../services/aiAdvice'

interface AIAdvicePanelProps {
  client: Pick<Client, 'birthdate' | 'sex'>
}

/**
 * Panneau flottant + modals pour le mode « Conseils IA ». Affiché toujours
 * (le FAB lui-même est visible seulement quand le mode est actif).
 *
 * Trois écrans :
 *   1. FAB en bas-droite : compte + boutons Annuler / Générer.
 *   2. Modal payload : preview anonymisé, [Annuler] [Confirmer et générer].
 *   3. Modal résultat : spinner → conseils structurés + actions (Copier / Email / etc.).
 */
export function AIAdvicePanel({ client }: AIAdvicePanelProps) {
  const ai = useAIAdvice()
  const navigate = useNavigate()
  const [stage, setStage] = useState<'idle' | 'payload' | 'loading' | 'result' | 'no-key'>('idle')
  const [advice, setAdvice] = useState<AIAdvice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const age = computeAge(client.birthdate)
  const metrics: MetricSelection[] = Array.from(ai.selection.values())

  // Empêche le scroll du body quand un modal est ouvert.
  useEffect(() => {
    if (stage === 'idle') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [stage])

  // Esc ferme le modal courant.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (stage === 'payload' || stage === 'result' || stage === 'no-key') setStage('idle')
      // Pendant le loading on n'autorise pas l'Esc (sinon spinner orphelin).
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage])

  async function handleGenerate() {
    setStage('loading')
    setError(null)
    try {
      const result = await aiAdviceService.generate({
        sex: client.sex,
        age,
        metrics
      })
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

  if (!ai.mode) return null

  return (
    <>
      {/* FAB — visible quand le mode est actif, indépendamment de la sélection. */}
      <div className="fixed bottom-5 right-5 z-30">
        <div className="bg-marine text-cream rounded-xl shadow-2xl border border-marine-light/40 p-4 min-w-[260px]">
          <p className="text-cream/85 text-sm">
            <span className="text-gold font-semibold tabular-nums">({ai.count})</span>{' '}
            métrique{ai.count > 1 ? 's' : ''} sélectionnée{ai.count > 1 ? 's' : ''}
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setStage('payload')}
              disabled={ai.count === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Bot size={15} />
              Générer les conseils IA
            </button>
            {ai.count > 0 && (
              <button
                type="button"
                onClick={ai.clear}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-cream/65 hover:text-cream text-xs transition-colors"
              >
                <X size={13} />
                Annuler la sélection
              </button>
            )}
          </div>
          {ai.count === 0 && (
            <p className="text-cream/55 text-xs mt-2">
              Cochez les métriques à analyser ensemble.
            </p>
          )}
        </div>
      </div>

      {/* Modal payload preview */}
      {stage === 'payload' && (
        <Modal title="Génération des conseils IA" icon={Bot} onClose={() => setStage('idle')}>
          <p className="text-marine/65 text-sm mb-3">Données anonymes envoyées :</p>
          <div className="bg-cream/50 border border-cream-dark/40 rounded-md p-3 text-marine text-sm font-mono space-y-1.5 mb-4">
            <div>
              <span className="text-marine/60">Sexe :</span>{' '}
              {client.sex === 'F' ? 'Femme' : client.sex === 'M' ? 'Homme' : '—'}
            </div>
            <div>
              <span className="text-marine/60">Âge :</span> {age !== null ? `${age} ans` : '—'}
            </div>
            {metrics.map(m => (
              <div key={m.key}>
                <span className="text-marine/60">{m.label} :</span>{' '}
                <span className="font-semibold">
                  {m.value}
                  {m.unit && ` ${m.unit}`}
                </span>
                {m.category && <span className="text-marine/60"> · {m.category}</span>}
                {typeof m.percentile === 'number' && (
                  <span className="text-marine/60"> · {Math.round(m.percentile)}e percentile</span>
                )}
              </div>
            ))}
          </div>
          <div className="bg-gold/10 border border-gold/30 rounded-md p-3 text-marine/70 text-xs flex items-start gap-2 mb-4">
            <Info size={14} className="text-gold-dark shrink-0 mt-0.5" />
            <span>
              Aucune donnée identifiable n'est envoyée (pas de nom, courriel, notes). Le client reste
              anonyme côté API.
            </span>
          </div>
          {error && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
              {error}
            </div>
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
              Confirmer et générer
            </button>
          </div>
        </Modal>
      )}

      {/* Modal loading */}
      {stage === 'loading' && (
        <Modal title="Génération des conseils IA" icon={Bot} onClose={undefined}>
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 size={32} className="text-gold-dark animate-spin" />
            <p className="text-marine/70 text-sm mt-3">Analyse en cours… (2-5 secondes)</p>
            <p className="text-marine/40 text-xs mt-1">
              {metrics.length} métrique{metrics.length > 1 ? 's' : ''} corrélée
              {metrics.length > 1 ? 's' : ''}.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal NO_API_KEY — propose d'aller dans les Réglages */}
      {stage === 'no-key' && (
        <Modal title="Clé API requise" icon={KeyRound} onClose={() => setStage('idle')}>
          <p className="text-marine/75 text-sm mb-4">
            Aucune clé API Anthropic configurée. Allez dans{' '}
            <span className="font-medium text-marine">Réglages → Conseils IA</span> pour en ajouter
            une.
          </p>
          <p className="text-marine/50 text-xs mb-5">
            Vous pouvez obtenir une clé sur{' '}
            <span className="font-mono">console.anthropic.com</span>.
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
        <Modal title="Conseils intégrés" icon={Bot} onClose={() => setStage('idle')} wide>
          <div className="space-y-4">
            <Section title="Diagnostic">
              <p className="text-marine/80 text-sm leading-relaxed">{advice.diagnostic}</p>
            </Section>
            <Section title="Objectifs prioritaires">
              <BulletList items={advice.objectifsPrioritaires} />
            </Section>
            <Section title="Programme intégré">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SubSection title="Cardio" items={advice.programmeIntegre.cardio} />
                <SubSection title="Musculation" items={advice.programmeIntegre.musculation} />
                <SubSection title="Souplesse" items={advice.programmeIntegre.souplesse} />
                <SubSection title="Habitudes" items={advice.programmeIntegre.habitudes} />
              </div>
            </Section>
            <Section title="Échéance">
              <p className="text-marine/80 text-sm">{advice.echeance}</p>
            </Section>
            <Section title="Avertissements">
              <BulletList items={advice.warnings} />
            </Section>
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
              disabled
              title="À venir — intégration avec le template email existant"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-marine/50 border border-cream-dark rounded-md text-sm cursor-not-allowed opacity-60"
            >
              <Mail size={14} />
              Envoyer au client
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
      <div
        className={`bg-cream rounded-lg shadow-2xl border border-cream-dark my-6 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="px-5 py-4 border-b border-cream-dark flex items-center gap-2.5">
          <Icon size={18} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-lg flex-1">{title}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-marine/45 hover:text-marine"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-marine/55 text-xs uppercase tracking-wide font-semibold mb-1.5">{title}</h4>
      {children}
    </section>
  )
}

function SubSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white border border-cream-dark/40 rounded-md p-3">
      <p className="text-marine font-semibold text-sm mb-1.5">{title}</p>
      <BulletList items={items} />
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-marine/80 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-gold-dark shrink-0">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
