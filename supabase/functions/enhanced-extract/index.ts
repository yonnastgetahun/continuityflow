import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { z } from "https://esm.sh/zod@3.25.76";
import {
  evaluateEnhancedAccuracyAccess,
  getEnhancedAccuracySettings,
} from "./policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const evidenceSchema = z.object({
  docType: z.enum(["invoice", "w9"]),
  pageNumber: z.number().int().nonnegative(),
  snippet: z.string(),
});

const extractedFieldSchema = z.object({
  value: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: evidenceSchema,
});

const extractedFieldsSchema = z.object({
  vendor: z.object({
    name: extractedFieldSchema,
    address: extractedFieldSchema,
    city: extractedFieldSchema,
    state: extractedFieldSchema,
    zip: extractedFieldSchema,
    taxId: extractedFieldSchema,
    email: extractedFieldSchema,
    phone: extractedFieldSchema,
  }),
  invoice: z.object({
    invoiceNumber: extractedFieldSchema,
    invoiceDate: extractedFieldSchema,
    dueDate: extractedFieldSchema,
    subtotal: extractedFieldSchema,
    tax: extractedFieldSchema,
    total: extractedFieldSchema,
  }),
});

const requestSchema = z.object({
  invoiceDoc: z.object({
    fullText: z.string(),
    fileName: z.string(),
    isScanned: z.boolean(),
    pageCount: z.number().int().nonnegative(),
  }),
  w9Doc: z
    .object({
      fullText: z.string(),
      fileName: z.string(),
      isScanned: z.boolean(),
      pageCount: z.number().int().nonnegative(),
    })
    .nullable()
    .optional(),
  localExtractedFields: extractedFieldsSchema,
  requestedProvider: z.literal("ai"),
  requestedMode: z.literal("enhanced_accuracy"),
  metadata: z.record(z.unknown()).optional(),
});

