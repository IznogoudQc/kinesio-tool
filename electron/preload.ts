import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  clients: {
    list: () =>
      ipcRenderer.invoke('clients:list'),
    create: (data: { name: string; email: string }) =>
      ipcRenderer.invoke('clients:create', data),
    update: (id: string, data: { name?: string; email?: string }) =>
      ipcRenderer.invoke('clients:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('clients:delete', id)
  },
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke('app:get-version')
  },
  update: {
    quitAndInstall: (): Promise<void> =>
      ipcRenderer.invoke('update:quit-and-install'),
    onChecking: (cb: () => void) =>
      ipcRenderer.on('update:checking', cb),
    onAvailable: (cb: (info: { version: string }) => void) =>
      ipcRenderer.on('update:available', (_e, data) => cb(data)),
    onNotAvailable: (cb: () => void) =>
      ipcRenderer.on('update:not-available', cb),
    onDownloaded: (cb: (info: { version: string }) => void) =>
      ipcRenderer.on('update:downloaded', (_e, data) => cb(data)),
    onError: (cb: (info: { message: string }) => void) =>
      ipcRenderer.on('update:error', (_e, data) => cb(data))
  }
})
