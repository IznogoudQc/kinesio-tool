interface PlaceholderTabProps {
  title: string
}

export function PlaceholderTab({ title }: PlaceholderTabProps) {
  return (
    <div className="p-8 max-w-3xl">
      <div className="bg-marine-light/95 border border-gold/20 rounded-xl p-8 text-center text-cream">
        <h2 className="text-cream font-semibold text-lg">{title}</h2>
        <p className="text-cream/60 text-base mt-2">
          Cette section sera disponible dans une prochaine version.
        </p>
      </div>
    </div>
  )
}