const responseSchema = z.object({
  extractedFields: extractedFieldsSchema,
  aiProvider: z.string(),
  usage: z.object({
    aiDocs: z.number().int().nonnegative(),
    aiPages: z.number().int().nonnegative(),
    aiCostUsd: z.number().nonnegative(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

function calculateUsageCost(
  promptTokens: number,
  completionTokens: number,
): number {
  const inputPerMillion = Number(Deno.env.get("AI_INPUT_COST_PER_1M") ?? "0");
  const outputPerMillion = Number(Deno.env.get("AI_OUTPUT_COST_PER_1M") ?? "0");

  if (inputPerMillion <= 0 && outputPerMillion <= 0) {
    return 0;
  }

  return Number(
    (
      (promptTokens / 1_000_000) * inputPerMillion +
      (completionTokens / 1_000_000) * outputPerMillion
    ).toFixed(4),
  );
}

function getDeniedResponse(reason: string): Response {
  switch (reason) {
    case "feature_disabled":
      return jsonResponse({ error: "Enhanced Accuracy is temporarily disabled" }, 503);
    case "provider_not_configured":
      return jsonResponse({ error: "Enhanced extraction provider is not configured" }, 503);
    case "plan_required":
      return jsonResponse({ error: "Enhanced Accuracy requires Pro access" }, 403);
    case "monthly_doc_limit_reached":
      return jsonResponse({ error: "Enhanced Accuracy monthly document limit reached" }, 429);
    case "monthly_page_limit_exceeded":
      return jsonResponse({ error: "Enhanced Accuracy monthly page limit exceeded" }, 429);
    case "monthly_cost_limit_reached":
      return jsonResponse({ error: "Enhanced Accuracy monthly cost limit reached" }, 429);
    default:
      return jsonResponse({ error: "Enhanced Accuracy is unavailable" }, 503);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const requestData = requestSchema.parse(await req.json());
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await authedClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = authData.user.id;
    const { data: profile, error: profileError } = await authedClient
      .from("profiles")
      .select("plan_type, subscription_status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    const settings = getEnhancedAccuracySettings({
      ENHANCED_ACCURACY_ENABLED: Deno.env.get("ENHANCED_ACCURACY_ENABLED"),
      ENHANCED_ACCURACY_MAX_DOCS_PER_MONTH: Deno.env.get("ENHANCED_ACCURACY_MAX_DOCS_PER_MONTH"),
      ENHANCED_ACCURACY_MAX_PAGES_PER_MONTH: Deno.env.get("ENHANCED_ACCURACY_MAX_PAGES_PER_MONTH"),
      ENHANCED_ACCURACY_MAX_COST_USD_PER_MONTH: Deno.env.get("ENHANCED_ACCURACY_MAX_COST_USD_PER_MONTH"),
      AI_EXTRACTION_API_KEY: Deno.env.get("AI_EXTRACTION_API_KEY"),
      OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
    });

    const apiKey =
      Deno.env.get("AI_EXTRACTION_API_KEY") ??
      Deno.env.get("OPENAI_API_KEY") ??
      "";
    const model =
      Deno.env.get("AI_EXTRACTION_MODEL") ??
      Deno.env.get("OPENAI_MODEL") ??
      "gpt-4.1-mini";
    const baseUrl =
      Deno.env.get("AI_EXTRACTION_BASE_URL") ??
      Deno.env.get("OPENAI_BASE_URL") ??
      "https://api.openai.com/v1";

    const invoiceText = requestData.invoiceDoc.fullText.trim();
    const w9Text = requestData.w9Doc?.fullText.trim() ?? "";
    const usageMonth = new Date().toISOString().slice(0, 7) + "-01";
    const usageClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : authedClient;
    const requestedPages = requestData.invoiceDoc.pageCount + (requestData.w9Doc?.pageCount ?? 0);

    const { data: existingUsage } = await usageClient
      .from("ai_usage_monthly")
      .select("id, ai_docs, ai_pages, ai_cost_usd")
      .eq("user_id", userId)
      .eq("usage_month", usageMonth)
      .maybeSingle();

    const accessDecision = evaluateEnhancedAccuracyAccess({
      profile,
      settings,
      currentUsage: {
        ai_docs: existingUsage?.ai_docs ?? 0,
        ai_pages: existingUsage?.ai_pages ?? 0,
        ai_cost_usd: Number(existingUsage?.ai_cost_usd ?? 0),
      },
      requestedPages,
    });

    if (!accessDecision.allowed) {
      return getDeniedResponse(accessDecision.reason);
    }

    const prompt = `
You extract structured invoice and W-9 fields for production finance.
Return strict JSON only with this exact shape:
{
  "extractedFields": {
    "vendor": {
      "name": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "address": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "city": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "state": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "zip": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "taxId": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "email": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "phone": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}}
    },
    "invoice": {
      "invoiceNumber": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "invoiceDate": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "dueDate": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "subtotal": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "tax": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}},
      "total": {"value":"","confidence":"high|medium|low","evidence":{"docType":"invoice|w9","pageNumber":0,"snippet":""}}
    }
  }
}

Rules:
- Preserve empty strings for unknown values.
- Prefer W-9 for tax ID and vendor legal identity when stronger than invoice.
- Use pageNumber 0 and empty snippet only when evidence is unavailable.
- Never include markdown or explanation.

Invoice text:
${invoiceText || "[no text extracted from invoice]"}

W-9 text:
${w9Text || "[no W-9 provided or no text extracted]"}

Local extraction reference:
${JSON.stringify(requestData.localExtractedFields)}
    `.trim();

    const aiResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You return strict JSON for invoice extraction.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      return jsonResponse({ error: `AI provider request failed: ${errorBody}` }, 502);
    }

    const aiJson = await aiResponse.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return jsonResponse({ error: "AI provider returned no content" }, 502);
    }

    const parsedJson = JSON.parse(stripCodeFence(content));
    const validated = responseSchema.parse({
      ...parsedJson,
      aiProvider: baseUrl.includes("openai") ? "openai" : "custom-compatible",
      usage: {
        aiDocs: 1,
        aiPages: requestData.invoiceDoc.pageCount + (requestData.w9Doc?.pageCount ?? 0),
        aiCostUsd: calculateUsageCost(
          Number(aiJson?.usage?.prompt_tokens ?? 0),
          Number(aiJson?.usage?.completion_tokens ?? 0),
        ),
      },
      metadata: {
        processingMode: "in-memory-only",
        temporaryStorage: false,
        promptTokens: Number(aiJson?.usage?.prompt_tokens ?? 0),
        completionTokens: Number(aiJson?.usage?.completion_tokens ?? 0),
        scannedInvoice: requestData.invoiceDoc.isScanned,
        scannedW9: requestData.w9Doc?.isScanned ?? false,
      },
    });

    if (existingUsage?.id) {
      await usageClient
        .from("ai_usage_monthly")
        .update({
          ai_docs: (existingUsage.ai_docs ?? 0) + validated.usage.aiDocs,
          ai_pages: (existingUsage.ai_pages ?? 0) + validated.usage.aiPages,
          ai_cost_usd: Number((Number(existingUsage.ai_cost_usd ?? 0) + validated.usage.aiCostUsd).toFixed(4)),
        })
        .eq("id", existingUsage.id);
    } else {
      await usageClient
        .from("ai_usage_monthly")
        .insert({
          user_id: userId,
          usage_month: usageMonth,
          ai_docs: validated.usage.aiDocs,
          ai_pages: validated.usage.aiPages,
          ai_cost_usd: validated.usage.aiCostUsd,
        });
    }

    return jsonResponse(validated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected enhanced extraction error";
    return jsonResponse({ error: message }, 500);
  }
});
