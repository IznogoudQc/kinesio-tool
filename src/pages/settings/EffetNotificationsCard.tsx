import { useCallback, useEffect, useState } from 'react'
import { BellRing, KeyRound, Loader2, RefreshCw } from 'lucide-react'
import { effetNotificationsService } from '../../services/effetNotifications'

/**
 * Veille sur les messages des clientes dans Effet.
 *
 * Trois choses, et chacune compte :
 *  - la clé d'accès, saisie une fois puis jamais réaffichée — l'interface peut
 *    l'envoyer, pas la relire ;
 *  - l'interrupteur, pour les séances où Marie ne veut pas être dérangée ;
 *  - l'heure du dernier contrôle, sans laquelle « personne ne m'a écrit » et
 *    « ça ne marche plus » se ressemblent trop.
 *
 * La carte ne montre jamais le contenu d'un message, ni même le nom d'une
 * cliente : elle ne sait rien d'autre que ce que renvoie `getStatus()`.
 */

/** « il y a 4 minutes » plutôt qu'une heure absolue : ce qui importe est la
 *  fraîcheur, pas l'horodatage. Au-delà d'un jour, la date parle mieux. */
function depuis(iso: string | null): string {
  if (!iso) return 'jamais'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'à l’instant'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes === 1) return 'il y a 1 minute'
  if (minutes < 60) return `il y a ${minutes} minutes`
  const heures = Math.floor(minutes / 60)
  if (heures === 1) return 'il y a 1 heure'
  if (heures < 24) return `il y a ${heures} heures`
  return new Date(iso).toLocaleString('fr-CA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function EffetNotificationsCard() {
  const [statut, setStatut] = useState<EffetVeilleStatus | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [remplacer, setRemplacer] = useState(false)
  const [erreurCle, setErreurCle] = useState<string | null>(null)

  const recharger = useCallback(() => {
    effetNotificationsService
      .getStatus()
      .then(setStatut)
      .catch(() => setStatut(null))
  }, [])

  useEffect(() => {
    recharger()
    // L'heure affichée doit vieillir toute seule, sinon elle donne une fausse
    // impression de fraîcheur dès qu'on laisse l'écran ouvert.
    const t = setInterval(recharger, 30_000)
    return () => clearInterval(t)
  }, [recharger])

  async function basculer(actives: boolean) {
    setOccupe(true)
    try {
      setStatut(await effetNotificationsService.setActives(actives))
    } finally {
      setOccupe(false)
    }
  }

  async function verifier() {
    setOccupe(true)
    try {
      setStatut(await effetNotificationsService.verifier())
    } finally {
      setOccupe(false)
    }
  }

  async function enregistrerCle(cle: string) {
    setOccupe(true)
    setErreurCle(null)
    try {
      setStatut(await effetNotificationsService.setCle(cle))
      setSaisie('')
      setRemplacer(false)
    } catch {
      setErreurCle('La clé n’a pas pu être enregistrée sur ce poste.')
    } finally {
      setOccupe(false)
    }
  }

  if (!statut) return null

  const saisieOuverte = !statut.cleConfiguree || remplacer

  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <BellRing size={18} className="text-gold" />
        <h2 className="text-marine font-semibold text-lg">Messages des clientes</h2>
      </div>
      <p className="text-marine/55 text-sm mb-4">
        Kinésio Outils surveille Effet en arrière-plan et vous prévient sur le bureau quand une
        cliente vous écrit. La notification ne montre jamais le message — seulement qui a écrit.
      </p>

      {!statut.cleConfiguree ? (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800 text-sm">
          Aucune clé d’accès à Effet sur ce poste : aucune vérification n’a lieu.
        </div>
      ) : (
        !statut.operationnelle && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800 text-sm">
            Effet a refusé la clé d’accès : les vérifications sont suspendues. Saisissez une nouvelle clé.
          </div>
        )
      )}

      <div className="mb-5 pb-4 border-b border-cream-dark/50">
        {saisieOuverte ? (
          <form
            className="flex items-center gap-2 flex-wrap"
            onSubmit={e => {
              e.preventDefault()
              if (saisie.trim()) void enregistrerCle(saisie)
            }}
          >
            <KeyRound size={16} className="text-marine/45" />
            <input
              type="password"
              value={saisie}
              onChange={e => setSaisie(e.target.value)}
              placeholder="Clé d’accès à Effet"
              autoComplete="off"
              spellCheck={false}
              disabled={occupe}
              className="flex-1 min-w-[12rem] px-3 py-2 border border-cream-dark rounded-md text-sm text-marine focus:outline-none focus:border-gold/60"
            />
            <button
              type="submit"
              disabled={occupe || !saisie.trim()}
              className="px-3.5 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              Enregistrer
            </button>
            {remplacer && (
              <button
                type="button"
                onClick={() => {
                  setRemplacer(false)
                  setSaisie('')
                }}
                disabled={occupe}
                className="px-3 py-2 text-marine/60 text-sm hover:text-marine"
              >
                Annuler
              </button>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <KeyRound size={16} className="text-marine/45" />
            <p className="text-marine/70 text-sm flex-1">Clé d’accès enregistrée (chiffrée sur ce poste).</p>
            <button
              type="button"
              onClick={() => setRemplacer(true)}
              disabled={occupe}
              className="px-3 py-1.5 border border-cream-dark text-marine rounded-md text-sm hover:border-gold/60 disabled:opacity-50"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={() => void enregistrerCle('')}
              disabled={occupe}
              className="px-3 py-1.5 text-marine/60 text-sm hover:text-red-700 disabled:opacity-50"
            >
              Effacer
            </button>
          </div>
        )}
        {erreurCle && <p className="text-red-700 text-sm mt-2">{erreurCle}</p>}
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={statut.actives}
          disabled={occupe}
          onChange={e => void basculer(e.target.checked)}
          className="accent-gold"
        />
        <span className="text-marine text-base">M’avertir quand une cliente écrit</span>
      </label>
      {!statut.actives && (
        <p className="text-marine/45 text-xs mt-1.5 ml-7">
          Les vérifications continuent : vous retrouverez les messages dans Effet.
        </p>
      )}

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-cream-dark/50 flex-wrap">
        <p className="text-marine/55 text-sm flex-1 min-w-[12rem]">
          Dernière vérification&nbsp;: <strong className="text-marine">{depuis(statut.derniereVerification)}</strong>
        </p>
        <button
          type="button"
          onClick={() => void verifier()}
          disabled={occupe}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-cream-dark text-marine font-medium rounded-md text-sm hover:border-gold/60 disabled:opacity-50"
        >
          {occupe ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Vérifier maintenant
        </button>
      </div>
    </section>
  )
}
