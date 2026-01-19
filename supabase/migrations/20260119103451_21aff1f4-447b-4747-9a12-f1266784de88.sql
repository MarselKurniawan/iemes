
-- Add missing enum values for asset_category
ALTER TYPE asset_category ADD VALUE IF NOT EXISTS 'elektronik';
ALTER TYPE asset_category ADD VALUE IF NOT EXISTS 'perabot';

-- Add missing location type  
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'warehouse';
