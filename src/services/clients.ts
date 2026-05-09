export const clientsService = {
  async list(): Promise<Client[]> {
    return window.api.clients.list()
  },

  async create(data: { name: string; email: string }): Promise<Client> {
    return window.api.clients.create(data)
  },

  async update(id: string, data: { name?: string; email?: string }): Promise<Client> {
    return window.api.clients.update(id, data)
  },

  async delete(id: string): Promise<void> {
    return window.api.clients.delete(id)
  }
}
