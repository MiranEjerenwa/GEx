# Requirements Document

## Introduction

The Experience Gift Platform is a family-first movement disguised as a web application. At its core, the Platform exists to reduce useless, forgettable gifting for younger generations and replace it with real, shared experiences that bring families closer together. Instead of another toy that ends up in a pile or more screen time, the Platform empowers purchasers — parents, grandparents, aunts, uncles, and friends — to give experiences like aquarium visits, botanical garden tours, cooking classes, and outdoor adventures.

This is a grassroots community effort to make gift-giving intentional and meaningful. The Platform promotes experiences over toys, screens, and gaming by making it easy to discover, purchase, gift, and redeem age-appropriate experiences for kids and families. Every gift card sent is a vote for family memories over material clutter.

The MVP supports the core journey of browsing experiences by age group and occasion, purchasing an experience gift card with a personal touch, delivering it to a recipient, and allowing the recipient to book and redeem the experience. The system is built on AWS with an extensible architecture to support future experience types, partner onboarding, and community growth.

## Glossary

- **Platform**: The Experience Gift Platform web application, including frontend and backend services
- **Purchaser**: A user who buys an experience gift card for a recipient
- **Recipient**: A person who receives and redeems an experience gift card
- **Experience**: A bookable activity offered by a Partner (e.g., aquarium visit, botanical garden tour)
- **Gift_Card**: A digital voucher representing a purchased experience, containing a unique redemption code, experience details, and personalized message
- **Partner**: A business that provides experiences on the Platform (e.g., Georgia Aquarium, Atlanta Botanical Garden)
- **Catalog**: The collection of all available Experiences listed on the Platform
- **Booking**: A confirmed reservation for a Recipient to attend a specific Experience on a specific date and time
- **Payment_Processor**: The third-party payment service (e.g., Stripe) integrated with the Platform for processing transactions
- **Partner_Portal**: The administrative interface where Partners manage their Experiences, availability, and Bookings
- **Redemption_Code**: A unique alphanumeric code on each Gift_Card used by the Recipient to claim and book the Experience
- **Admin_Portal**: The administrative interface used by Platform administrators to manage orders, Partners, Gift_Cards, platform settings, and customer support operations
- **Platform_Administrator**: An authorized internal user with elevated privileges to manage and oversee all Platform operations
- **Age_Group**: Age-appropriate categories for Experiences: toddler (0–3), kids (4–7), tweens (8–12), teens (13–17), and family/all ages
- **Occasion**: A reason for gifting an Experience, such as birthday, holiday, "just because", report card celebration, graduation, or other milestone
- **Wishlist**: A shareable list of desired Experiences created by a family, parent, or child, accessible via a unique link
- **Community_Impact**: Platform-wide metrics showing the collective shift from material to experiential gifting, including total Experiences gifted, families participating, and estimated family time created

## Requirements

### Requirement 1: Browse Experience Catalog

**User Story:** As a Purchaser, I want to browse available experiences by category, age group, and occasion, so that I can find the right gift for my recipient.

#### Acceptance Criteria

1. THE Platform SHALL display a Catalog of available Experiences with name, description, Partner name, price, recommended Age_Group, and a representative image for each Experience
2. WHEN a Purchaser selects a category filter, THE Platform SHALL display only Experiences matching the selected category
3. WHEN a Purchaser selects an Age_Group filter, THE Platform SHALL display only Experiences tagged with the selected Age_Group
4. WHEN a Purchaser selects an Occasion filter, THE Platform SHALL display only Experiences associated with the selected Occasion
5. WHEN a Purchaser applies multiple filters (category, Age_Group, Occasion), THE Platform SHALL display only Experiences matching all selected filter criteria
6. WHEN a Purchaser enters a search term, THE Platform SHALL display Experiences with names or descriptions containing the search term
7. WHEN no Experiences match the applied filters or search term, THE Platform SHALL display a message indicating no results were found and suggest clearing filters

### Requirement 2: Purchase Experience Gift Card

**User Story:** As a Purchaser, I want to buy an experience gift card that feels personal and intentional, so that I can give a meaningful experience to someone I care about.

#### Acceptance Criteria

