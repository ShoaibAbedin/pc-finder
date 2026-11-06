-- Phase 6: assembled builds are stored with each ranking run (lets the UI show "total ▼ $45 since last update").
alter table ranking_runs add column if not exists builds jsonb;
