import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import bodyMale from '@/assets/body-male.png'
import bodyFemale from '@/assets/body-female.png'
import { clientsService } from '@/services/clients'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<Size, string> = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-40 h-40'
}

const ICON_SIZES: Record<Size, number> = { sm: 18, md: 28, lg: 40, xl: 64 }

type AvatarClient = Pick<Client, 'name' | 'sex' | 'avatarFilename'>

/**
 * Photo de profil ronde d'un client. Affiche la photo si elle existe, sinon la
 * silhouette générale selon le sexe, sinon une icône générique.
 */
export function ClientAvatar({
  client,
  size = 'md',
  className
}: {
  client: AvatarClient
  size?: Size
  className?: string
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (client.avatarFilename) {
      clientsService
        .getAvatarUrl(client.avatarFilename)
        .then(url => {
          if (!cancelled) setPhotoUrl(url)
        })
        .catch(() => {
          if (!cancelled) setPhotoUrl(null)
        })
    } else {
      setPhotoUrl(null)
    }
    return () => {
      cancelled = true
    }
  }, [client.avatarFilename])

  const silhouette = client.sex === 'F' ? bodyFemale : client.sex === 'M' ? bodyMale : null
  const wrapperClass = `${SIZES[size]} rounded-full overflow-hidden bg-marine/8 flex items-center justify-center shrink-0${className ? ` ${className}` : ''}`

  if (photoUrl) {
    return (
      <div className={wrapperClass}>
        <img src={photoUrl} alt={client.name} draggable={false} className="w-full h-full object-cover select-none" />
      </div>
    )
  }

  if (silhouette) {
    return (
      <div className={wrapperClass}>
        <img
          src={silhouette}
          alt=""
          aria-hidden
          draggable={false}
          className="w-full h-full object-cover object-top select-none"
        />
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <User size={ICON_SIZES[size]} className="text-marine/35" />
    </div>
  )
}
