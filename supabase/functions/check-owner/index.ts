import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const ownerEmail = Deno.env.get('OWNER_EMAIL')?.toLowerCase() || ''

    // If no auth header, return isOwner: false (not authenticated)
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No auth header provided')
      return new Response(
        JSON.stringify({ isOwner: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user) {
      console.log('Invalid token or no user:', error?.message)
      return new Response(
        JSON.stringify({ isOwner: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = data.user.email?.toLowerCase() || ''
    const isOwner = userEmail === ownerEmail

    console.log(`User ${userEmail} checked ownership: ${isOwner}`)

    return new Response(
      JSON.stringify({ isOwner }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error in check-owner:', err)
    return new Response(
      JSON.stringify({ isOwner: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
