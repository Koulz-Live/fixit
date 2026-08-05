# Fixit Security Operations

## Identity and RBAC

Supabase Auth is the only identity provider and JWT issuer. The application never stores passwords or creates a parallel identity record. `profiles` contains application attributes linked to `auth.users` by user ID.

Tenant-plane access and platform administration are deliberately separate:

- `memberships` records ordinary tenant users only.
- `tenant_role_assignments` records client and artisan marketplace contexts.
- `platform_admin_assignments` records one of seven administrative tiers.
- `role_permissions` maps those seven tiers to explicit capabilities.
- PostgreSQL RLS and security-definer authorization functions enforce decisions at the data authority.

The seven tiers are Tier 1, Tier 2, Tier 3, Manager, Executive, Auditor, and Super Admin. A person without an administrative assignment remains a tenant user and is not an administrator.

## WAF

The Vercel project has a production rule named `Fixit API rate limit`:

- Match: request path starts with `/api`
- Key: source IP
- Window: 60 seconds
- Limit: 100 requests
- Action: HTTP 429 rate limit

Vercel's platform firewall and DDoS mitigation remain the outer boundary. Node functions add defense-in-depth controls for payload size, request origin, method, correlation IDs, and narrower mutation limits.

Recommended next WAF controls should first run in Log mode before enforcement:

1. Log credential-stuffing patterns against `/login`.
2. Challenge clearly automated traffic to browser-only routes.
3. Deny known probe paths such as WordPress administration endpoints that Fixit does not expose.
4. Enable the managed OWASP ruleset if the Vercel plan supports it.

## SIEM

Application and RBAC events are written to `security_events` and emitted as structured JSON from Vercel Functions. The `/security` console is restricted by `security.events.read`.

Configure a Vercel Log Drain to the enterprise SIEM with these sources:

- `firewall`
- `lambda`
- `build`

Collect both Production and Preview, but apply stricter retention and alerting to Production. Alert on critical events, repeated authorization denials, rate limiting, administrative role changes, and recovery actions. Never include access tokens, API keys, request authorization headers, passwords, or raw personal data in event metadata.

## Deployment order

1. Apply `supabase/migrations/202608050001_security_rbac_siem.sql`.
2. Verify the migrated admin assignments and role-permission catalogue.
3. Deploy the React and Vercel Function changes.
4. Sign in as Super Admin and verify `/access` and `/security`.
5. Configure the Vercel Log Drain and validate receipt in the SIEM.

## Financial integrity

Fixit Finance uses tenant-scoped, append-only double-entry journals. Supabase RPCs create all posting lines and refuse to post an unbalanced journal. OpenAI receives aggregate management-account figures only and can save draft commentary, but cannot create or alter journal entries. Management accounts remain platform-generated until an artisan or accountant explicitly reviews them.
