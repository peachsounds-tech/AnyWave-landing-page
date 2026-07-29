# BeatCue Webhook Worker

A single Cloudflare Worker with four responsibilities:

1. **Lemon Squeezy → PostHog**: receive purchase webhooks and forward funnel events to PostHog.
2. **Web ↔ desktop pairing**: bridge the `bcid` + Meta attribution captured on the download page over to the freshly installed desktop app — without tripping Chrome's Local Network Access permission prompt.
3. **Meta Conversions API proxy**: accept `/capi` events from the desktop app (and optionally the browser) and forward them to Meta's Graph API, keeping the access token off-client.
4. **Google Ads conversion upload proxy**: accept `/gads` events from the browser and forward them via `uploadClickConversions`, keeping OAuth + developer token off-client.

## Routes

| Method | Path | Used by | Purpose |
|---|---|---|---|
| `GET`  | `/health` | smoke tests | returns `OK` |
| `POST` | `/webhook/lemonsqueezy` | Lemon Squeezy | order/subscription/license webhooks |
| `POST` | `/pairings` | download page | store pending pairing payload (CORS-gated) |
| `POST` | `/pairings/claim` | desktop app | fetch and consume pending pairing |
| `GET`  | `/pairings/claimed/:bcid` | download page | poll whether app has paired |
| `POST` | `/capi` | desktop app / browser | forward a single Meta CAPI event (CORS-gated for browsers) |
| `POST` | `/gads` | browser | forward a single Google Ads click conversion (CORS-gated) |
| `OPTIONS` | `/pairings*`, `/capi`, `/gads` | browsers | CORS preflight |

## Lemon Squeezy events tracked

| Lemon Squeezy Event | PostHog Event | Description |
|---------------------|---------------|-------------|
| `order_created` | `checkout_completed` | User completed checkout |
| `license_key_created` | `license_key_created` | License key was generated |
| `subscription_created` | `subscription_created` | Subscription started |

## Pairing flow

```
1. User loads /download in browser
   → page mints bcid, captures _fbp / _fbc / fbclid

2. User clicks "Download" button
   → page POSTs /pairings { bcid, fbp, fbc, fbclid, utms }
   → worker stores it in KV under sha256(coarse_ip + os)[:24], TTL 24 hours

3. User runs the installer

4. Desktop app first launch (no prior pairing recorded)
   → app POSTs /pairings/claim { os: "mac" | "win" }
   → worker rebuilds the same key from app's connecting IP + OS
   → on hit: returns the JSON payload + deletes the KV entry
   → app calls applyPairing() — aliases bcid into PostHog, persists Meta IDs

Failure modes:
- Different network between download and launch (VPN dropped) → 404, app stays anonymous
- Two BeatCue installs from same NAT within the 24h TTL window → second one wins,
  first user stays anonymous (acceptable — rare at current install volume)
```

## Setup Instructions

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create the pairing KV namespace

```bash
cd landing-page/webhook-worker

# Production namespace
wrangler kv namespace create PAIRINGS
# → outputs:  id = "abc123…"

# Preview namespace (used by `wrangler dev`)
wrangler kv namespace create PAIRINGS --preview
# → outputs:  preview_id = "def456…"
```

Paste both IDs into the `[[kv_namespaces]]` block in `wrangler.toml`. Skip this step if you only need the Lemon Squeezy webhook — the `/pairings` routes will return 503 until the binding exists.

### 4. Deploy the Worker

```bash
wrangler deploy
```

You'll get a URL like: `https://peachsounds-webhook.YOUR_SUBDOMAIN.workers.dev`

Bind a custom domain in the Cloudflare dashboard (e.g. `https://api.beatcue.app`) and update `PAIRINGS_BASE` in `landing-page/download.html` and `Source/Identity/PairingClient.h` to point at it.

### 5. Set Webhook Secret (Optional but Recommended)

Get your webhook secret from Lemon Squeezy dashboard, then:

```bash
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
# Paste your secret when prompted
```

### 5b. Configure Meta Conversions API

Required for `/capi` to work. Without these the route returns 503.

```bash
# Pixel ID — same one used by fbq() on the landing page (708429622326201).
wrangler secret put META_PIXEL_ID

# Access token — generate in Meta Events Manager:
#   Events Manager → your pixel → Settings → Conversions API
#   → "Generate access token". Treat as a password.
wrangler secret put META_CAPI_TOKEN

# Optional: route events to "Test Events" tab while verifying.
# Get the code from Events Manager → Test Events → "Test server events".
wrangler secret put META_TEST_EVENT_CODE
# After verification:
#   wrangler secret delete META_TEST_EVENT_CODE
```

