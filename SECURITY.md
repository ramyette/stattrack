# Security policy

## Reporting a vulnerability

Please report security issues privately to `ramyette.dev@gmail.com`. Do not open a public GitHub issue for a suspected vulnerability or include private user data in a report.

Include the affected page, a clear description, and reproduction steps when possible. Do not access another person's data, disrupt the service, or perform load testing without written permission.

## Supported version

The current production deployment is the only supported version during the public beta.

## Security model

- Google and Supabase provide authentication.
- Anyone with a supported Google account can register. Authentication is still required to use application data.
- Supabase Row Level Security controls project, profile, invitation, video, and activity access.
- Storage restricts file types, file sizes, paths, ownership, and upload counts.
- Database triggers enforce mutation rates and hard project, member, invitation, and video limits.
- Secret and service-role keys are never included in browser code.

No system is perfectly secure. Reports made in good faith will be reviewed promptly.
