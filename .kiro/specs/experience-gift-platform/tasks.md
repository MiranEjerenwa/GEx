# Implementation Plan: Experience Gift Platform

## Overview

This plan implements the Experience Gift Platform as a TypeScript microservices architecture on AWS. Tasks are organized by infrastructure foundation, then service-by-service implementation (each with its own data layer, API, business logic, and tests), followed by frontend development and cross-service integration. All services use TypeScript, AWS CDK for infrastructure, PostgreSQL or DynamoDB for data, and fast-check for property-based tests.

## Tasks

- [x] 1. Project scaffolding and shared infrastructure (CDK)
  - [x] 1.1 Initialize monorepo with TypeScript, shared tsconfig, and package structure
    - Create top-level monorepo structure with `packages/` directory
    - Add shared tsconfig.base.json, eslint config, prettier config
    - Create package directories: `infra/`, `services/catalog`, `services/order`, `services/gift-card`, `services/booking`, `services/partner`, `services/admin`, `services/notification`, `services/auth`, `services/wishlist`, `services/community`, `services/payment`, `frontend/public-app`, `frontend/partner-portal`, `frontend/admin-portal`
    - Add shared types package `packages/shared-types` for cross-service interfaces, event schemas, and error response format
    - _Requirements: 11.1_

  - [x] 1.2 Create CDK shared infrastructure stack
    - Define VPC with public, private, and data subnets across 2 AZs
    - Create ECS Cluster for Fargate services
    - Create Amazon EventBridge custom event bus with DLQ (SQS)
    - Create S3 buckets: frontend assets, experience images, shared moment photos
    - Create CloudFront distribution with WAF integration
    - Create API Gateway REST API with resource-based routing per service
    - Create Amazon Cognito user pools: Purchaser/Recipient (email/password), Partner (email/password + optional MFA), Admin (email/password + required MFA)
    - Create AWS Secrets Manager entries for Stripe API keys and DB credentials
    - Create ElastiCache Redis cluster for catalog caching
    - Create CloudWatch log groups and X-Ray tracing configuration
    - _Requirements: 11.1, 11.4, 8.2_

  - [x] 1.3 Create CDK database stacks
    - Create RDS PostgreSQL Multi-AZ instances for: Order, Gift Card, Booking, Partner, Payment services
    - Enable automated backups with 7+ day retention, encryption at rest with KMS
    - Create DynamoDB tables with GSIs for: Catalog (experiences, occasions, mappings, templates, collections, categories, time_slots), Admin (action_log, platform_settings), Wishlist (wishlists, wishlist_items), Community (shared_moments, community_impact_metrics, impact_badges), Notification (notification_log)
    - Create SQL migration scripts for all PostgreSQL schemas (orders, gift_cards, redemption_audit_log, bookings, time_slot_reservations, partners, onboarding_applications, commission_rates, payment_splits, partner_stripe_accounts)
    - Include the gift card lifecycle trigger function `enforce_gift_card_lifecycle()`
    - _Requirements: 11.3, 9.3, 9.4_

  - [x] 1.4 Create CDK per-service ECS Fargate stacks
    - Define reusable CDK construct for ECS Fargate service with ALB, health check, auto-scaling (target 70% CPU/memory, min 2 tasks), CloudWatch log group, X-Ray daemon sidecar
    - Create ECS service definitions for all 11 services with private subnet placement
    - Configure API Gateway resource-based routing to each service ALB
    - Configure AWS Cloud Map for internal service discovery (private ALB endpoints)
    - _Requirements: 11.1, 11.2_

  - [x] 1.5 Create shared types and utilities package
    - Define TypeScript interfaces for all domain events (EventBridge payloads from Event Catalog)
    - Define shared error response format `{ error: { code, message, requestId, traceId, details } }`
    - Create base service utilities: structured JSON logger, X-Ray tracing middleware, exponential backoff retry helper, circuit breaker implementation
    - Define shared enums: GiftCardStatus, PaymentStatus, BookingStatus, OnboardingStatus, AgeGroup, FulfillmentStatus, MomentStatus
    - _Requirements: 11.2, 11.4_

- [x] 2. Checkpoint - Verify infrastructure compiles
  - Ensure CDK synth succeeds for all stacks, ask the user if questions arise.