1. WHEN a Purchaser selects an Experience from the Catalog, THE Platform SHALL display the Experience detail page including description, price, recommended Age_Group, available dates, Partner information, and a purchase button
2. WHEN a Purchaser initiates a purchase, THE Platform SHALL present a gift-card-style purchase flow that collects the Purchaser email address, Recipient name, Recipient email address, selected Occasion, and a personalized message
3. THE Platform SHALL present the purchase flow as a personal gift-writing experience rather than a transactional shopping cart
4. WHEN a Purchaser selects an Occasion during the purchase flow, THE Platform SHALL display Occasion-specific gift card templates for the Purchaser to choose from
5. THE Platform SHALL display the recommended Age_Group on the purchase flow to help the Purchaser confirm the Experience is appropriate for the Recipient
6. WHEN a Purchaser submits payment details, THE Platform SHALL send the payment request to the Payment_Processor for authorization
7. WHEN the Payment_Processor authorizes the transaction, THE Platform SHALL generate a Gift_Card with a unique Redemption_Code and store the Gift_Card record with status "purchased"
8. IF the Payment_Processor declines the transaction, THEN THE Platform SHALL display a descriptive error message to the Purchaser and retain the form data for retry
9. WHEN a Gift_Card is successfully generated, THE Platform SHALL display an order confirmation page to the Purchaser with the Gift_Card details and order reference number

### Requirement 3: Deliver Gift Card to Recipient

**User Story:** As a Purchaser, I want the gift card delivered to my recipient via email, so that the recipient can receive the gift without physical shipping.

#### Acceptance Criteria

1. WHEN a Gift_Card is successfully generated, THE Platform SHALL send a delivery email to the Recipient email address within 60 seconds
2. THE delivery email SHALL contain the Recipient name, Purchaser name, personalized message, Experience name, Redemption_Code, and a link to the redemption page on the Platform
3. IF the delivery email fails to send, THEN THE Platform SHALL retry delivery up to 3 times with exponential backoff and log the failure for manual review
4. WHEN a Purchaser requests to resend the Gift_Card email from the order confirmation page, THE Platform SHALL resend the delivery email to the Recipient email address

### Requirement 4: Redeem Gift Card and Book Experience

**User Story:** As a Recipient, I want to redeem my gift card and book the experience, so that I can enjoy the gifted activity.

#### Acceptance Criteria

1. WHEN a Recipient navigates to the redemption page and enters a valid Redemption_Code with Gift_Card status "delivered", THE Platform SHALL display the Experience details, personalized message, and available booking dates and times
2. IF a Recipient enters an invalid Redemption_Code, THEN THE Platform SHALL display an error message indicating the code is not recognized
3. IF a Recipient enters a Redemption_Code for a Gift_Card with status "redeemed", THEN THE Platform SHALL display an error message indicating the gift card has already been used and display the existing Booking details
4. IF a Recipient enters a Redemption_Code for a Gift_Card with status "purchased" (not yet delivered), THEN THE Platform SHALL display an error message indicating the gift card is not yet available for redemption
5. WHEN a Recipient selects an available date and time and confirms the Booking, THE Platform SHALL acquire an exclusive lock on the Gift_Card record, verify the Gift_Card status is "delivered", create a Booking record with status "confirmed", and atomically update the Gift_Card status to "redeemed" within a single transaction
6. IF a concurrent redemption attempt occurs while another redemption is in progress for the same Gift_Card, THEN THE Platform SHALL reject the second attempt and return an error message indicating the gift card is being processed
7. WHEN a redemption request is received for a Gift_Card that is already "redeemed", THE Platform SHALL return the existing Booking details without creating a duplicate Booking (idempotent behavior)
8. WHEN a Booking is confirmed, THE Platform SHALL send a confirmation email to the Recipient email address containing the Experience name, date, time, location, and any Partner-provided instructions
9. WHEN a Booking is confirmed, THE Platform SHALL send a notification email to the Partner email address containing the Booking details

### Requirement 5: Partner Experience Management

**User Story:** As a Partner, I want to manage my experiences and availability on the platform, so that I can control what is offered and when.

#### Acceptance Criteria

