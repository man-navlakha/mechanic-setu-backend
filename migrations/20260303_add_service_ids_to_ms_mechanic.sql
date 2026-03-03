-- Add service_ids array to MS_mechanic so mechanics can declare which services they offer
-- Run AFTER 20260303_create_services_table.sql

ALTER TABLE "MS_mechanic"
    ADD COLUMN IF NOT EXISTS service_ids INTEGER[] DEFAULT '{}';

-- GIN index for fast array containment queries: WHERE $1 = ANY(service_ids)
CREATE INDEX IF NOT EXISTS idx_ms_mechanic_service_ids ON "MS_mechanic" USING GIN(service_ids);