- [x] 3. Auth Service
  - [x] 3.1 Implement Auth Service API and Cognito integration
    - Implement endpoints: POST `/auth/register`, POST `/auth/login`, POST `/auth/partner/login`, POST `/auth/admin/login` (MFA required), POST `/auth/token/refresh`, POST `/auth/partner/create`
    - Wrap Cognito SDK for user pool operations across all 3 pools (Purchaser/Recipient, Partner, Admin)
    - Implement token validation middleware reusable by all services
    - Implement `createPartnerCredentials` triggered by `PartnerApproved` EventBridge event
    - _Requirements: 10.1, 6.3_

  - [ ]* 3.2 Write unit tests for Auth Service
    - Test Cognito integration mocks, token validation, MFA enforcement for admin pool, user registration
    - _Requirements: 10.1_

- [x] 4. Catalog Service
  - [x] 4.1 Implement Catalog Service data layer and caching
    - Implement DynamoDB operations for experiences, categories, occasions, age_group_experience_mappings, occasion_experience_mappings, gift_card_templates, curated_collections, time_slots tables
    - Implement Redis cache layer with TTL-based invalidation on `ExperienceUpdated` events
    - _Requirements: 1.1, 12.1_

  - [x] 4.2 Implement Catalog Service API endpoints
    - GET `/catalog/experiences` with filters: category, ageGroup, occasion, search, page, limit
    - GET `/catalog/experiences/:id` with full detail including available dates, age groups, occasions
    - GET `/catalog/categories`, GET `/catalog/occasions`
    - GET `/catalog/occasions/:id/collection` (date-range aware curated collections)
    - GET `/catalog/occasions/:id/templates` (occasion-specific gift card templates)
    - Implement compound filter logic as intersection of individual filters
    - Return "no results found" message when filters/search yield empty results
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4_

  - [ ]* 4.3 Write property test: Catalog experience data completeness
    - **Property 1: Catalog experience data completeness**
    - **Validates: Requirements 1.1, 12.1, 12.3**

  - [ ]* 4.4 Write property test: Category filter correctness
    - **Property 2: Category filter correctness**
    - **Validates: Requirements 1.2**

  - [ ]* 4.5 Write property test: Search term filter correctness
    - **Property 3: Search term filter correctness**
    - **Validates: Requirements 1.6**

  - [ ]* 4.6 Write property test: Experience detail completeness
    - **Property 4: Experience detail completeness**
    - **Validates: Requirements 2.1, 2.5**

  - [ ]* 4.7 Write property test: Age group filter correctness
    - **Property 34: Age group filter correctness**
    - **Validates: Requirements 1.3, 12.2**

  - [ ]* 4.8 Write property test: Occasion filter correctness
    - **Property 35: Occasion filter correctness**
    - **Validates: Requirements 1.4, 13.1, 13.2**

  - [ ]* 4.9 Write property test: Compound filter correctness
    - **Property 36: Compound filter correctness**
    - **Validates: Requirements 1.5**

  - [ ]* 4.10 Write property test: Inactive experiences excluded from catalog
    - **Property 15: Inactive experiences excluded from catalog**
    - **Validates: Requirements 5.4**

  - [ ]* 4.11 Write property test: Occasion-specific gift card templates
    - **Property 37: Occasion-specific gift card templates**
    - **Validates: Requirements 2.4, 13.3**

  - [ ]* 4.12 Write property test: Curated collection date-range display
    - **Property 38: Curated collection date-range display**
    - **Validates: Requirements 13.4**

  - [ ]* 4.13 Write unit tests for Catalog Service
    - Test specific filter/search examples, empty results message, pagination edge cases
    - Test Redis cache hit/miss behavior, age group and occasion filter examples
    - Test curated collection date boundary cases
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 5. Payment Service (Stripe Connect)
  - [x] 5.1 Implement Payment Service data layer
    - Implement PostgreSQL operations for commission_rates, payment_splits, partner_stripe_accounts tables
    - Seed default commission rate row (17.5%, is_default=true)
    - _Requirements: 17.2_

  - [x] 5.2 Implement Payment Service API and Stripe Connect integration
    - POST `/payments/intent` — create Stripe Connect payment intent with split (platform commission + partner payout)
    - POST `/payments/webhook` — handle Stripe webhooks for payment confirmation and transfer status
    - GET `/payments/partner/:partnerId/payouts` — list partner payouts
    - GET `/payments/commissions` — list all commission rates
    - PUT `/payments/commissions/:partnerId` — update partner commission rate
    - POST `/payments/partner/:partnerId/stripe-connect` — create Stripe Connect account for partner
    - Use Stripe idempotency keys derived from order ID to prevent duplicate charges
    - Publish `PaymentSplit` event on successful payment
    - Consume `OrderCompleted` event to initiate payment split
    - Consume `PartnerApproved` event to create Stripe Connect account
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 17.1, 17.2, 17.3, 17.5, 17.6_

  - [ ]* 5.3 Write property test: Stripe Connect split payment correctness
    - **Property 52: Stripe Connect split payment correctness**
    - **Validates: Requirements 17.1, 17.3**

  - [ ]* 5.4 Write property test: Commission rate bounds and application
    - **Property 53: Commission rate bounds and application**
    - **Validates: Requirements 17.2**

  - [ ]* 5.5 Write property test: No purchaser service fees
    - **Property 55: No purchaser service fees**
    - **Validates: Requirements 17.5**

  - [ ]* 5.6 Write unit tests for Payment Service
    - Test Stripe Connect account creation, split payment calculation, commission rate CRUD
    - Test default rate fallback, idempotent webhook handling
    - _Requirements: 17.1, 17.2, 17.3_

