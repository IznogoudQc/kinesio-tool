import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { formatBilanDate } from '../bilanFields'

interface BilansHistoryTableProps {
  bilans: Bilan[]
  clientId: string
}

function formatNumber(v: number | undefined): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return v.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}

export function BilansHistoryTable({ bilans, clientId }: BilansHistoryTableProps) {
  const navigate = useNavigate()

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={16} className="text-gold-dark" />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Historique des bilans</h3>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-marine/55 text-xs uppercase tracking-wide">
              <th className="text-left font-medium px-3 py-2">Date</th>
              <th className="text-right font-medium px-3 py-2">VO2max</th>
              <th className="text-right font-medium px-3 py-2">IMC</th>
              <th className="text-right font-medium px-3 py-2">% gras</th>
              <th className="text-right font-medium px-3 py-2">Tour taille</th>
              <th className="text-right font-medium px-3 py-2">Score global</th>
              <th className="text-right font-medium px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {bilans.map((b, i) => (
              <tr
                key={b.id}
                onClick={() => navigate(`/clients/${clientId}/bilans/${b.id}`)}
                className={`border-t border-cream-dark/40 hover:bg-cream/40 cursor-pointer transition-colors ${
                  i === 0 ? 'text-marine font-medium' : 'text-marine/75'
                }`}
              >
                <td className="px-3 py-2.5">
                  {formatBilanDate(b.date)}
                  {i === 0 && (
                    <span className="ml-2 text-gold-dark text-[10px] uppercase tracking-wide font-semibold">
                      récent
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.data.vo2max)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.data.imc)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.data.pourcentage_gras)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.data.tour_taille_cm)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.data.score_global)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-marine/50">
                  {b.source === 'import_docx' ? '.docx' : 'manuel'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
