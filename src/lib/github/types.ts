export interface GitHubRawUser {
  login: string;
  id: number;
  avatar_url: string;
}

export interface GitHubRawLabel {
  id: number;
  name: string;
  color: string;
  description?: string | null;
}

export interface GitHubRawItem {
  id: number;
  number: number;
  title: string;
  user: GitHubRawUser | null;
  body: string | null;
  labels: (GitHubRawLabel | string)[];
  state: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  html_url: string;
  pull_request?: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
    merged_at?: string | null;
  };
  author_association?: string;
  state_reason?: string | null;
}

export interface GitHubRawFileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GitHubRepoDetails {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
  open_issues_count: number;
}