- [-] 6. Order Service
  - [x] 6.1 Implement Order Service data layer
    - Implement PostgreSQL operations for orders table with indexes on reference_number, purchaser_email, recipient_email
    - Generate unique order reference numbers
    - _Requirements: 7.1_

  - [x] 6.2 Implement Order Service API endpoints
    - POST `/orders` — create order with gift-card-writing purchase flow (collect purchaser email, recipient name/email, occasion, occasion_template_id, personalized message, age_group_context, optional wishlist_item_id)
    - POST `/orders/:id/pay` — submit payment (delegate to Payment Service for Stripe Connect split)
    - GET `/orders/status` — look up order by reference number + purchaser email
    - POST `/orders/:id/resend` — request resend of gift card delivery email
    - Validate all required fields on order creation (reject if missing)
    - Publish `OrderCompleted` event on successful payment
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 7.1, 7.2, 7.3_

  - [ ]* 6.3 Write property test: Order creation input validation
    - **Property 5: Order creation input validation**
    - **Validates: Requirements 2.2**

  - [ ]* 6.4 Write property test: Payment data storage restriction
    - **Property 21: Payment data storage restriction**
    - **Validates: Requirements 8.3**

  - [ ]* 6.5 Write property test: Order status lookup round-trip
    - **Property 20: Order status lookup round-trip**
    - **Validates: Requirements 7.1**

  - [ ]* 6.6 Write unit tests for Order Service
    - Test payment declined error message, order confirmation response shape
    - Test resend email event publishing, occasion and age group context stored correctly
    - _Requirements: 2.6, 2.7, 2.8, 2.9_

- [x] 7. Gift Card Service
  - [x] 7.1 Implement Gift Card Service data layer
    - Implement PostgreSQL operations for gift_cards and redemption_audit_log tables
    - Implement cryptographically random redemption code generation (12+ alphanumeric characters)
    - Implement pessimistic locking with `SELECT ... FOR UPDATE` for redemption
    - Enforce lifecycle state machine at application level (purchased → delivered → redeemed only)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 7.2 Implement Gift Card Service API endpoints and event handlers
    - POST `/gift-cards/validate` — validate redemption code, return experience details and available booking dates
    - POST `/gift-cards/redeem` — redeem gift card with atomic transaction (lock → verify status → update → audit log → commit → publish event)
    - GET `/gift-cards/:id` — get gift card detail (admin use)
    - GET `/gift-cards/:id/audit-log` — get redemption audit log
    - Consume `OrderCompleted` event → create gift card with status "purchased"
    - Implement `markAsDelivered` → transition to "delivered", publish `GiftCardDelivered` event
    - Publish `GiftCardRedeemed` event on successful redemption
    - Handle idempotent redemption: return existing booking if already redeemed
    - Log all redemption attempts to audit log (success, already_redeemed, invalid_code, concurrent_conflict, not_delivered)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 7.3 Write property test: Delivered gift card validation returns experience details
    - **Property 7: Delivered gift card validation returns experience details**
    - **Validates: Requirements 4.1**

  - [ ]* 7.4 Write property test: Atomic redemption creates booking and transitions status
    - **Property 8: Atomic redemption creates booking and transitions status**
    - **Validates: Requirements 4.5, 9.5**

  - [ ]* 7.5 Write property test: Concurrent redemption safety
    - **Property 9: Concurrent redemption safety**
    - **Validates: Requirements 4.6**

  - [ ]* 7.6 Write property test: Idempotent redemption
    - **Property 10: Idempotent redemption**
    - **Validates: Requirements 4.7**

  - [ ]* 7.7 Write property test: Redemption code format validity
    - **Property 22: Redemption code format validity**
    - **Validates: Requirements 9.1**

  - [ ]* 7.8 Write property test: Redemption code uniqueness
    - **Property 23: Redemption code uniqueness**
    - **Validates: Requirements 9.2**

  - [ ]* 7.9 Write property test: Gift card lifecycle state machine
    - **Property 24: Gift card lifecycle state machine**
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 7.10 Write property test: Redemption audit log completeness
    - **Property 25: Redemption audit log completeness**
    - **Validates: Requirements 9.6**

  - [ ]* 7.11 Write property test: Gift card create-retrieve round-trip
    - **Property 26: Gift card create-retrieve round-trip**
    - **Validates: Requirements 9.7**

  - [ ]* 7.12 Write unit tests for Gift Card Service
    - Test invalid code error, purchased-not-delivered error, already-redeemed idempotent response
    - Test state machine trigger enforcement, audit log entries for each outcome type
    - _Requirements: 4.2, 4.3, 4.4, 9.3, 9.4, 9.6_

