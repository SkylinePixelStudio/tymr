import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://atqwdzanlfvxkzlmxtsz.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cXdkemFubGZ2eGt6bG14dHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDc5ODAsImV4cCI6MjA4ODY4Mzk4MH0.eVpTMbk2G-CoZmSa4YAEl5MagTQB_JlYvA5zA05OA1M"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)