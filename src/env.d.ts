/// <reference types="vite/client" />

interface Client {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
}

interface Window {
  api: {
    clients: {
      list(): Promise<Client[]>
      create(data: { name: string; email: string }): Promise<Client>
      update(id: string, data: { name?: string; email?: string }): Promise<Client>
      delete(id: string): Promise<void>
    }
    app: {
      getVersion(): Promise<string>
    }
    update: {
      quitAndInstall(): Promise<void>
      onChecking(cb: () => void): void
      onAvailable(cb: (info: { version: string }) => void): void
      onNotAvailable(cb: () => void): void
      onDownloaded(cb: (info: { version: string }) => void): void
      onError(cb: (info: { message: string }) => void): void
    }
  }
}