- [x] 8. Checkpoint - Verify core transactional services
  - Ensure all tests pass for Auth, Catalog, Payment, Order, and Gift Card services. Ask the user if questions arise.

- [x] 9. Booking Service
  - [x] 9.1 Implement Booking Service data layer and API
    - Implement PostgreSQL operations for bookings and time_slot_reservations tables
    - Consume `GiftCardRedeemed` event → create booking with status "confirmed", reserve time slot, enforce capacity
    - GET `/bookings/partner/:partnerId` — list bookings for a partner
    - GET `/bookings/:id` — get booking detail
    - GET `/bookings/gift-card/:giftCardId` — get booking by gift card ID
    - Publish `BookingConfirmed` event on successful booking creation
    - Implement scheduled job to publish `BookingDatePassed` events for past bookings
    - _Requirements: 4.5, 4.8, 4.9, 5.1_

  - [ ]* 9.2 Write unit tests for Booking Service
    - Test time slot capacity enforcement, booking creation from event payload
    - Test duplicate booking prevention, BookingDatePassed event scheduling
    - _Requirements: 4.5, 4.8, 4.9_

- [x] 10. Partner Service
  - [x] 10.1 Implement Partner Service data layer
    - Implement PostgreSQL operations for partners and onboarding_applications tables
    - _Requirements: 5.1, 6.1_

  - [x] 10.2 Implement Partner Service API endpoints
    - GET `/partners/dashboard` — partner dashboard with owned experiences, statuses, upcoming bookings
    - POST `/partners/experiences` — create experience (require name, description, category, price, dates/times, location, capacity, image, at least one age group)
    - PUT `/partners/experiences/:id` — update experience (require at least one age group)
    - PATCH `/partners/experiences/:id/status` — activate/deactivate experience (publish `ExperienceUpdated` event)
    - GET `/partners/bookings` — list partner bookings
    - POST `/partners/onboarding/apply` — submit onboarding application (validate required fields)
    - GET `/partners/onboarding` — list pending applications (admin)
    - POST `/partners/onboarding/:id/approve` — approve application (create partner account, trigger Stripe Connect setup, publish `PartnerApproved` event)
    - POST `/partners/onboarding/:id/reject` — reject application (require rejection reason, publish `PartnerRejected` event)
    - GET `/partners/:id/stripe-connect/onboarding-link` — get Stripe Connect onboarding link
    - Prevent removal of dates with confirmed bookings
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 12.4, 17.6_

  - [ ]* 10.3 Write property test: Partner dashboard lists all owned experiences
    - **Property 12: Partner dashboard lists all owned experiences**
    - **Validates: Requirements 5.1**

  - [ ]* 10.4 Write property test: Experience creation input validation
    - **Property 13: Experience creation input validation**
    - **Validates: Requirements 5.2, 12.4**

  - [ ]* 10.5 Write property test: Experience update round-trip
    - **Property 14: Experience update round-trip**
    - **Validates: Requirements 5.3**

  - [ ]* 10.6 Write property test: Booked dates cannot be removed
    - **Property 16: Booked dates cannot be removed**
    - **Validates: Requirements 5.5**

  - [ ]* 10.7 Write property test: Onboarding application input validation
    - **Property 17: Onboarding application input validation**
    - **Validates: Requirements 6.1**

  - [ ]* 10.8 Write property test: Onboarding application stored as pending
    - **Property 18: Onboarding application stored as pending**
    - **Validates: Requirements 6.2**

  - [ ]* 10.9 Write property test: Approved application creates partner account
    - **Property 19: Approved application creates partner account**
    - **Validates: Requirements 6.3, 10.7**

  - [ ]* 10.10 Write property test: Onboarding queue shows only pending applications sorted by date
    - **Property 30: Onboarding queue shows only pending applications sorted by date**
    - **Validates: Requirements 10.6**

  - [ ]* 10.11 Write property test: Rejection requires reason
    - **Property 31: Rejection requires reason**
    - **Validates: Requirements 10.8**

  - [ ]* 10.12 Write unit tests for Partner Service
    - Test experience creation with all fields including age groups, deactivation publishes event
    - Test onboarding application validation, Stripe Connect onboarding link generation
    - _Requirements: 5.2, 5.4, 6.1, 6.3, 6.4_