1. WHEN a Partner logs into the Partner_Portal, THE Partner_Portal SHALL display a dashboard listing all Experiences owned by the Partner with their status and upcoming Bookings
2. WHEN a Partner creates a new Experience, THE Partner_Portal SHALL require the Partner to provide a name, description, category, price, available dates and times, location, capacity per time slot, and at least one image
3. WHEN a Partner updates an Experience, THE Partner_Portal SHALL save the changes and reflect the updates in the Catalog within 30 seconds
4. WHEN a Partner sets an Experience status to inactive, THE Platform SHALL remove the Experience from the public Catalog and prevent new purchases of that Experience
5. WHILE an Experience has confirmed Bookings for a specific date, THE Partner_Portal SHALL prevent the Partner from removing that date from availability

### Requirement 6: Partner Onboarding

**User Story:** As a new Partner, I want a straightforward onboarding process, so that I can start listing my experiences on the platform with minimal friction.

#### Acceptance Criteria

1. WHEN a prospective Partner submits an onboarding application through the Platform, THE Platform SHALL collect business name, contact email, business description, and experience categories
2. WHEN an onboarding application is submitted, THE Platform SHALL store the application with status "pending_review" and send a confirmation email to the Partner contact email
3. WHEN a Platform administrator approves an onboarding application, THE Platform SHALL create a Partner account, generate temporary credentials, and send a welcome email with login instructions to the Partner contact email
4. IF a Platform administrator rejects an onboarding application, THEN THE Platform SHALL send a rejection email to the Partner contact email with the reason for rejection

### Requirement 7: Order and Gift Card Status Tracking

**User Story:** As a Purchaser, I want to check the status of my gift card, so that I know whether the recipient has received and used it.

#### Acceptance Criteria

1. WHEN a Purchaser navigates to the order status page and enters the order reference number and Purchaser email address, THE Platform SHALL display the Gift_Card status (purchased, delivered, redeemed) and associated Booking details if redeemed
2. THE Platform SHALL update the Gift_Card status to "delivered" when the delivery email is successfully sent to the Recipient
3. THE Platform SHALL update the Gift_Card status to "redeemed" when the Recipient confirms a Booking using the Redemption_Code

### Requirement 8: Payment Processing and Security

**User Story:** As a Purchaser, I want my payment information handled securely, so that I can trust the platform with my financial data.

#### Acceptance Criteria

1. THE Platform SHALL delegate all credit card processing to the Payment_Processor and SHALL NOT store raw credit card numbers, CVVs, or full card details on Platform servers
2. WHEN processing a payment, THE Platform SHALL use HTTPS for all communication with the Payment_Processor
3. WHEN a transaction is completed, THE Platform SHALL store only the transaction reference ID, amount, currency, and status returned by the Payment_Processor
4. IF a network error occurs during payment processing, THEN THE Platform SHALL display an error message to the Purchaser advising to retry and SHALL NOT create a duplicate charge

### Requirement 9: Gift Card Data Integrity and Lifecycle

**User Story:** As a platform operator, I want gift card data to remain consistent with a well-defined lifecycle, so that each gift card can only be redeemed once and all records are accurate.

#### Acceptance Criteria

1. THE Platform SHALL generate each Redemption_Code as a cryptographically random alphanumeric string of at least 12 characters
2. THE Platform SHALL enforce uniqueness of each Redemption_Code across all Gift_Card records
3. THE Platform SHALL enforce a strict Gift_Card lifecycle state machine with the following valid transitions: "purchased" → "delivered" → "redeemed", and no other transitions SHALL be permitted
4. THE Platform SHALL reject any Gift_Card status update that does not follow a valid transition in the lifecycle state machine
5. WHEN a Recipient redeems a Gift_Card, THE Platform SHALL use a database-level pessimistic lock and atomic status update within a single transaction to prevent concurrent redemption of the same Gift_Card
6. THE Platform SHALL record an audit log entry for every redemption attempt (successful or failed) containing the Redemption_Code, timestamp, requesting IP address, and outcome (success, already_redeemed, invalid_code, concurrent_conflict)
7. FOR ALL valid Gift_Card records, creating a Gift_Card then retrieving the Gift_Card by Redemption_Code SHALL return an equivalent Gift_Card object (round-trip property)
8. FOR ALL Gift_Card records, the status field SHALL only contain one of the values: "purchased", "delivered", or "redeemed"

