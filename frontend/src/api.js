import { supabase } from './supabaseClient'

// This is a temporary wrapper to help with the transition from Axios to Supabase
// In a full migration, you would use supabase directly in your components.

const api = {
  get: async (url, config = {}) => {
    // Basic mapping of some common URLs to Supabase tables
    // This is just to prevent immediate crashes while we migrate pages
    const table = url.split('/')[1]
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    return { data }
  },
  post: async (url, body, config = {}) => {
    const table = url.split('/')[1]
    const { data, error } = await supabase.from(table).insert(body).select()
    if (error) throw error
    return { data }
  },
  // Add other methods as needed
}

export default supabase // Prefer exporting supabase directly
export { api }
