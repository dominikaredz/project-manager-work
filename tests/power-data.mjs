export const state = { calls: [], pages: [], createError: null, updateError: null, deleteError: null }

export function getClient() {
  return {
    async createRecordAsync(table, record) {
      state.calls.push({ operation: 'create', table, record })
      if (state.createError) return { success: false, error: state.createError }
      const primaryKeys = {
        dredz_clients: 'dredz_clientid',
        dredz_products: 'dredz_productid',
        systemusers: 'systemuserid',
      }
      return { success: true, data: { ...record, ...(primaryKeys[table] ? { [primaryKeys[table]]: '66666666-6666-6666-6666-666666666666' } : {}) } }
    },
    async updateRecordAsync(table, id, record) {
      state.calls.push({ operation: 'update', table, id, record })
      if (state.updateError) return { success: false, error: state.updateError }
      return { success: true, data: record }
    },
    async deleteRecordAsync(table, id) {
      state.calls.push({ operation: 'delete', table, id })
      if (state.deleteError) return { success: false, error: state.deleteError }
      return { success: true, data: undefined }
    },
    async retrieveMultipleRecordsAsync(table, options) {
      state.calls.push({ operation: 'getAll', table, options })
      return state.pages.shift() ?? { success: true, data: [] }
    },
  }
}
