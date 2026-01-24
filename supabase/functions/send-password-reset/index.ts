import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  environment: 'production' | 'test';
  redirectUrl: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { email, environment, redirectUrl }: PasswordResetRequest = await req.json();

    console.log(`Password reset requested for ${email} in ${environment} environment`);

    // Validate required fields
    if (!email || !environment || !redirectUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client to generate reset link
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Generate password reset link with environment context
    const { data, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${redirectUrl}?env=${environment}`,
      }
    });

    if (resetError) {
      console.error("Failed to generate reset link:", resetError);
      // Don't reveal if user exists or not for security
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = data?.properties?.action_link;
    if (!resetLink) {
      console.error("No reset link generated");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Environment-specific branding
    const isTest = environment === 'test';
    const brandName = isTest ? 'Continuity — Test Environment' : 'Continuity';
    const envNote = isTest 
      ? '<p style="color: #b45309; background: #fef3c7; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 24px;">⚠️ This is a <strong>test environment</strong> password reset. Test accounts are separate from production.</p>'
      : '';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
    <div style="padding: 32px 32px 24px; border-bottom: 1px solid #f3f4f6;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">${brandName}</h1>
    </div>
    <div style="padding: 32px;">
      ${envNote}
      <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111827;">Reset your password</h2>
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        You requested a password reset for your account. Click the button below to set a new password.
      </p>
      <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
        Reset Password
      </a>
      <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="padding: 24px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        ${isTest ? 'Test Environment • ' : ''}Sent by ${brandName}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send the email
    const { error: sendError } = await resend.emails.send({
      from: "Continuity <noreply@resend.dev>",
      to: [email],
      subject: `${brandName} — Reset your password`,
      html: emailHtml,
    });

    if (sendError) {
      console.error("Failed to send email:", sendError);
      // Still return success to not reveal if email exists
    } else {
      console.log(`Password reset email sent to ${email} for ${environment}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
