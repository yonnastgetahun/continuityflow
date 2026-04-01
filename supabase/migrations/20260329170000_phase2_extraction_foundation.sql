-- Phase 2 foundation for Continuity Enhanced Accuracy Mode.
-- Adds extraction session persistence, review decision logging, and AI usage metering.

CREATE TYPE public.extraction_mode AS ENUM (
  'local_only',
  'enhanced_accuracy'
);

CREATE TYPE public.extraction_status AS ENUM (
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public.extraction_provider AS ENUM (
  'local',
  'ai',
  'fallback_local',
  'fused'
);

CREATE TYPE public.extraction_confidence AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE public.review_decision_source AS ENUM (
  'local',
  'ai',
  'heuristic',
  'fused',
  'manual'
);

CREATE TABLE public.extraction_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  source_document_type TEXT NOT NULL DEFAULT 'invoice',
  mode public.extraction_mode NOT NULL DEFAULT 'local_only',
  status public.extraction_status NOT NULL DEFAULT 'processing',
  requested_provider public.extraction_provider NOT NULL DEFAULT 'local',
  final_provider public.extraction_provider,
  ai_provider TEXT,
  is_scanned BOOLEAN NOT NULL DEFAULT false,
  used_fallback BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  ai_processed_at TIMESTAMP WITH TIME ZONE,
  ai_pages INTEGER NOT NULL DEFAULT 0,
  ai_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.extraction_field_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.extraction_sessions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  source public.extraction_provider NOT NULL,
  candidate_value TEXT,
  confidence public.extraction_confidence NOT NULL DEFAULT 'low',
  page_number INTEGER,
  evidence_snippet TEXT,
  selected_for_review BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.review_field_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.extraction_sessions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  local_value TEXT,
  ai_value TEXT,
  final_value TEXT,
  chosen_source public.review_decision_source NOT NULL DEFAULT 'manual',
  user_changed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_month DATE NOT NULL,
  ai_docs INTEGER NOT NULL DEFAULT 0,
  ai_pages INTEGER NOT NULL DEFAULT 0,
  ai_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_month)
);

ALTER TABLE public.extraction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_field_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_field_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extraction sessions"
  ON public.extraction_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own extraction sessions"
  ON public.extraction_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extraction sessions"
  ON public.extraction_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extraction sessions"
  ON public.extraction_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own extraction field candidates"
  ON public.extraction_field_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = extraction_field_candidates.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own extraction field candidates"
  ON public.extraction_field_candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = extraction_field_candidates.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own extraction field candidates"
  ON public.extraction_field_candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = extraction_field_candidates.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own extraction field candidates"
  ON public.extraction_field_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = extraction_field_candidates.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own review field decisions"
  ON public.review_field_decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = review_field_decisions.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own review field decisions"
  ON public.review_field_decisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = review_field_decisions.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own review field decisions"
  ON public.review_field_decisions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = review_field_decisions.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own review field decisions"
  ON public.review_field_decisions FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.extraction_sessions
      WHERE extraction_sessions.id = review_field_decisions.session_id
        AND extraction_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_monthly FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ai usage"
  ON public.ai_usage_monthly FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai usage"
  ON public.ai_usage_monthly FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai usage"
  ON public.ai_usage_monthly FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_extraction_sessions_updated_at
  BEFORE UPDATE ON public.extraction_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_usage_monthly_updated_at
  BEFORE UPDATE ON public.ai_usage_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
