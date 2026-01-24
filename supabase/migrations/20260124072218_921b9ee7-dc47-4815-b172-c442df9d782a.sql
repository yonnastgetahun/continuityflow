-- Add exported_at column to track when PO was downloaded
ALTER TABLE public.purchase_orders
ADD COLUMN exported_at timestamp with time zone DEFAULT NULL;