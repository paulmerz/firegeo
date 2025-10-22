-- Workspace-level overrides for competitor visibility/preferences
CREATE TABLE IF NOT EXISTS competitor_edge_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hidden boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT uq_competitor_edge_override UNIQUE (company_id, competitor_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_edge_overrides_workspace ON competitor_edge_overrides(workspace_id);
CREATE INDEX IF NOT EXISTS idx_competitor_edge_overrides_company ON competitor_edge_overrides(company_id);
CREATE INDEX IF NOT EXISTS idx_competitor_edge_overrides_competitor ON competitor_edge_overrides(competitor_id);

