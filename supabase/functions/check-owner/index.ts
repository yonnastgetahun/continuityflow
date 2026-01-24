import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const ownerEmail = Deno.env.get('OWNER_EMAIL') || ''

  return new Response(
    JSON.stringify({ ownerEmail }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})