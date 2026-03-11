-- Merge data from irfangede1789 (Dark mode user) to paypediaindonesia (Light mode user)
-- Old user: e07e258b-d1c6-4ad3-8741-98118336fca9
-- New user: b9c759d2-f3a1-4b9f-9de1-25e14be30db1

DO $$
DECLARE
  old_uid uuid := 'e07e258b-d1c6-4ad3-8741-98118336fca9';
  new_uid uuid := 'b9c759d2-f3a1-4b9f-9de1-25e14be30db1';
  tbl text;
BEGIN
  -- Tables that have user_id column
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'user_id' AND table_schema = 'public'
    AND table_name NOT IN ('audit_log_entries')
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I SET user_id = $1 WHERE user_id = $2', tbl) USING new_uid, old_uid;
      RAISE NOTICE 'Merged user data in table: %', tbl;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped table % (error: %)', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

SELECT 'User data merged successfully' AS result;
