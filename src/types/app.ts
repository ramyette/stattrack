export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  theme: "light" | "dark" | "system";
  allow_invites: boolean;
  auto_accept_invites: boolean;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  image_path: string | null;
  owner_id: string;
  created_at: string;
};

export type Video = {
  id: string;
  project_id: string;
  title: string;
  thumbnail_path: string;
  views: number;
  watch_hours: number;
  ctr: number;
  avd: string;
  likes: number;
  comments: number;
  hype: string | null;
  category: string | null;
  notes: string | null;
  published_at: string | null;
  created_at: string;
};
