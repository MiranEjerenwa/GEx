# GEx Platform — AI-Readable Project Context & Migration TODO

> This document is designed to be consumed by AI coding assistants (Kiro, Cursor, Copilot, etc.)
> to provide full context for continuing development, debugging, or migrating this project.

## Project Identity
- **Name**: GEx (Gift Experiences)
- **Purpose**: E-gift experience marketplace — users buy experience gifts (sailing, cooking classes, spa days, etc.) for others who redeem and book them
- **Branding**: Gold (#D4A843) and Black theme, Playfair Display + Inter fonts
- **Tagline**: "Give Moments, Not Things"

## Tech Stack
- **Monorepo**: npm workspaces at `~/TechFortress/GEx`
- **Language**: TypeScript throughout (frontend + backend + infra)
- **Frontend**: React 18 + Vite + React Router, 3 apps (public, partner portal, admin portal)
- **Backend**: 11 Express.js microservices on ECS Fargate behind shared ALB
- **Infrastructure**: AWS CDK v2 (TypeScript), 5 stacks
- **Auth**: Amazon Cognito (3 user pools: purchaser, partner, admin)
- **Databases**: DynamoDB (catalog, orders, wishlists, community, admin) + Aurora Serverless v2 PostgreSQL (gift-card, booking, partner, payment)
- **Events**: EventBridge bus + 9 SQS queues
- **CDN**: CloudFront + S3 for frontend assets
- **API**: API Gateway HTTP v2 → VPC Link → ALB → Fargate services

## Repository Structure
```
GEx/
├── packages/
│   ├── shared-types/          # Shared TypeScript types, enums, event interfaces
│   ├── infra/                 # CDK infrastructure code
│   │   └── src/
│   │       ├── app.ts         # CDK app entry point
│   │       ├── config.ts      # Dev/prod environment configs
│   │       ├── constructs/    # FargateService reusable construct
│   │       └── stacks/        # 5 CDK stacks
│   │           ├── shared-infrastructure-stack.ts  # VPC, ECS cluster, S3, CloudFront, Cognito, DAX, ECR
│   │           ├── database-stack.ts               # Aurora clusters + DynamoDB tables
│   │           ├── services-stack.ts               # 11 Fargate services + ALB + IAM policies
│   │           ├── api-routing-stack.ts             # API Gateway HTTP v2 + VPC Link
│   │           └── event-wiring-stack.ts            # EventBridge bus + SQS queues
│   ├── services/              # 11 backend microservices
│   │   ├── auth/              # Cognito integration, login, register, token refresh
│   │   ├── catalog/           # DynamoDB-backed experience catalog, categories, occasions
│   │   ├── order/             # DynamoDB-backed order creation (was PostgreSQL, migrated)
│   │   ├── gift-card/         # Gift card generation and redemption
│   │   ├── booking/           # Experience booking management
│   │   ├── payment/           # Payment processing (Stripe placeholder)
│   │   ├── partner/           # Partner dashboard and experience management
│   │   ├── admin/             # Admin dashboard, settings, audit log
│   │   ├── notifications/     # Email/notification dispatch
│   │   ├── wishlists/         # Wishlist CRUD and sharing
│   │   └── community/         # Shared moments, impact metrics
│   └── frontend/
│       ├── public-app/        # Customer-facing site (browse, purchase, redeem)
│       ├── partner-portal/    # Partner dashboard (base path: /partner/)
│       └── admin-portal/      # Admin dashboard (base path: /admin-portal/)
├── Dockerfile                 # Multi-stage Docker build, ARG SERVICE for per-service builds
├── seed-demo.sh               # Seeds DynamoDB with categories, occasions
├── seed-experiences.sh         # Seeds 8 sample experiences + demo Cognito user
├── TODO-MIGRATION.md           # This file
└── package.json               # Root workspace config
```

## Key Technical Decisions

### DynamoDB Table Naming
- Tables are named `experience-gift-{service}-{table}-{env}` (e.g., `experience-gift-catalog-experiences-dev`)
- The catalog service uses `resolveTableName()` in `base.repository.ts` which appends `process.env.DYNAMO_TABLE_SUFFIX`
- The order service was migrated from PostgreSQL to DynamoDB for simplicity
- The `DYNAMO_TABLE_SUFFIX` env var is set by CDK services stack

### Auth Architecture
- 3 Cognito user pools: purchaser (self-signup), partner (admin-created), admin (MFA required)
- Auth service reads pool IDs from env vars: `PURCHASER_USER_POOL_ID`, `PURCHASER_CLIENT_ID`, etc.
- Cognito VPC endpoint placed in us-east-1b only (cognito-idp not available in us-east-1a)
- Fargate tasks are in PRIVATE_ISOLATED subnets — all AWS service access is via VPC endpoints

### Frontend API Integration
- Public app SDK at `packages/frontend/public-app/src/sdk/api-client.ts`
- API base URL from `VITE_API_URL` env var (set at build time)
- Order creation sends snake_case fields to match backend: `purchaser_email`, `recipient_name`, `experience_id`, `amount_cents`
- Catalog API returns `priceCents` (not `price`) — frontend uses `exp.priceCents`

### Payment Flow (Current: Demo Mode)
- Order service creates order in DynamoDB with `payment_status: 'pending'`
- Pay endpoint simulates success: generates fake `paymentIntentId`, sets status to `completed`
- Publishes `OrderCompleted` event to EventBridge
- **TODO**: Replace with real Stripe PaymentIntent flow (see Phase 4 below)

## Current Deployment (Dev/Sandbox)
| Resource | Value |
|----------|-------|
| AWS Account | 636385936792 (Isengard sandbox) |
| Region | us-east-1 |
| CloudFront | https://dof92wwckdxfm.cloudfront.net |
| CloudFront Distribution ID | E2EA4XKR1ZIRUX |
| API Gateway | https://b58zjrw9s7.execute-api.us-east-1.amazonaws.com |
| S3 Frontend Bucket | dev-egp-frontend-636385936792-us-east-1 |
| ECS Cluster | egp-cluster-dev |
| Cognito Purchaser Pool | us-east-1_xmK3EWRLF (client: 20lgk01jvdq01jeq79n8c7vc4r) |
| Cognito Partner Pool | us-east-1_dgXeSjvbH (client: 5fu2n79forp138qt8jldjgiequ) |
| Cognito Admin Pool | us-east-1_4IJ9TCGrY (client: 2cu4iujjc5aeipshup5jgu71h7) |
| Demo User | demo@gex.com / DemoPass123! |

## VPC Endpoints Configured
S3 (gateway), DynamoDB (gateway), ECR API, ECR Docker, CloudWatch Logs, Secrets Manager, STS, SQS, EventBridge, Cognito IDP (us-east-1b only)

## Known Issues / Incomplete Items
- Partner and admin portals show login screens but have no demo users in their Cognito pools
- Admin portal requires TOTP MFA — needs manual setup per admin user
- Gift-card, booking, partner, payment services still use Aurora PostgreSQL — DB schemas not initialized (no migrations run)
- Redis cache for catalog service fails silently (no ElastiCache deployed) — falls through to DynamoDB directly
- Community impact metrics return empty (no data seeded)
- Notification service has no email provider configured (SES not set up)

## Build & Deploy Commands
```bash
# Build everything
cd ~/TechFortress/GEx && npm run build

# Build + deploy frontends
npm run build --workspace=packages/frontend/public-app
npm run build --workspace=packages/frontend/partner-portal
npm run build --workspace=packages/frontend/admin-portal
aws s3 sync packages/frontend/public-app/dist/ s3://dev-egp-frontend-636385936792-us-east-1/ --delete --exclude "partner/*" --exclude "admin-portal/*"
aws s3 sync packages/frontend/partner-portal/dist/ s3://dev-egp-frontend-636385936792-us-east-1/partner/ --delete
aws s3 sync packages/frontend/admin-portal/dist/ s3://dev-egp-frontend-636385936792-us-east-1/admin-portal/ --delete
aws cloudfront create-invalidation --distribution-id E2EA4XKR1ZIRUX --paths "/*"

# Deploy backend (all stacks)
cd packages/infra && npx cdk deploy --all -c env=dev --require-approval never

# Deploy single stack
npx cdk deploy ExperienceGift-devServices -c env=dev --require-approval never

# Force Docker image rebuild (append comment to Dockerfile)
echo "# Rebuild $(date +%s)" >> ~/TechFortress/GEx/Dockerfile
```

## Seed Data Commands
```bash
# Seed categories, occasions, occasion-experience mappings
bash seed-demo.sh

# Seed 8 experiences + create demo Cognito user
bash seed-experiences.sh
```

---

## Quick Start (Target Account)
```bash
# 1. Clone from GitHub
git clone <repo-url> && cd GEx && npm install && npm run build

# 2. Bootstrap and deploy
cd packages/infra
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
npx cdk deploy --all -c env=prod --require-approval broadening

# 3. Put real Stripe keys into Secrets Manager
aws secretsmanager update-secret --secret-id egp/stripe-keys-prod \
  --secret-string '{"publishableKey":"pk_live_...","secretKey":"sk_live_..."}'

# 4. Put real domain/SSL cert in Route 53 + ACM (see Phase 3 below)

# 5. Run seed script or use admin portal to populate catalog
bash seed-demo.sh && bash seed-experiences.sh
```

> **The code travels. The secrets don't.** Stripe keys, domain certs, and DB credentials
> are created by CDK with placeholder values — you update them in the target account's
> Secrets Manager. Nothing sensitive lives in the repo.

---

## Prerequisites (Before Migration)
- [ ] End-to-end demo working in Isengard sandbox (account 636385936792)
- [ ] All code committed to GitHub repo
- [ ] Target AWS account ID obtained from customer
- [ ] Customer has AWS Organization or standalone account with admin access
- [ ] Domain name decided (e.g., gex.com, giftexperiences.com)

---

## Phase 1: Repository & CI/CD Setup

### Git Repository
- [ ] Initialize git repo at ~/TechFortress/GEx
- [ ] Create .gitignore (node_modules, dist, cdk.out, .env, *.log, seed scripts)
- [ ] Push to GitHub (private repo recommended)
- [ ] Add README.md with setup instructions, architecture diagram, and deploy steps
- [ ] Add LICENSE file

### CI/CD Pipeline
- [ ] Create GitHub Actions workflow for:
  - Lint + type-check on PR
  - Build all packages on PR
  - CDK diff on PR (shows infra changes)
  - CDK deploy on merge to main (to dev environment)
  - CDK deploy on release tag (to prod environment)
- [ ] Or use AWS CodePipeline connected to GitHub repo
- [ ] Add environment variables/secrets to GitHub Actions:
  - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or use OIDC role)
  - CDK_DEFAULT_ACCOUNT
  - CDK_DEFAULT_REGION