- [x] 11. Notification Service
  - [x] 11.1 Implement Notification Service with SES integration and retry logic
    - Implement DynamoDB operations for notification_log table
    - Consume `GiftCardCreated` event → send gift card delivery email to recipient (within 60 seconds)
    - Consume `GiftCardDelivered` event → update delivery status
    - Consume `BookingConfirmed` event → send booking confirmation to recipient + partner notification
    - Consume `PartnerApproved` event → send welcome email with temp credentials
    - Consume `PartnerRejected` event → send rejection email with reason
    - Consume `WishlistItemFulfilled` event → send privacy-preserving notification ("someone got you something from your wishlist" without revealing experience or purchaser)
    - Consume `BookingDatePassed` event → send optional sharing prompt to recipient
    - Implement retry logic: up to 3 retries with exponential backoff (1s, 2s, 4s)
    - Log all delivery attempts and failures to notification_log
    - POST `/notifications/resend/:giftCardId` — manually trigger email resend
    - GET `/notifications/status/:giftCardId` — get delivery status
    - Implement email templates for all notification types including occasion-specific gift card templates
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.8, 4.9, 6.2, 6.3, 6.4, 14.4, 16.1_

  - [ ]* 11.2 Write property test: Delivery email content completeness
    - **Property 6: Delivery email content completeness**
    - **Validates: Requirements 3.2**

  - [ ]* 11.3 Write property test: Booking confirmation email content completeness
    - **Property 11: Booking confirmation email content completeness**
    - **Validates: Requirements 4.8**

  - [ ]* 11.4 Write unit tests for Notification Service
    - Test retry behavior on failure (3 retries with backoff), email template rendering
    - Test idempotent event handling, wishlist fulfillment notification content (no spoilers)
    - Test sharing prompt delivery
    - _Requirements: 3.1, 3.2, 3.3, 14.4, 16.1_

