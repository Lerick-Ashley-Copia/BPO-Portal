-- Split the single `name` column into structured firstName/middleName/lastName.
ALTER TABLE "users" ADD COLUMN "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN "middleName" TEXT;
ALTER TABLE "users" ADD COLUMN "lastName" TEXT;

-- Backfill from the existing `name` column: the first whitespace-separated
-- token becomes firstName, everything after it becomes lastName. No attempt
-- to guess a middle name from existing data — affected users can fill it in
-- via the admin Edit UI.
UPDATE "users"
SET
  "firstName" = split_part("name", ' ', 1),
  "lastName" = CASE
    WHEN position(' ' in "name") > 0 THEN trim(substring("name" from position(' ' in "name") + 1))
    ELSE ''
  END;

ALTER TABLE "users" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "lastName" SET NOT NULL;

ALTER TABLE "users" DROP COLUMN "name";
