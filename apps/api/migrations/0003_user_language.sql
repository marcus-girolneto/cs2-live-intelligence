-- Interface and AI language chosen in the web language selector (null = not chosen yet).
-- Scheduled reports and other AI output written without a request use it.
ALTER TABLE users
  ADD COLUMN lang text CHECK (lang IN ('en', 'pt', 'es', 'ru', 'zh', 'de', 'fr', 'pl', 'tr'));
