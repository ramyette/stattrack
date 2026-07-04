# StatTrack

StatTrack is a YouTube statistics tracker built with Next.js and Supabase. It supports Google sign-in, shared projects, thumbnail storage, live database updates, video notes, and project analytics.

## Local development

1. Create a Supabase project and run the files in `supabase/migrations` in filename order.
2. Enable Google under Supabase Authentication providers and configure the Google OAuth client with the callback URL shown by Supabase.
3. Copy `.env.example` to `.env.local` and add your Supabase values.
4. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Deployment

Follow [DEPLOYMENT.md](./DEPLOYMENT.md). Production secrets belong in Vercel environment variables, never in Git.

## Security

See [SECURITY.md](./SECURITY.md). Database access is protected by Supabase Row Level Security. Anyone with a supported Google account can register.
