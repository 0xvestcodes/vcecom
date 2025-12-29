#!/bin/bash

# Script to organize order services into logical folders

cd "$(dirname "$0")"

# Create folder structure
mkdir -p creation calculation pricing discount checkout persistence validation events notifications inventory query status gst payment snapshot cart idempotency

# Move services to appropriate folders
# Creation services
mv order-creation.service.ts creation/ 2>/dev/null || true
mv order-creation.helper.ts creation/ 2>/dev/null || true

# Calculation services
mv order-calculation.service.ts calculation/ 2>/dev/null || true
mv order-totals-calculation.service.ts calculation/ 2>/dev/null || true

# Pricing services
mv order-pricing.service.ts pricing/ 2>/dev/null || true
mv order-pricing-engine.service.ts pricing/ 2>/dev/null || true
mv order-pricing-drift.service.ts pricing/ 2>/dev/null || true

# Discount services
mv order-discount.service.ts discount/ 2>/dev/null || true
mv order-discount-engine.service.ts discount/ 2>/dev/null || true
mv order-discount-usage.service.ts discount/ 2>/dev/null || true
mv order-discount-extraction.service.ts discount/ 2>/dev/null || true

# Checkout services
mv order-checkout-session.service.ts checkout/ 2>/dev/null || true
mv order-checkout-orchestration.service.ts checkout/ 2>/dev/null || true
mv order-state-transition.service.ts checkout/ 2>/dev/null || true
mv order-metadata.service.ts checkout/ 2>/dev/null || true

# Persistence services
mv order-persistence.service.ts persistence/ 2>/dev/null || true

# Validation services
mv order-validation.service.ts validation/ 2>/dev/null || true

# Event services
mv order-event-orchestration.service.ts events/ 2>/dev/null || true

# Notification services
mv order-notification.service.ts notifications/ 2>/dev/null || true

# Inventory services
mv order-inventory.service.ts inventory/ 2>/dev/null || true

# Query services
mv order-query.service.ts query/ 2>/dev/null || true
mv order-enrichment.service.ts query/ 2>/dev/null || true
mv order-response-builder.service.ts query/ 2>/dev/null || true

# Status services
mv order-status.service.ts status/ 2>/dev/null || true
mv order-tracking.service.ts status/ 2>/dev/null || true
mv order-timeline.service.ts status/ 2>/dev/null || true

# GST services
mv order-gst.service.ts gst/ 2>/dev/null || true

# Payment services
mv order-payment-intent.service.ts payment/ 2>/dev/null || true
mv order-payment.service.ts payment/ 2>/dev/null || true

# Snapshot services
mv order-pricing-snapshot.service.ts snapshot/ 2>/dev/null || true
mv order-snapshot-audit.service.ts snapshot/ 2>/dev/null || true
mv order-snapshot-validation.service.ts snapshot/ 2>/dev/null || true

# Cart services
mv order-cart-processing.service.ts cart/ 2>/dev/null || true
mv order-cart-cleanup.service.ts cart/ 2>/dev/null || true
mv order-cart-data.service.ts cart/ 2>/dev/null || true

# Idempotency services
mv order-idempotency.service.ts idempotency/ 2>/dev/null || true

# Other services (keep in root for now)
# order-address.service.ts
# order-archive.service.ts
# order-cancel.service.ts
# order-duplicate.service.ts
# order-notes.service.ts
# refunds.service.ts

echo "Services organized successfully!"
