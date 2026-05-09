interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-cream-dark flex items-center px-6 shrink-0 shadow-sm">
      <h1 className="text-marine font-semibold text-base">{title}</h1>
    </header>
  )
}
