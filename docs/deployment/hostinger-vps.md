# Deploying BMS on a Hostinger VPS

This deployment uses Docker Compose with a private PostgreSQL service, a non-root Next.js container, and Caddy for HTTPS. Caddy asks the application whether a hostname is allowed before requesting an on-demand certificate. Tenant subdomains require an existing tenant; customer-owned domains require an existing DNS-verified alias with the `custom_domain` plan feature.

## Before the first deployment

1. Point `eduorg.ng` and `*.eduorg.ng` DNS A records to the VPS IPv4 address. Keep the email provider's MX, SPF, DKIM, and DMARC records intact.
2. Make sure Hostinger's firewall allows inbound TCP ports 22, 80, and 443.
3. Copy `.env.production.example` to `.env.production` on the VPS. Fill the domain, ACME contact email, database credentials, and session secret. Generate random secrets with `openssl rand -hex 32`. The database password must match in `POSTGRES_PASSWORD` and `DATABASE_URL`.
4. Generate `TENANT_SECRET_ENCRYPTION_KEY` with `openssl rand -base64 32`. Keep a secure off-server backup. The app encrypts school Paystack keys with it; losing or changing this key without re-encrypting stored keys makes those school credentials unusable.
5. `PAYSTACK_SECRET_KEY` is the BMS platform account key for school subscriptions and Result PIN platform payments. Do not use it for school fees. Each school enters its own Paystack secret from its admin dashboard under **Settings → Payment Options**; the app stores that key encrypted and uses it only for that school’s fee checkouts.
6. In each school’s Paystack dashboard, configure the webhook URL as `https://eduorg.ng/api/webhooks/paystack` (replace with your root domain). The webhook signature is verified using that school’s own secret key. Configure the same test/live mode key in BMS and Paystack.
7. Set `.env.production` permissions to owner-only (`chmod 600 .env.production`). Do not put the completed file in Git or paste it into chat.
8. Configure SMTP and S3-compatible object storage before enabling email delivery and uploads. Production upload code rejects local-disk storage. WhatsApp result messages also require Meta Cloud API credentials and an approved template configured in `.env.production`; until then, the app records them as not configured instead of claiming they were delivered.

## Start services

From the project directory on the VPS:

```sh
docker compose --env-file .env.production config
docker compose --env-file .env.production up -d --build
```

The database is not published on a public port. The app and migration service can reach it on a private Docker network. The app container runs as a non-root user. Database migrations must succeed before the app starts. Caddy owns ports 80/443 and stores its certificates in a persistent Docker volume.

## One-time platform initialization

After services are up, copy `.env.seed.example` to `.env.seed`, set a unique super-admin email and password, then run the production seed once:

```sh
docker compose --env-file .env.production run --rm seed
```

The one-shot seed container gets only the database URL and `.env.seed` credentials; the app container never receives the super-admin password. This seeds only global platform setup and the super-admin account; it does not create demo tenants or students. The seed refuses to run without a super-admin email and a password of at least 16 characters. After successful seeding, remove `.env.seed` from the VPS. Do not run `db:seed:demo` in production.

## Verify

```sh
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 app caddy migrate
```

Check `https://eduorg.ng`, then a real tenant subdomain. The first HTTPS request for a hostname can take a few seconds while Caddy obtains a certificate. A tenant hostname is certificate-eligible only when its slug exists. A custom domain is certificate-eligible only after DNS verification and only while the tenant has the Enterprise custom-domain feature.

`NEXT_PUBLIC_ROOT_DOMAIN` is embedded during the image build. Rebuild the app image after changing it. Keep Hostinger VPS backups enabled, and also arrange a separate off-VPS PostgreSQL backup before storing real school data.