- [x] 12. Admin Service
  - [x] 12.1 Implement Admin Service data layer
    - Implement DynamoDB operations for admin_action_log and platform_settings tables
    - _Requirements: 10.11_

  - [x] 12.2 Implement Admin Service API endpoints
    - GET `/admin/dashboard` — platform metrics (total orders, revenue, active partners, gift cards by status, bookings for time period) via aggregation from other services
    - GET `/admin/orders` — search orders by reference number, purchaser email, or recipient email
    - GET `/admin/gift-cards/:id` — gift card detail with complete lifecycle history and audit log
    - POST `/admin/gift-cards/:id/resend` — resend delivery email (log admin action)
    - GET `/admin/partners` — list all partners with status, active experience count, total bookings
    - GET `/admin/partners/commissions` — list all partners with commission rates
    - PUT `/admin/partners/:id/commission` — update partner commission rate (delegate to Payment Service, log admin action)
    - GET `/admin/settings` — get platform settings (email templates, categories, feature flags)
    - PUT `/admin/settings` — update platform settings (log admin action)
    - POST `/admin/occasions/:id/collection` — configure curated occasion collection with date range
    - Log all admin actions to admin_action_log with admin identity, action type, affected record, timestamp
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 17.4_

  - [ ]* 12.3 Write property test: Admin dashboard metrics accuracy
    - **Property 27: Admin dashboard metrics accuracy**
    - **Validates: Requirements 10.2**

  - [ ]* 12.4 Write property test: Admin order search completeness
    - **Property 28: Admin order search completeness**
    - **Validates: Requirements 10.3**

  - [ ]* 12.5 Write property test: Admin gift card detail includes lifecycle history
    - **Property 29: Admin gift card detail includes lifecycle history**
    - **Validates: Requirements 10.4**

  - [ ]* 12.6 Write property test: Partner management list accuracy
    - **Property 32: Partner management list accuracy**
    - **Validates: Requirements 10.9**

  - [ ]* 12.7 Write property test: Admin action audit logging
    - **Property 33: Admin action audit logging**
    - **Validates: Requirements 10.11**

  - [ ]* 12.8 Write property test: Admin commission rate management
    - **Property 54: Admin commission rate management**
    - **Validates: Requirements 17.4**

  - [ ]* 12.9 Write unit tests for Admin Service
    - Test MFA requirement, settings update, email resend event publishing
    - Test audit log recording, commission rate update validation
    - _Requirements: 10.1, 10.10, 10.11, 17.4_

- [x] 13. Checkpoint - Verify all backend services
  - Ensure all tests pass for Booking, Partner, Notification, and Admin services. Ask the user if questions arise.

- [x] 14. Wishlist Service
  - [x] 14.1 Implement Wishlist Service data layer and API
    - Implement DynamoDB operations for wishlists and wishlist_items tables with GSIs
    - POST `/wishlists` — create wishlist, generate unique share token
    - GET `/wishlists/:id` — get wishlist (owner view with fulfillment status)
    - GET `/wishlists/share/:shareToken` — get wishlist via shareable link (purchaser view, no fulfillment details exposed)
    - POST `/wishlists/:id/items` — add experience to wishlist with optional note
    - DELETE `/wishlists/:id/items/:itemId` — remove experience from wishlist
    - POST `/wishlists/:id/items/:itemId/fulfill` — mark item as fulfilled (triggered by order completion via `PaymentSplit` event)
    - GET `/wishlists/user/:userId` — list wishlists for a user
    - Publish `WishlistItemFulfilled` event on fulfillment (triggers privacy-preserving notification)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 14.2 Write property test: Wishlist item addition
    - **Property 39: Wishlist item addition**
    - **Validates: Requirements 14.1**

  - [ ]* 14.3 Write property test: Wishlist share link uniqueness
    - **Property 40: Wishlist share link uniqueness**
    - **Validates: Requirements 14.2**

  - [ ]* 14.4 Write property test: Wishlist share link displays experiences
    - **Property 41: Wishlist share link displays experiences**
    - **Validates: Requirements 14.3**

  - [ ]* 14.5 Write property test: Wishlist fulfillment marking and notification privacy
    - **Property 42: Wishlist fulfillment marking and notification privacy**
    - **Validates: Requirements 14.4**

  - [ ]* 14.6 Write property test: Wishlist item fulfillment status display
    - **Property 43: Wishlist item fulfillment status display**
    - **Validates: Requirements 14.5**

  - [ ]* 14.7 Write property test: Wishlist item removal
    - **Property 44: Wishlist item removal**
    - **Validates: Requirements 14.6**

  - [ ]* 14.8 Write unit tests for Wishlist Service
    - Test wishlist creation, share token generation, item addition/removal
    - Test fulfillment marking, duplicate item prevention, invalid share token error
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 15. Community Service
  - [x] 15.1 Implement Community Service data layer and S3 integration
    - Implement DynamoDB operations for shared_moments, community_impact_metrics, impact_badges tables
    - Implement S3 presigned URL generation for photo uploads with EXIF stripping
    - Implement community impact metrics aggregation (update within 24 hours of each purchase)
    - _Requirements: 15.1, 15.4, 16.2, 16.3_

  - [x] 15.2 Implement Community Service API endpoints
    - GET `/community/impact` — public community impact metrics (total families, experiences gifted, estimated family hours)
    - GET `/community/impact/user/:userId` — individual impact metrics (experiences gifted, material gifts replaced)
    - GET `/community/impact/user/:userId/badge` — generate shareable impact badge
    - GET `/community/feed` — community feed of published shared moments (paginated)
    - POST `/community/moments` — submit shared moment (validate caption ≤ 280 chars, require consent, require guardian approval if minor)
    - POST `/community/moments/:id/approve` — parent/guardian approval for minor's moment
    - GET `/community/moments/prompt/:bookingId` — get sharing prompt for past booking
    - Consume `BookingConfirmed` event to track community metrics
    - Publish `SharedMomentPublished` event when moment is published
    - No public comments allowed on shared moments
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 15.3 Write property test: Community impact metrics accuracy
    - **Property 45: Community impact metrics accuracy**
    - **Validates: Requirements 15.1**

  - [ ]* 15.4 Write property test: Individual impact metrics accuracy
    - **Property 46: Individual impact metrics accuracy**
    - **Validates: Requirements 15.2**

  - [ ]* 15.5 Write property test: Impact badge content completeness
    - **Property 47: Impact badge content completeness**
    - **Validates: Requirements 15.3**

  - [ ]* 15.6 Write property test: Post-experience sharing prompt
    - **Property 48: Post-experience sharing prompt**
    - **Validates: Requirements 16.1**

  - [ ]* 15.7 Write property test: Shared moment caption length validation
    - **Property 49: Shared moment caption length validation**
    - **Validates: Requirements 16.2**

  - [ ]* 15.8 Write property test: Shared moment consent and parental approval
    - **Property 50: Shared moment consent and parental approval**
    - **Validates: Requirements 16.3, 16.4**

  - [ ]* 15.9 Write property test: Published moments appear in community feed
    - **Property 51: Published moments appear in community feed**
    - **Validates: Requirements 16.5**

  - [ ]* 15.10 Write unit tests for Community Service
    - Test shared moment submission validation (caption length, consent), minor guardian approval flow
    - Test community feed pagination, impact metrics aggregation, EXIF stripping on photo upload
    - _Requirements: 15.1, 15.2, 16.2, 16.3, 16.4, 16.5_