#### Verifying CAPI

1. Open Events Manager → your pixel → **Test Events**.
2. Set `META_TEST_EVENT_CODE` (above) to the code displayed there.
3. Trigger an event from the desktop app (or curl):
   ```bash
   WORKER=https://peachsounds-webhook.YOUR_SUBDOMAIN.workers.dev
   curl -i -X POST "$WORKER/capi" \
       -H 'content-type: application/json' \
       -d '{
         "event_name": "InitiateCheckout",
         "event_id": "evt_test_'"$(date +%s)"'",
         "event_source_url": "https://beatcue.app/download",
         "internal_name": "export_clicked",
         "user_data": {
           "fbp": "fb.1.0.test", "fbc": "fb.1.0.test",
           "external_id": "bc_smoke12345678"
         },
         "custom_data": { "value": 0, "currency": "USD" }
       }'
   ```
4. Watch it land in Test Events within a few seconds. Once green across all 5 events, delete `META_TEST_EVENT_CODE`.

#### Event allowlist

The worker rejects unknown event names to prevent accidental optimization-skewing pushes. Update the allowlist in `worker.js` (`CAPI_STANDARD_EVENTS` / `CAPI_CUSTOM_EVENTS`) when adding a new event.

Currently allowed:

| Event name on wire | Origin | Internal name | Optimization target? |
|---|---|---|---|
| `app_launched` (custom) | desktop app, first launch | `app_launched` | no |
| `cut_played` (custom) | desktop app, first per session | `cut_played` | no |
| `InitiateCheckout` | desktop app | `export_clicked` | **yes (start)** |
| `AddPaymentInfo` | desktop app | `activation_started` | no |
| `Subscribe` | desktop app | `activation_finished` | **yes (later)** |

### 5c. Configure Google Ads conversion uploads (`/gads`)

Landing pages dual-fire key conversions: browser `gtag('event','conversion',{transaction_id})` **and** `POST /gads` with the same `transaction_id` as `orderId`, so Google can dedupe. Organic traffic (no `gclid`/`gbraid`/`wbraid`) is soft-skipped by the worker.

#### One-time Google Cloud / Ads setup