---

## Phase 2: Target Account Setup

### AWS Account Bootstrap
- [ ] Install AWS CLI and CDK CLI in deployment environment
- [ ] Configure AWS credentials for target account
- [ ] Bootstrap CDK: `npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1`
- [ ] Verify IAM permissions (CDK needs broad permissions for initial deploy)

### Deploy Infrastructure
- [ ] Clone repo from GitHub
- [ ] `npm install` at repo root
- [ ] `npm run build` to compile all packages
- [ ] Deploy with prod config:
  ```bash
  cd packages/infra
  npx cdk deploy --all -c env=prod --require-approval broadening
  ```
- [ ] Note all outputs (CloudFront domain, API Gateway URL, Cognito pool IDs, etc.)

---

## Phase 3: Domain & SSL

### Route 53 + ACM
- [ ] Register or transfer domain in Route 53 (or use existing DNS provider)
- [ ] Request ACM certificate in us-east-1 (required for CloudFront)
- [ ] Validate certificate via DNS
- [ ] Update CDK shared-infrastructure-stack to attach custom domain to CloudFront
- [ ] Create Route 53 A record (alias) pointing domain to CloudFront distribution
- [ ] Create subdomain for API (e.g., api.gex.com) pointing to API Gateway custom domain

### API Gateway Custom Domain
- [ ] Request ACM certificate for api subdomain
- [ ] Create API Gateway custom domain mapping
- [ ] Update frontend VITE_API_URL to use custom API domain