- [x] 16. Checkpoint - Verify Wishlist and Community services
  - Ensure all tests pass for Wishlist and Community services. Ask the user if questions arise.

- [x] 17. Frontend - Public App (Browse, Purchase, Redeem)
  - [x] 17.1 Implement experience browsing pages
    - Build catalog browse page with category, age group, and occasion filter controls
    - Build search bar with real-time results
    - Build experience detail page with description, price, age groups, available dates, partner info, purchase button
    - Build occasion-based curated collection pages
    - Display "no results found" message with filter-clearing suggestion when empty
    - Display age group prominently on listings and detail pages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 12.1, 12.2, 12.3, 13.1, 13.2, 13.4_

  - [x] 17.2 Implement gift card purchase flow
    - Build personal gift-card-writing experience (not a shopping cart) collecting: purchaser email, recipient name/email, occasion selection, personalized message
    - Display occasion-specific gift card templates for selection
    - Display recommended age group for confirmation
    - Integrate Stripe Elements for secure payment (no raw card data on platform)
    - Build order confirmation page with gift card details and order reference number
    - Build resend delivery email button on confirmation page
    - Handle payment declined errors with descriptive message and form data retention
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 8.1, 13.3_

  - [x] 17.3 Implement gift card redemption and booking pages
    - Build redemption page with redemption code input
    - Display experience details, personalized message, and available booking dates/times on valid code
    - Handle error states: invalid code, already redeemed (show existing booking), not yet delivered
    - Build booking confirmation flow with date/time selection
    - Display booking confirmation details after successful booking
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 17.4 Implement order status tracking page
    - Build order status lookup page with reference number + purchaser email input
    - Display gift card status (purchased, delivered, redeemed) and booking details if redeemed
    - _Requirements: 7.1_

  - [x] 17.5 Implement user registration, login, and wishlist pages
    - Build user registration and login pages (Cognito integration)
    - Build wishlist creation and management pages (add/remove experiences, personal notes)
    - Build shareable wishlist view (accessible via unique link, no fulfillment status shown to visitors)
    - Build "purchase from wishlist" flow linking to gift card purchase with wishlist_item_id
    - Display fulfillment status to wishlist owner
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 17.6 Implement community impact and social sharing pages
    - Build public community impact dashboard (total families, experiences gifted, estimated family hours)
    - Build individual impact metrics page for logged-in users
    - Build shareable impact badge generation
    - Build post-experience sharing prompt (after booking date passes)
    - Build shared moment submission form (photo upload, caption ≤ 280 chars, consent checkbox, guardian approval for minors)
    - Build community feed page displaying published moments (no comments)
    - _Requirements: 15.1, 15.2, 15.3, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 18. Frontend - Partner Portal
  - [x] 18.1 Implement Partner Portal
    - Build partner login page (Cognito Partner Pool)
    - Build partner dashboard with owned experiences, statuses, upcoming bookings
    - Build experience CRUD forms (require age groups, support occasion associations)
    - Build experience activate/deactivate controls
    - Build partner bookings list view
    - Build partner onboarding application form (business name, contact email, description, categories)
    - Build Stripe Connect onboarding flow integration
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 12.4, 17.6_

