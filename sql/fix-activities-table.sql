-- This migration creates a view named 'activities' as an alias for 'activity_log'
-- to ensure backward compatibility for any queries that still reference the old name.
CREATE OR REPLACE VIEW activities AS
SELECT * FROM activity_log;