---

## Phase 4: Stripe Integration

### Stripe Account Setup
- [ ] Create Stripe account at stripe.com
- [ ] Get publishable key and secret key (test mode first, then live)
- [ ] Enable Stripe Connect for partner payouts
- [ ] Configure webhook endpoint URL

### Secrets Manager
- [ ] Update secret `egp/stripe-keys-prod` with real Stripe keys:
  ```bash
  aws secretsmanager update-secret --secret-id egp/stripe-keys-prod \
    --secret-string '{"publishableKey":"pk_live_...","secretKey":"sk_live_...","webhookSecret":"whsec_..."}'
  ```

### Code Changes (can be done before or after migration)
- [ ] Add `stripe` npm package to payment service
- [ ] Implement PaymentIntent creation in payment service
- [ ] Implement webhook handler for payment_intent.succeeded
- [ ] Update frontend to use Stripe.js / Stripe Elements for card collection
- [ ] Implement Stripe Connect onboarding flow for partners
- [ ] Test with Stripe test keys before going live

---

## Phase 5: Email / Notifications

### SES Setup
- [ ] Verify sender domain in SES
- [ ] Request SES production access (out of sandbox)
- [ ] Or use a transactional email service (SendGrid, Postmark)

### Notification Service
- [ ] Add SES SDK to notification service
- [ ] Create email templates for:
  - Gift card delivery to recipient
  - Order confirmation to purchaser
  - Booking confirmation
  - Partner onboarding welcome