- [x] 19. Frontend - Admin Portal
  - [x] 19.1 Implement Admin Portal
    - Build admin login page with MFA requirement (Cognito Admin Pool)
    - Build admin dashboard with platform metrics (orders, revenue, partners, gift cards by status, bookings)
    - Build order search page (by reference number, purchaser email, recipient email)
    - Build gift card detail view with lifecycle history and audit log
    - Build resend delivery email action with confirmation
    - Build partner onboarding queue (pending applications sorted by date, approve/reject actions with rejection reason)
    - Build partner management page (all partners with status, active experiences, total bookings)
    - Build commission management page (view/update commission rates per partner)
    - Build platform settings page (email templates, categories, feature flags)
    - Build curated occasion collection configuration
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 17.4_

- [x] 20. Checkpoint - Verify all frontend apps build
  - Ensure all three frontend apps build successfully. Ask the user if questions arise.

- [x] 21. Cross-service event wiring and integration
  - [x] 21.1 Wire EventBridge event rules and consumers
    - Configure EventBridge rules routing all domain events to target SQS queues per consumer service
    - Wire `OrderCompleted` → Gift Card Service (create gift card) + Payment Service (process split)
    - Wire `GiftCardCreated` → Notification Service (send delivery email)
    - Wire `GiftCardDelivered` → Notification Service + Admin Service
    - Wire `GiftCardRedeemed` → Booking Service (create booking) + Notification Service
    - Wire `BookingConfirmed` → Notification Service + Partner Service + Community Service
    - Wire `BookingDatePassed` → Notification Service (sharing prompt)
    - Wire `PartnerApproved` → Notification Service + Auth Service + Payment Service (Stripe Connect)
    - Wire `PartnerRejected` → Notification Service
    - Wire `ExperienceUpdated` → Catalog Service (cache invalidation)
    - Wire `WishlistItemFulfilled` → Notification Service
    - Wire `SharedMomentPublished` → Community Service (feed update)
    - Wire `PaymentSplit` → Wishlist Service (fulfillment tracking)
    - Configure SQS dead letter queues for failed event deliveries
    - Implement idempotent event handlers in all consumer services (using event ID deduplication)
    - _Requirements: 11.2, 3.1, 4.5, 4.8, 4.9, 6.3, 7.2, 7.3, 14.4, 16.1_

  - [ ]* 21.2 Write integration tests for cross-service event flows
    - Test full purchase-to-redemption flow: OrderCompleted → GiftCardCreated → delivery email → GiftCardDelivered → redeem → GiftCardRedeemed → BookingConfirmed → confirmation emails
    - Test partner onboarding flow: application → approval → PartnerApproved → welcome email + Stripe Connect + credentials
    - Test wishlist purchase flow: purchase from wishlist → PaymentSplit → WishlistItemFulfilled → privacy-preserving notification
    - Test community sharing flow: BookingDatePassed → sharing prompt → moment submission → consent → feed display
    - Test Stripe Connect integration: payment intent with split, transfer to connected account, webhook handling
    - Test circuit breaker behavior when downstream services are unavailable
    - _Requirements: 3.1, 4.5, 6.3, 14.4, 16.1, 17.1_

- [x] 22. Final checkpoint - Ensure all tests pass
  - Ensure all unit tests, property tests, and integration tests pass across all services. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples, edge cases, and error conditions
- All services use TypeScript with AWS CDK for infrastructure
- PostgreSQL services use testcontainers for testing; DynamoDB services use DynamoDB Local
- External services (Stripe, SES) are mocked in unit/property tests, real in staging integration tests