### Requirement 10: Platform Admin Portal

**User Story:** As a Platform_Administrator, I want an admin portal to manage all platform operations, so that I can oversee orders, partners, gift cards, and support cases from a single interface.

#### Acceptance Criteria

1. WHEN a Platform_Administrator logs into the Admin_Portal, THE Admin_Portal SHALL require multi-factor authentication before granting access
2. WHEN a Platform_Administrator navigates to the dashboard, THE Admin_Portal SHALL display platform metrics including total orders, total revenue, number of active Partners, number of Gift_Cards by status, and number of Bookings for the selected time period
3. WHEN a Platform_Administrator searches for an order by order reference number, Purchaser email, or Recipient email, THE Admin_Portal SHALL display matching order records with full Gift_Card and Booking details
4. WHEN a Platform_Administrator views a Gift_Card record, THE Admin_Portal SHALL display the complete Gift_Card lifecycle history including status transitions, timestamps, and the redemption audit log
5. WHEN a Platform_Administrator triggers a resend of a Gift_Card delivery email, THE Admin_Portal SHALL resend the delivery email to the Recipient email address and log the action with the Platform_Administrator identity and timestamp
6. WHEN a Platform_Administrator views the partner onboarding queue, THE Admin_Portal SHALL display all onboarding applications with status "pending_review" sorted by submission date
7. WHEN a Platform_Administrator approves a partner onboarding application from the Admin_Portal, THE Platform SHALL create the Partner account, generate temporary credentials, and send the welcome email to the Partner contact email
8. IF a Platform_Administrator rejects a partner onboarding application from the Admin_Portal, THEN THE Platform SHALL require the Platform_Administrator to provide a rejection reason and send a rejection email to the Partner contact email
9. WHEN a Platform_Administrator navigates to the partner management page, THE Admin_Portal SHALL display a list of all Partners with their status, number of active Experiences, and total Bookings
10. WHEN a Platform_Administrator navigates to the platform settings page, THE Admin_Portal SHALL allow configuration of email templates, supported experience categories, and platform-wide feature flags
11. THE Admin_Portal SHALL log all Platform_Administrator actions with the Platform_Administrator identity, action type, affected record, and timestamp for audit purposes

### Requirement 11: Platform Availability and Resilience

**User Story:** As a platform operator, I want the system to be resilient and available, so that users can purchase and redeem gift cards reliably.

#### Acceptance Criteria

1. THE Platform SHALL be deployed on AWS using managed services to minimize operational overhead
2. IF a downstream AWS service becomes temporarily unavailable, THEN THE Platform SHALL retry the operation with exponential backoff and return a user-friendly error message after retries are exhausted
3. THE Platform SHALL use a managed relational database with automated backups enabled with a retention period of at least 7 days
4. THE Platform SHALL serve all user-facing pages over HTTPS

### Requirement 12: Age-Appropriate Experience Browsing

**User Story:** As a Purchaser, I want to browse experiences by age group, so that I can find developmentally appropriate activities for the child I am gifting.

#### Acceptance Criteria

1. THE Platform SHALL require each Experience to be tagged with at least one Age_Group (toddler, kids, tweens, teens, or family/all ages)
2. WHEN a Purchaser selects an Age_Group filter, THE Platform SHALL display only Experiences tagged with the selected Age_Group
3. THE Platform SHALL display the recommended Age_Group prominently on each Experience listing and detail page
4. WHEN a Partner creates or updates an Experience, THE Partner_Portal SHALL require the Partner to select at least one Age_Group for the Experience

### Requirement 13: Occasion-Based Gifting

**User Story:** As a Purchaser, I want to browse experiences by occasion, so that I can find the right gift for a specific celebration or milestone.

#### Acceptance Criteria

