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

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Password reset request received`);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service not configured. Please contact support." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { email, environment, redirectUrl }: PasswordResetRequest = await req.json();

    console.log(`[${requestId}] Reset for ${email?.slice(0, 3)}*** in ${environment}`);

    // Validate required fields
    if (!email || !environment || !redirectUrl) {
      console.warn(`[${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Please provide your email address." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn(`[${requestId}] Invalid email format`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Please enter a valid email address." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Generate password reset link with environment context
    // Using admin.generateLink automatically:
    // - Creates a single-use token
    // - Sets 1-hour expiration
    // - Invalidates any previous pending reset tokens for this user
    const { data, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${redirectUrl}?env=${environment}&t=${Date.now()}`,
      }
    });

    if (resetError) {
      console.error(`[${requestId}] Failed to generate reset link:`, resetError.message);
      // Always return success to prevent email enumeration attacks
      // But log the actual error for debugging
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, you'll receive a reset link shortly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = data?.properties?.action_link;
    if (!resetLink) {
      console.error(`[${requestId}] No reset link in response`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, you'll receive a reset link shortly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Environment-specific branding
    const isTest = environment === 'test';
    const brandName = isTest ? 'Continuity — Test Environment' : 'Continuity';
    const envBadge = isTest 
      ? '<span style="display: inline-block; background: #fef3c7; color: #b45309; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px;">TEST</span>'
      : '';
    const envNote = isTest 
      ? '<div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;"><p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">⚠️ <strong>Test Environment</strong> — This reset is for your test account only. Test accounts are completely separate from production.</p></div>'
      : '';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background: #f4f4f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: #ffffff; border-radius: 8px 8px 0 0; border: 1px solid #e4e4e7; border-bottom: none; padding: 24px 32px;">
      <div style="display: flex; align-items: center;">
        <div style="width: 32px; height: 32px; background: #2563eb; border-radius: 6px; display: inline-block;"></div>
        <span style="margin-left: 12px; font-size: 18px; font-weight: 600; color: #18181b;">Continuity</span>
        ${envBadge}
      </div>
    </div>
    
    <!-- Content -->
    <div style="background: #ffffff; border: 1px solid #e4e4e7; border-top: none; border-bottom: none; padding: 32px;">
      ${envNote}
      
      <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Reset your password</h1>
      
      <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6;">
        You requested a password reset for your ${isTest ? 'test ' : ''}account. Click the button below to choose a new password.
      </p>
      
      <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Reset Password →
      </a>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f4f4f5;">
        <p style="margin: 0 0 8px; color: #71717a; font-size: 13px; line-height: 1.5;">
          <strong>Security notes:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #71717a; font-size: 13px; line-height: 1.6;">
          <li>This link expires in <strong>1 hour</strong></li>
          <li>This link can only be used <strong>once</strong></li>
          <li>Any previous reset links are now invalid</li>
        </ul>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #fafafa; border-radius: 0 0 8px 8px; border: 1px solid #e4e4e7; border-top: none; padding: 20px 32px;">
      <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.5;">
        If you didn't request this reset, you can safely ignore this email. Your password won't change unless you click the link above.
      </p>
      <p style="margin: 12px 0 0; color: #a1a1aa; font-size: 11px;">
        ${isTest ? 'Test Environment • ' : ''}Sent by ${brandName}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send the email
    const { data: emailData, error: sendError } = await resend.emails.send({
      from: "Continuity <noreply@resend.dev>",
      to: [email],
      subject: `${brandName} — Reset your password`,
      html: emailHtml,
    });

    if (sendError) {
      console.error(`[${requestId}] Failed to send email:`, sendError);
      // Return success to prevent enumeration, but with generic message
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, you'll receive a reset link shortly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] Email sent successfully to ${email?.slice(0, 3)}*** (ID: ${emailData?.id})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset email sent! Check your inbox for a link to reset your password.",
        sent: true
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Something went wrong. Please try again or contact support." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
