-- Initial schema: channels, messages, streamers, config
-- Pulled from remote via `supabase db dump`

CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT 'Uncategorized'::"text" NOT NULL,
    "is_live" boolean DEFAULT false NOT NULL,
    "thumbnail_url" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."config" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "is_shutdown" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "text" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "username" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."streamers" (
    "id" "text" NOT NULL,
    "channel_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "personality" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text" DEFAULT ''::"text" NOT NULL,
    "model" "text" DEFAULT 'flash'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "streamers_model_check" CHECK (("model" = ANY (ARRAY['flash'::"text", 'pro'::"text"])))
);

-- Primary keys
ALTER TABLE ONLY "public"."channels"  ADD CONSTRAINT "channels_pkey"  PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."config"    ADD CONSTRAINT "config_pkey"    PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."messages"  ADD CONSTRAINT "messages_pkey"  PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."streamers" ADD CONSTRAINT "streamers_pkey" PRIMARY KEY ("id");

-- Indexes
CREATE INDEX "idx_messages_channel_created" ON "public"."messages" USING "btree" ("channel_id", "created_at");
CREATE UNIQUE INDEX "idx_streamers_channel_id"   ON "public"."streamers" USING "btree" ("channel_id");

-- Triggers
CREATE OR REPLACE TRIGGER "on_channels_updated"  BEFORE UPDATE ON "public"."channels"  FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE OR REPLACE TRIGGER "on_streamers_updated" BEFORE UPDATE ON "public"."streamers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- Foreign keys
ALTER TABLE ONLY "public"."messages"  ADD CONSTRAINT "messages_channel_id_fkey"  FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."streamers" ADD CONSTRAINT "streamers_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;

-- RLS
ALTER TABLE "public"."channels"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."config"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."streamers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select"        ON "public"."channels"  FOR SELECT USING (true);
CREATE POLICY "Anyone can read config" ON "public"."config"    FOR SELECT USING (true);
CREATE POLICY "messages_insert"        ON "public"."messages"  FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_select"        ON "public"."messages"  FOR SELECT USING (true);
CREATE POLICY "streamers_select"       ON "public"."streamers" FOR SELECT USING (true);

-- Realtime
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";