- [ ] Wire EventBridge events to trigger emails
- [ ] Add VPC endpoint for SES (or use NAT gateway)

---

## Phase 6: Data & Users

### Seed Production Data
- [ ] Run seed script for categories and occasions (or create via admin portal)
- [ ] Partners onboard their own experiences via partner portal
- [ ] Or bulk-import initial experiences via admin API

### Cognito Users
- [ ] Create initial admin user in admin Cognito pool (with MFA)
- [ ] Partner users created via partner onboarding flow
- [ ] Purchaser users self-register via public app

---

## Phase 7: Security & Compliance

### IAM
- [ ] Review and tighten IAM policies (least privilege)
- [ ] Create deployment role with scoped permissions
- [ ] Enable CloudTrail for audit logging

### WAF
- [ ] Prod config already enables WAF on CloudFront
- [ ] Review WAF rules (rate limiting, SQL injection, common rules)
- [ ] Consider adding geo-restriction if US-only

### Data Protection
- [ ] Verify all DynamoDB tables have encryption at rest (already enabled)
- [ ] Verify Aurora encryption at rest (already enabled)
- [ ] Verify S3 bucket policies block public access (already configured)
- [ ] Review Cognito password policies (already configured per pool)

### Monitoring
- [ ] Set up CloudWatch alarms for:
  - ECS service health (unhealthy task count)
  - API Gateway 5xx error rate
  - DynamoDB throttling
  - Aurora CPU/connections
- [ ] Set up CloudWatch dashboard for key metrics
- [ ] Consider X-Ray tracing for request flow visibility

---

## Phase 8: Testing & Launch

### Pre-Launch Testing
- [ ] Full end-to-end test: Register → Browse → Purchase → Pay (real Stripe) → Receive email → Redeem → Book
- [ ] Test partner onboarding flow
- [ ] Test admin dashboard
- [ ] Load test with Artillery or k6
- [ ] Mobile responsiveness check across devices

### Launch
- [ ] DNS cutover to production
- [ ] Switch Stripe from test to live keys
- [ ] Monitor CloudWatch for first 24-48 hours
- [ ] Have rollback plan (CDK makes this easy — just redeploy previous commit)

---

## Architecture Reference

| Component | Resource | Notes |
|-----------|----------|-------|
| Frontend | CloudFront + S3 | 3 apps: public, partner, admin |
| API | API Gateway HTTP v2 | VPC Link to ALB |
| Services | 11 ECS Fargate services | Behind shared ALB, path-based routing |
| Auth | Cognito | 3 pools: purchaser, partner (optional MFA), admin (required MFA) |
| Catalog DB | DynamoDB | 8 tables with GSIs |
| Orders DB | DynamoDB | Migrated from PostgreSQL for demo simplicity |
| Relational DB | Aurora Serverless v2 | 5 clusters (order, gift-card, booking, partner, payment) |
| Events | EventBridge + SQS | 9 queues for async processing |
| Cache | DAX | DynamoDB accelerator for catalog |
| Secrets | Secrets Manager | Stripe keys, DB credentials |
| CDN/WAF | CloudFront + WAF v2 | WAF enabled in prod config only |

## Service Routing (ALB Path Patterns)
| Service | Path | Health Check |
|---------|------|-------------|
| catalog | /catalog/* | /health |
| order | /orders/* | /orders/health |
| gift-card | /gift-cards/* | /gift-cards/health |
| booking | /bookings/* | /bookings/health |
| partner | /partners/* | /partners/health |
| admin | /admin/* | /admin/health |
| notification | /notifications/* | /notifications/health |
| auth | /auth/* | /auth/health |
| wishlist | /wishlists/* | /wishlists/health |
| community | /community/* | /community/health |
| payment | /payments/* | /payments/health |