import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients } from '../../db/schema'
import { getSmtpCredentials } from './settings'

const isDev = !app.isPackaged

const SendBilanSchema = z.object({
  clientId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20000)
})

async function generateDashboardPdf(clientId: string): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 1500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    const hash = `/clients/${clientId}/dashboard?print=1`
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    await new Promise(resolve => setTimeout(resolve, 1500))

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: { marginType: 'default' }
    })

    const tempPath = join(app.getPath('temp'), `bilan-${clientId}-${Date.now()}.pdf`)
    await fs.writeFile(tempPath, pdfData)
    return tempPath
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export function registerEmailHandlers(): void {
  ipcMain.handle('email:sendBilan', async (_e, data: unknown) => {
    const validated = SendBilanSchema.parse(data)

    const client = getDb().select().from(clients).where(eq(clients.id, validated.clientId)).get()
    if (!client) throw new Error('Client introuvable.')

    const credentials = await getSmtpCredentials()
    if (!credentials) {
      throw new Error('Configuration SMTP incomplète. Configurez votre SMTP dans Paramètres.')
    }

    let pdfPath: string | null = null
    try {
      pdfPath = await generateDashboardPdf(validated.clientId)

      const transporter = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        auth: { user: credentials.user, pass: credentials.password }
      })

      await transporter.sendMail({
        from: credentials.user,
        to: client.email,
        subject: validated.subject,
        text: validated.body,
        attachments: [
          {
            filename: `bilan-${client.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
            path: pdfPath
          }
        ]
      })

      return { sentTo: client.email }
    } finally {
      if (pdfPath) {
        try {
          await fs.unlink(pdfPath)
        } catch {
          // best effort cleanup
        }
      }
    }
  })
}
