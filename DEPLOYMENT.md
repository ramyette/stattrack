# Deploying StatTrack

This guide deploys StatTrack to Vercel at `stattrack.ramyette.dev` while leaving `ramyette.dev` on GitHub Pages.

## 1. Before pushing to GitHub

Run every migration in `supabase/migrations` in filename order, including `20260703000008_open_registration.sql`.

Create monitored `support@ramyette.dev` and `security@ramyette.dev` aliases with your email provider, or replace those addresses in the environment settings and project documents before launch.

Run the local checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
git status
git ls-files .env.local
```

The final command must print nothing. Never commit `.env.local`, a Google client secret, a Supabase secret key, or downloaded OAuth credentials.

## 2. Prepare the public beta

In Google Auth Platform:

1. Configure Branding with the StatTrack name, support email, homepage, Privacy Policy, and Terms links.
2. Add `ramyette.dev` as an authorized domain.
3. Publish the OAuth app so its Audience status is In production. Testing mode only permits listed test users.

In Supabase:

1. Confirm that new user registration is enabled and disable every Auth provider except Google.
2. Review Authentication, Rate Limits and keep conservative defaults.
3. Open Database, Security Advisor and resolve findings that apply to application tables.
4. Open Storage settings and set the global upload limit to 3 MB.
5. Confirm `project-media` is private and limited to 3 MB image files.
6. Confirm `avatars` is public and limited to 2 MB image files.
7. Keep Realtime public access disabled.

## 3. Push to GitHub

Create a private GitHub repository for StatTrack, then run the commands GitHub displays. A normal update later uses:

```bash
git add .
git commit -m "Prepare StatTrack public beta"
git push
```

## 4. Import into Vercel

1. Sign into Vercel with GitHub.
2. Import the StatTrack repository.
3. Keep the detected Next.js settings.
4. Add these Production environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://stattrack.ramyette.dev
NEXT_PUBLIC_SUPPORT_EMAIL=support@ramyette.dev
```

Deploy and test the temporary `vercel.app` address before adding the custom domain.

## 5. Add the app subdomain

1. In Vercel, open the StatTrack project, then Settings, Domains.
2. Add `stattrack.ramyette.dev`.
3. In Namecheap, open Advanced DNS for `ramyette.dev`.
4. Add the CNAME record shown by Vercel. The host will be `stattrack`. Use Vercel's exact target value.
5. Do not remove or replace the existing GitHub Pages records for `ramyette.dev`.
6. Wait for Vercel to verify DNS and issue HTTPS.

## 6. Update production authentication

In Supabase, Authentication, URL Configuration:

```text
Site URL: https://stattrack.ramyette.dev
Redirect URL: http://localhost:3000/auth/callback
Redirect URL: https://stattrack.ramyette.dev/auth/callback
```

In the Google OAuth web client:

```text
Authorized JavaScript origin: http://localhost:3000
Authorized JavaScript origin: https://stattrack.ramyette.dev
Authorized redirect URI: https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

The Google callback remains on the default Supabase domain when using the free Supabase plan. The application itself still uses `stattrack.ramyette.dev`.

## 7. Final release test

Test first-time Google sign-in with a separate account, sign-out, project creation, video upload and deletion, analytics, invitations, blocked users, account deletion, mobile layout, light and dark themes, and denial of access to projects that account has not joined.

After Vercel is connected to GitHub, pushes to the production branch deploy automatically. Database migrations remain a separate Supabase step until a migration deployment workflow is added.