1. THE Platform SHALL support browsing Experiences by Occasion (birthday, holiday, just because, report card celebration, graduation, and other configurable Occasions)
2. WHEN a Purchaser selects an Occasion from the browse page, THE Platform SHALL display a curated collection of Experiences associated with the selected Occasion
3. THE Platform SHALL provide Occasion-specific gift card templates with themed visuals and suggested personalized messages
4. WHEN a Platform_Administrator configures a seasonal or Occasion-based curated collection, THE Platform SHALL display the collection on the browse page during the configured date range

### Requirement 14: Family Wishlists

**User Story:** As a parent or child, I want to create a wishlist of experiences I would love, so that family and friends can gift us meaningful experiences instead of material items.

#### Acceptance Criteria

1. WHEN a registered user creates a Wishlist, THE Platform SHALL allow the user to add Experiences from the Catalog to the Wishlist with an optional personal note
2. THE Platform SHALL generate a unique shareable link for each Wishlist that can be sent to grandparents, aunts, uncles, and friends
3. WHEN a Purchaser opens a shared Wishlist link, THE Platform SHALL display the Wishlist Experiences and allow the Purchaser to purchase a Gift_Card directly from the Wishlist
4. WHEN a Purchaser purchases an Experience from a Wishlist, THE Platform SHALL mark the Wishlist item as "fulfilled" and notify the Wishlist owner that "someone got you something from your wishlist" without revealing the specific Experience or Purchaser identity
5. WHEN a Wishlist owner views the Wishlist, THE Platform SHALL display each item with its fulfillment status (unfulfilled or fulfilled)
6. THE Platform SHALL allow a Wishlist owner to remove Experiences from the Wishlist at any time

### Requirement 15: Community Impact Dashboard

**User Story:** As a platform visitor, I want to see the collective impact of experiential gifting, so that I feel inspired to join the movement and choose experiences over material gifts.

#### Acceptance Criteria

1. THE Platform SHALL display a public-facing Community_Impact dashboard showing total families who chose experiences over material gifts in the current month, total Experiences gifted in the current year, and estimated total hours of family time created
2. WHEN a registered user views the Community_Impact dashboard, THE Platform SHALL display individual impact metrics including total Experiences gifted by the user and estimated number of material gifts replaced
3. THE Platform SHALL generate shareable impact badges containing the user individual impact metrics for posting on social media
4. THE Platform SHALL update Community_Impact metrics within 24 hours of each completed Gift_Card purchase

### Requirement 16: Post-Experience Social Sharing

**User Story:** As a Recipient, I want to optionally share a moment from my experience, so that I can inspire other families to choose experiences over things.

#### Acceptance Criteria

1. WHEN an Experience Booking date has passed, THE Platform SHALL prompt the Recipient with an optional invitation to share a "Look what we did!" moment
2. THE Platform SHALL allow the Recipient to upload a photo and a short caption (maximum 280 characters) as a shared moment
3. THE Platform SHALL require explicit opt-in consent before publishing any shared moment, and SHALL NOT collect or display location data
4. WHILE the Recipient is a minor (under 18), THE Platform SHALL require parent or guardian approval before publishing a shared moment
5. WHEN a shared moment is published, THE Platform SHALL display the moment in a community feed visible to all Platform visitors
6. THE Platform SHALL NOT allow public comments on shared moments to maintain a positive and safe community environment

### Requirement 17: Commission and Partner Payments (Stripe Connect)

**User Story:** As a Platform operator, I want to split payments between the Platform and Partners using Stripe Connect, so that Partners receive their earnings directly and the Platform sustains itself through commissions.

#### Acceptance Criteria

1. THE Platform SHALL use Stripe Connect to process all Gift_Card purchases and split payments between the Platform and the Partner associated with the Experience
2. THE Platform SHALL apply a configurable commission rate per Partner, with a default commission rate between 15% and 20%
3. WHEN a Gift_Card purchase is completed, THE Platform SHALL direct the Partner payout to the Partner bank account registered in Stripe Connect
4. WHEN a Platform_Administrator views the commission management page in the Admin_Portal, THE Admin_Portal SHALL display current commission rates for all Partners and allow the Platform_Administrator to update commission rates
5. THE Platform SHALL NOT charge service fees to Purchasers in phase 1
6. WHEN a Partner completes onboarding, THE Platform SHALL guide the Partner through Stripe Connect account setup to enable direct payouts