1. Create (or reuse) a Google Cloud project → enable **Google Ads API**.
2. Create an OAuth client (Desktop or Web) → note `client_id` + `client_secret`.
3. Generate a refresh token for a user that can access the BeatCue Ads account
   (e.g. via [OAuth Playground](https://developers.google.com/oauthplayground) with
   scope `https://www.googleapis.com/auth/adwords`, or `gcloud` auth flow).
4. Apply for / copy a **Developer token** from Google Ads → Tools → API Center.
5. Note the **Customer ID** (digits only, no dashes). If you authenticate via an
   MCC, also note the manager **Login Customer ID**.
6. Look up conversion action resource names (Google Ads → Goals → Conversions,
   or via the API). Format: `customers/{CUSTOMER_ID}/conversionActions/{ACTION_ID}`.

Map the existing browser conversion labels to those resource names:

| Landing `event_name` | Browser `send_to` | Secret key in `GOOGLE_ADS_CONV_ACTIONS` |
|---|---|---|
| `send_to_desktop` | `AW-18317916073/1x2-COL5tNQcEKnv1J5E` | `send_to_desktop` |
| `trial_download` | `AW-18317916073/H-gBCKTHnNUcEKnv1J5E` | `trial_download` |
| `checkout_clicked` | (optional — leave unmapped until you create one) | `checkout_clicked` |

```bash
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
wrangler secret put GOOGLE_ADS_CLIENT_ID
wrangler secret put GOOGLE_ADS_CLIENT_SECRET
wrangler secret put GOOGLE_ADS_REFRESH_TOKEN
wrangler secret put GOOGLE_ADS_CUSTOMER_ID
# Optional if using an MCC:
# wrangler secret put GOOGLE_ADS_LOGIN_CUSTOMER_ID

# JSON map — paste as a single line when prompted:
wrangler secret put GOOGLE_ADS_CONV_ACTIONS
# Example value:
# {"send_to_desktop":"customers/1234567890/conversionActions/111","trial_download":"customers/1234567890/conversionActions/222"}

# Optional dry-run (validateOnly, no attribution):
# wrangler secret put GOOGLE_ADS_VALIDATE_ONLY   # value: 1
```

#### Verifying `/gads`

1. Set `GOOGLE_ADS_VALIDATE_ONLY=1` while testing, or use a real click with a fresh `gclid`.
2. Curl:
   ```bash
   WORKER=https://peachsounds-webhook.YOUR_SUBDOMAIN.workers.dev
   curl -i -X POST "$WORKER/gads" \
       -H 'content-type: application/json' \
       -d '{
         "event_name": "trial_download",
         "transaction_id": "evt_test_'"$(date +%s)"'",
         "event_source_url": "https://beatcue.app/download",
         "internal_name": "smoke_test",
         "value": 1.0,
         "currency": "ILS",
         "user_data": { "gclid": "PASTE_A_REAL_GCLID" }
       }'
   ```
3. Watch `wrangler tail` for `gads_forwarded` / `gads_oauth_error`. In Ads UI,
   Diagnostics → Uploads (or conversion action diagnostics) should show the hit
   once validate-only is off and a real click id is used.
4. Delete validate-only when done: `wrangler secret delete GOOGLE_ADS_VALIDATE_ONLY`.

### 6. Configure Lemon Squeezy Webhook

1. Go to [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/settings/webhooks)
2. Click "Add Webhook"
3. Set the URL to: `https://peachsounds-webhook.YOUR_SUBDOMAIN.workers.dev/webhook/lemonsqueezy`
4. Select events:
   - ✅ `order_created`
   - ✅ `license_key_created`
   - ✅ `subscription_created` (if using subscriptions)
5. Copy the signing secret and set it via `wrangler secret put` (step 5)

### 7. Test

Health check:

```bash
curl https://peachsounds-webhook.YOUR_SUBDOMAIN.workers.dev/health
# → OK
```

Smoke-test the pairing routes end to end:

```bash
WORKER=https://peachsounds-webhook.YOUR_SUBDOMAIN.workers.dev

# 1. Page POSTs an attribution payload
curl -i -X POST "$WORKER/pairings" \
    -H 'content-type: application/json' \
    -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2)' \
    -d '{"bcid":"bc_smoke12345678","fbp":"fb.1.0.x","fbc":"fb.1.0.y","fbclid":"IwTEST"}'
# → 200 {"ok":true}

# 2. App claims it (must come from same IP, same OS family)
curl -i -X POST "$WORKER/pairings/claim" \
    -H 'content-type: application/json' \
    -A 'BeatCue/1.0' \
    -d '{"os":"mac"}'
# → 200 {"bcid":"bc_smoke12345678", …}

# 3. Re-claim should now miss (single-shot)
curl -i -X POST "$WORKER/pairings/claim" \
    -H 'content-type: application/json' \
    -d '{"os":"mac"}'
# → 404 {"ok":false,"error":"no_pending_pairing"}
```

## Funnel Flow

```
Landing Page                 Lemon Squeezy              Cloudflare Worker         PostHog
────────────────────────────────────────────────────────────────────────────────────────────
1. landing_page_viewed ─────────────────────────────────────────────────────────► Event
   (uuid: abc-123)

2. application_submitted ───────────────────────────────────────────────────────► Event
   (uuid → alias → hash-email)

3. Redirect to checkout ───► Checkout page
   (passes hashed_email,     (custom data stored)
    uuid in URL)

4. User completes checkout ─► order_created webhook ──► checkout_completed ────► Event
                              (includes custom data)    (distinct_id: hash-email)

5. License key generated ───► license_key_created ────► license_key_created ───► Event
                              webhook                   (distinct_id: hash-email)
```

## Debugging

View worker logs:

```bash
wrangler tail
```

Check PostHog for events with `$lib: cloudflare-worker` property.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signing secret | Recommended |
| `META_PIXEL_ID` | Numeric pixel ID (e.g. `708429622326201`) | Required for `/capi` |
| `META_CAPI_TOKEN` | Conversions API access token | Required for `/capi` |
| `META_TEST_EVENT_CODE` | Test Events code; events bypass prod attribution while set | Optional, verification only |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Ads API developer token | Required for `/gads` |
| `GOOGLE_ADS_CLIENT_ID` | OAuth client ID | Required for `/gads` |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth client secret | Required for `/gads` |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth refresh token | Required for `/gads` |
| `GOOGLE_ADS_CUSTOMER_ID` | Ads customer ID (no dashes) | Required for `/gads` |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC manager customer ID | Optional |
| `GOOGLE_ADS_CONV_ACTIONS` | JSON map `event_name` → conversion action resource | Required for `/gads` |
| `GOOGLE_ADS_VALIDATE_ONLY` | `"1"` / `"true"` → dry-run uploads | Optional |

## Local Development

```bash
wrangler dev
```

Then use ngrok or similar to expose locally for webhook testing.

