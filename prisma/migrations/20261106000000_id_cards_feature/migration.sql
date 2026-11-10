INSERT INTO "features" ("id", "key", "name", "description", "created_at", "updated_at")
VALUES (
  'feature_id_cards',
  'id_cards',
  'Student & Staff ID Cards',
  'Generate and print school identity cards',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
