import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`faqs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`category\` text DEFAULT 'general' NOT NULL,
  	\`home\` integer,
  	\`order\` numeric DEFAULT 10,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`faqs_updated_at_idx\` ON \`faqs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`faqs_created_at_idx\` ON \`faqs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`faqs_locales\` (
  	\`question\` text NOT NULL,
  	\`answer\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`faqs_locales_locale_parent_id_unique\` ON \`faqs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`faqs_locales_parent_id_idx\` ON \`faqs_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`slug\` text NOT NULL,
  	\`draft\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pages_locales\` (
  	\`title\` text NOT NULL,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_locales_locale_parent_id_unique\` ON \`pages_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_locales_parent_id_idx\` ON \`pages_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`messages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`email\` text NOT NULL,
  	\`topic\` text,
  	\`message\` text NOT NULL,
  	\`locale\` text,
  	\`website\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`messages_updated_at_idx\` ON \`messages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`messages_created_at_idx\` ON \`messages\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`faqs_id\` integer,
  	\`pages_id\` integer,
  	\`messages_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`messages_id\`) REFERENCES \`messages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_faqs_id_idx\` ON \`payload_locked_documents_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_messages_id_idx\` ON \`payload_locked_documents_rels\` (\`messages_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`app_url\` text DEFAULT 'https://my.qr-codex.com',
  	\`free_downloads\` numeric DEFAULT 1,
  	\`content_version\` numeric,
  	\`contact_email\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`settings_locales\` (
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`nav_why\` text,
  	\`nav_offer\` text,
  	\`nav_generator\` text,
  	\`nav_story\` text,
  	\`nav_how\` text,
  	\`nav_features\` text,
  	\`nav_solutions\` text,
  	\`nav_pricing\` text,
  	\`nav_faq\` text,
  	\`nav_contact\` text,
  	\`nav_login\` text,
  	\`nav_try_free\` text,
  	\`nav_menu\` text,
  	\`nav_close\` text,
  	\`footer_tagline\` text,
  	\`footer_product\` text,
  	\`footer_company\` text,
  	\`footer_legal\` text,
  	\`footer_cancel\` text,
  	\`footer_language\` text,
  	\`footer_rights\` text,
  	\`contact_page_title\` text,
  	\`contact_page_text\` text,
  	\`contact_page_name\` text,
  	\`contact_page_email\` text,
  	\`contact_page_topic\` text,
  	\`contact_page_topics\` text,
  	\`contact_page_message\` text,
  	\`contact_page_send\` text,
  	\`contact_page_sent\` text,
  	\`contact_page_error\` text,
  	\`contact_page_privacy\` text,
  	\`contact_page_customers\` text,
  	\`faq_page_title\` text,
  	\`faq_page_text\` text,
  	\`faq_page_general\` text,
  	\`faq_page_billing\` text,
  	\`faq_page_more\` text,
  	\`not_found_title\` text,
  	\`not_found_text\` text,
  	\`not_found_back\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`settings_locales_locale_parent_id_unique\` ON \`settings_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`settings_locales_parent_id_idx\` ON \`settings_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`home_hero_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_hero_items_order_idx\` ON \`home_hero_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_hero_items_parent_id_idx\` ON \`home_hero_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_hero_items_locale_idx\` ON \`home_hero_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_trust_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_trust_items_order_idx\` ON \`home_trust_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_trust_items_parent_id_idx\` ON \`home_trust_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_trust_items_locale_idx\` ON \`home_trust_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_dive_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_dive_items_order_idx\` ON \`home_dive_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_dive_items_parent_id_idx\` ON \`home_dive_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_dive_items_locale_idx\` ON \`home_dive_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_story_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_story_items_order_idx\` ON \`home_story_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_story_items_parent_id_idx\` ON \`home_story_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_story_items_locale_idx\` ON \`home_story_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_how_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_how_items_order_idx\` ON \`home_how_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_how_items_parent_id_idx\` ON \`home_how_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_how_items_locale_idx\` ON \`home_how_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_features_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_features_items_order_idx\` ON \`home_features_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_features_items_parent_id_idx\` ON \`home_features_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_features_items_locale_idx\` ON \`home_features_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_pricing_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_pricing_items_order_idx\` ON \`home_pricing_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_pricing_items_parent_id_idx\` ON \`home_pricing_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_pricing_items_locale_idx\` ON \`home_pricing_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_faq_items_order_idx\` ON \`home_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_faq_items_parent_id_idx\` ON \`home_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_faq_items_locale_idx\` ON \`home_faq_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home_final_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_final_items_order_idx\` ON \`home_final_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_final_items_parent_id_idx\` ON \`home_final_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_final_items_locale_idx\` ON \`home_final_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`home\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`home_locales\` (
  	\`hero_chapter\` text,
  	\`hero_eyebrow\` text,
  	\`hero_title\` text,
  	\`hero_text\` text,
  	\`hero_cta\` text,
  	\`hero_cta2\` text,
  	\`hero_note\` text,
  	\`trust_chapter\` text,
  	\`trust_eyebrow\` text,
  	\`trust_title\` text,
  	\`trust_text\` text,
  	\`trust_cta\` text,
  	\`trust_cta2\` text,
  	\`trust_note\` text,
  	\`dive_chapter\` text,
  	\`dive_eyebrow\` text,
  	\`dive_title\` text,
  	\`dive_text\` text,
  	\`dive_cta\` text,
  	\`dive_cta2\` text,
  	\`dive_note\` text,
  	\`story_chapter\` text,
  	\`story_eyebrow\` text,
  	\`story_title\` text,
  	\`story_text\` text,
  	\`story_cta\` text,
  	\`story_cta2\` text,
  	\`story_note\` text,
  	\`how_chapter\` text,
  	\`how_eyebrow\` text,
  	\`how_title\` text,
  	\`how_text\` text,
  	\`how_cta\` text,
  	\`how_cta2\` text,
  	\`how_note\` text,
  	\`features_chapter\` text,
  	\`features_eyebrow\` text,
  	\`features_title\` text,
  	\`features_text\` text,
  	\`features_cta\` text,
  	\`features_cta2\` text,
  	\`features_note\` text,
  	\`pricing_chapter\` text,
  	\`pricing_eyebrow\` text,
  	\`pricing_title\` text,
  	\`pricing_text\` text,
  	\`pricing_cta\` text,
  	\`pricing_cta2\` text,
  	\`pricing_note\` text,
  	\`faq_chapter\` text,
  	\`faq_eyebrow\` text,
  	\`faq_title\` text,
  	\`faq_text\` text,
  	\`faq_cta\` text,
  	\`faq_cta2\` text,
  	\`faq_note\` text,
  	\`final_chapter\` text,
  	\`final_eyebrow\` text,
  	\`final_title\` text,
  	\`final_text\` text,
  	\`final_cta\` text,
  	\`final_cta2\` text,
  	\`final_note\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`home_locales_locale_parent_id_unique\` ON \`home_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_locales_parent_id_idx\` ON \`home_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pricing_plans_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pricing_plans\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pricing_plans_items_order_idx\` ON \`pricing_plans_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pricing_plans_items_parent_id_idx\` ON \`pricing_plans_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pricing_plans_items_locale_idx\` ON \`pricing_plans_items\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`pricing_plans\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`price_month\` numeric NOT NULL,
  	\`price_year\` numeric NOT NULL,
  	\`price_year_after\` numeric NOT NULL,
  	\`popular\` integer,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pricing\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pricing_plans_order_idx\` ON \`pricing_plans\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pricing_plans_parent_id_idx\` ON \`pricing_plans\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pricing_plans_locales\` (
  	\`name\` text,
  	\`lead\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pricing_plans\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pricing_plans_locales_locale_parent_id_unique\` ON \`pricing_plans_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pricing_plans_locales_parent_id_idx\` ON \`pricing_plans_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pricing_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pricing\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pricing_rows_order_idx\` ON \`pricing_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pricing_rows_parent_id_idx\` ON \`pricing_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pricing_rows_locales\` (
  	\`label\` text,
  	\`standard\` text,
  	\`pro\` text,
  	\`business\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pricing_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pricing_rows_locales_locale_parent_id_unique\` ON \`pricing_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pricing_rows_locales_parent_id_idx\` ON \`pricing_rows_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pricing\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`pricing_locales\` (
  	\`title\` text,
  	\`subtitle\` text,
  	\`monthly\` text,
  	\`yearly\` text,
  	\`yearly_badge\` text,
  	\`per_month\` text,
  	\`per_first_year\` text,
  	\`month_note\` text,
  	\`year_note\` text,
  	\`cta\` text,
  	\`popular\` text,
  	\`vat_note\` text,
  	\`compare_title\` text,
  	\`compare_feature\` text,
  	\`faq_title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pricing\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pricing_locales_locale_parent_id_unique\` ON \`pricing_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pricing_locales_parent_id_idx\` ON \`pricing_locales\` (\`_parent_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`faqs\`;`)
  await db.run(sql`DROP TABLE \`faqs_locales\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`DROP TABLE \`pages_locales\`;`)
  await db.run(sql`DROP TABLE \`messages\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`settings\`;`)
  await db.run(sql`DROP TABLE \`settings_locales\`;`)
  await db.run(sql`DROP TABLE \`home_hero_items\`;`)
  await db.run(sql`DROP TABLE \`home_trust_items\`;`)
  await db.run(sql`DROP TABLE \`home_dive_items\`;`)
  await db.run(sql`DROP TABLE \`home_story_items\`;`)
  await db.run(sql`DROP TABLE \`home_how_items\`;`)
  await db.run(sql`DROP TABLE \`home_features_items\`;`)
  await db.run(sql`DROP TABLE \`home_pricing_items\`;`)
  await db.run(sql`DROP TABLE \`home_faq_items\`;`)
  await db.run(sql`DROP TABLE \`home_final_items\`;`)
  await db.run(sql`DROP TABLE \`home\`;`)
  await db.run(sql`DROP TABLE \`home_locales\`;`)
  await db.run(sql`DROP TABLE \`pricing_plans_items\`;`)
  await db.run(sql`DROP TABLE \`pricing_plans\`;`)
  await db.run(sql`DROP TABLE \`pricing_plans_locales\`;`)
  await db.run(sql`DROP TABLE \`pricing_rows\`;`)
  await db.run(sql`DROP TABLE \`pricing_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`pricing\`;`)
  await db.run(sql`DROP TABLE \`pricing_locales\`;`)
}
