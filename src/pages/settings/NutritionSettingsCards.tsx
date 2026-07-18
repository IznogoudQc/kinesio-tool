import { useEffect, useState } from 'react'
import { Apple, Ban, Check, Loader2, Pill, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { settingsService } from '../../services/settings'
import { aiAdviceService, AIAdviceError } from '../../services/aiAdvice'
import type { SupplementItem } from '../../lib/supplements'

type Status = 'idle' | 'saving' | 'saved' | 'error'

function aiErr(err: unknown): string {
  if (err instanceof AIAdviceError && err.code === 'NO_API_KEY') {
    return 'Clé API absente — ajoutez-la dans l’onglet IA.'
  }
  return err instanceof Error ? err.message : 'Erreur IA.'
}

const fieldClass =
  'px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors'

/** Bibliothèque de suppléments proposés (globale) — nom + moment, avec suggestion IA. */
export function SupplementLibraryCard() {
  const [items, setItems] = useState<SupplementItem[] | null>(null)
  const [label, setLabel] = useState('')
  const [timing, setTiming] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<number | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    settingsService.getSupplements().then(setItems).catch(() => setItems([]))
  }, [])

  function mutate(next: SupplementItem[]) {
    setItems(next)
    setDirty(true)
    setStatus('idle')
  }
  function add() {
    const l = label.trim()
    if (!l || !items) return
    if (items.some(it => it.label.toLowerCase() === l.toLowerCase())) return
    mutate([...items, { label: l, timing: timing.trim() }])
    setLabel('')
    setTiming('')
  }
  async function suggestNew() {
    const l = label.trim()
    if (!l) return
    setErr(null)
    setBusy('new')
    try {
      setTiming(await aiAdviceService.suggestSupplementTiming(l))
    } catch (e) {
      setErr(aiErr(e))
    } finally {
      setBusy(null)
    }
  }
  async function suggestRow(i: number) {
    if (!items) return
    setErr(null)
    setBusy(i)
    try {
      const t = await aiAdviceService.suggestSupplementTiming(items[i].label)
      mutate(items.map((it, k) => (k === i ? { ...it, timing: t } : it)))
    } catch (e) {
      setErr(aiErr(e))
    } finally {
      setBusy(null)
    }
  }
  async function save() {
    if (!items) return
    setStatus('saving')
    try {
      const clean = items.map(it => ({ label: it.label.trim(), timing: it.timing.trim() })).filter(it => it.label !== '')
      await settingsService.setSupplements(clean)
      setItems(clean)
      setDirty(false)
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch {
      setStatus('error')
    }
  }
  async function reset() {
    try {
      mutate(await settingsService.getDefaultSupplements())
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Pill size={18} className="text-gold-dark" />
        <h2 className="text-marine font-semibold text-lg">Suppléments proposés</h2>
      </div>
      <p className="text-marine/55 text-sm mb-4">
        Liste globale (tous clients) proposée dans l'onglet Nutrition. Nom + moment de prise ; « IA » suggère le moment.
      </p>

      {items === null ? (
        <p className="text-marine/40 text-sm">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && <p className="text-marine/45 text-sm">Aucun supplément. Ajoutez-en ci-dessous.</p>}
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 bg-cream/20 border border-cream-dark/50 rounded-md p-2">
              <input
                value={it.label}
                onChange={e => mutate(items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
                placeholder="Nom"
                className={`${fieldClass} font-medium w-40`}
              />
              <input
                value={it.timing}
                onChange={e => mutate(items.map((x, k) => (k === i ? { ...x, timing: e.target.value } : x)))}
                placeholder="Moment (ou « IA »)"
                className={`${fieldClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => suggestRow(i)}
                disabled={busy !== null || it.label.trim() === ''}
                title="Suggérer le moment avec l'IA"
                className="inline-flex items-center gap-1 text-gold-dark/80 hover:text-gold-dark text-xs shrink-0 disabled:opacity-40"
              >
                {busy === i ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              </button>
              <button
                type="button"
                onClick={() => mutate(items.filter((_, k) => k !== i))}
                className="text-marine/30 hover:text-red-600 shrink-0"
                title="Retirer"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Nom (ex. Ashwagandha)"
          className={`${fieldClass} sm:flex-1`}
        />
        <div className="flex gap-1 sm:flex-1">
          <input
            value={timing}
            onChange={e => setTiming(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Moment (ex. au coucher)"
            className={`${fieldClass} flex-1`}
          />
          <button
            type="button"
            onClick={suggestNew}
            disabled={label.trim() === '' || busy !== null}
            title="Proposer le moment avec l'IA"
            className="inline-flex items-center gap-1 px-2.5 rounded-md border border-gold/50 text-gold-dark text-sm hover:bg-gold/10 disabled:opacity-40 shrink-0"
          >
            {busy === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={label.trim() === ''}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-marine text-cream text-sm hover:bg-marine-light disabled:opacity-40 shrink-0"
        >
          <Plus size={15} /> Ajouter
        </button>
      </div>

      <SaveRow status={status} dirty={dirty} onSave={save} onReset={reset} />
    </section>
  )
}

/** Éditeur d'une liste d'aliments proposés (à privilégier / à éviter). */
export function FoodListCard({ title, variant }: { title: string; variant: 'good' | 'bad' }) {
  const [list, setList] = useState<string[] | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [dirty, setDirty] = useState(false)

  const set = (v: string[]) => (variant === 'good' ? settingsService.setFoodsGood(v) : settingsService.setFoodsBad(v))
  const getDefault = () =>
    variant === 'good' ? settingsService.getDefaultFoodsGood() : settingsService.getDefaultFoodsBad()

  useEffect(() => {
    const p = variant === 'good' ? settingsService.getFoodsGood() : settingsService.getFoodsBad()
    p.then(setList).catch(() => setList([]))
  }, [variant])

  function mutate(next: string[]) {
    setList(next)
    setDirty(true)
    setStatus('idle')
  }
  function add() {
    const p = draft.trim()
    if (!p || !list) return
    if (list.some(x => x.toLowerCase() === p.toLowerCase())) return
    mutate([...list, p])
    setDraft('')
  }
  async function save() {
    if (!list) return
    setStatus('saving')
    try {
      await set(list)
      setDirty(false)
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch {
      setStatus('error')
    }
  }
  async function reset() {
    try {
      mutate(await getDefault())
    } catch {
      /* ignore */
    }
  }

  const Icon = variant === 'good' ? Apple : Ban
  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className="text-gold-dark" />
        <h2 className="text-marine font-semibold text-lg">{title}</h2>
      </div>
      <p className="text-marine/55 text-sm mb-4">Liste globale proposée dans l'onglet Nutrition (tous clients).</p>

      {list === null ? (
        <p className="text-marine/40 text-sm">Chargement…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {list.length === 0 && <span className="text-marine/35 text-sm">Aucun aliment.</span>}
          {list.map(p => (
            <span
              key={p}
              className="inline-flex items-center gap-1 bg-cream/40 border border-cream-dark rounded-full pl-2.5 pr-1 py-0.5 text-sm text-marine"
            >
              {p}
              <button
                type="button"
                onClick={() => mutate(list.filter(x => x !== p))}
                className="text-marine/40 hover:text-red-600 transition-colors"
                aria-label={`Retirer ${p}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Ajouter un aliment…"
          className={`${fieldClass} flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-marine text-cream rounded-md text-sm hover:bg-marine-light transition-colors disabled:opacity-40"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <SaveRow status={status} dirty={dirty} onSave={save} onReset={reset} />
    </section>
  )
}

function SaveRow({
  status,
  dirty,
  onSave,
  onReset
}: {
  status: Status
  dirty: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || status === 'saving'}
        className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        Enregistrer
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-marine/60 hover:text-marine text-sm transition-colors"
      >
        <RotateCcw size={14} /> Réinitialiser
      </button>
      {status === 'saved' && <span className="text-green-600 text-sm">Enregistré ✓</span>}
      {status === 'error' && <span className="text-red-600 text-sm">Erreur d'enregistrement</span>}
    </div>
  )
}
