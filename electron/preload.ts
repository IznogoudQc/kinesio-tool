import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  clients: {
    list: () =>
      ipcRenderer.invoke('clients:list'),
    create: (data: { name: string; email: string }) =>
      ipcRenderer.invoke('clients:create', data),
    update: (
      id: string,
      data: { name?: string; email?: string; birthdate?: string | null; sex?: 'F' | 'M' | null }
    ) =>
      ipcRenderer.invoke('clients:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('clients:delete', id),
    pickAvatar: () =>
      ipcRenderer.invoke('clients:pick-avatar'),
    setAvatar: (clientId: string, sourcePath: string) =>
      ipcRenderer.invoke('clients:set-avatar', clientId, sourcePath),
    removeAvatar: (clientId: string) =>
      ipcRenderer.invoke('clients:remove-avatar', clientId),
    getAvatarUrl: (filename: string) =>
      ipcRenderer.invoke('clients:get-avatar-url', filename)
  },
  mesures: {
    circ: {
      list: (clientId: string) =>
        ipcRenderer.invoke('mesures:circ:list', clientId),
      create: (clientId: string, data: unknown) =>
        ipcRenderer.invoke('mesures:circ:create', clientId, data),
      update: (id: string, data: unknown) =>
        ipcRenderer.invoke('mesures:circ:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('mesures:circ:delete', id)
    },
    plis: {
      list: (clientId: string) =>
        ipcRenderer.invoke('mesures:plis:list', clientId),
      create: (clientId: string, data: unknown) =>
        ipcRenderer.invoke('mesures:plis:create', clientId, data),
      update: (id: string, data: unknown) =>
        ipcRenderer.invoke('mesures:plis:update', id, data),
      delete: (id: string) =>
        ipcRenderer.invoke('mesures:plis:delete', id)
    }
  },
  settings: {
    getProfile: () =>
      ipcRenderer.invoke('settings:profile:get'),
    setProfile: (data: { name: string; signature: string }) =>
      ipcRenderer.invoke('settings:profile:set', data),
    getSmtpConfig: () =>
      ipcRenderer.invoke('settings:smtp:get'),
    setSmtpConfig: (data: { host: string; port: number; user: string; secure: boolean }) =>
      ipcRenderer.invoke('settings:smtp:set', data),
    setSmtpPassword: (password: string) =>
      ipcRenderer.invoke('settings:smtp:setPassword', password),
    hasSmtpPassword: () =>
      ipcRenderer.invoke('settings:smtp:hasPassword'),
    testSmtpConnection: () =>
      ipcRenderer.invoke('settings:smtp:test'),
    getEmailTemplate: () =>
      ipcRenderer.invoke('settings:template:get'),
    setEmailTemplate: (data: { subject: string; body: string }) =>
      ipcRenderer.invoke('settings:template:set', data)
  },
  reports: {
    generatePdf: (clientId: string) =>
      ipcRenderer.invoke('reports:generate-pdf', clientId),
    openPath: (filePath: string) =>
      ipcRenderer.invoke('reports:open-path', filePath),
    sendEmail: (data: { clientId: string; subject: string; body: string }) =>
      ipcRenderer.invoke('reports:send-email', data),
    exportJson: (clientId: string) =>
      ipcRenderer.invoke('reports:export-json', clientId),
    pickImportFile: () =>
      ipcRenderer.invoke('reports:pick-import-file'),
    importJson: (data: { filePath: string; mode?: 'create' | 'merge' }) =>
      ipcRenderer.invoke('reports:import-json', data)
  },
  bilans: {
    pickDocxFile: () =>
      ipcRenderer.invoke('bilans:pick-docx'),
    parseDocx: (clientId: string, filePath: string) =>
      ipcRenderer.invoke('bilans:parse-docx', clientId, filePath),
    create: (clientId: string, payload: { date: string; data: unknown; source?: string }) =>
      ipcRenderer.invoke('bilans:create', clientId, payload),
    importBilans: (clientId: string, items: { date: string; data: unknown }[]) =>
      ipcRenderer.invoke('bilans:import', { clientId, bilans: items }),
    update: (id: string, payload: { date?: string; data?: unknown }) =>
      ipcRenderer.invoke('bilans:update', id, payload),
    delete: (id: string) =>
      ipcRenderer.invoke('bilans:delete', id),
    dedupe: (clientId: string) =>
      ipcRenderer.invoke('bilans:dedupe', clientId),
    list: (clientId: string) =>
      ipcRenderer.invoke('bilans:list', clientId),
    getById: (id: string) =>
      ipcRenderer.invoke('bilans:get-by-id', id)
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
