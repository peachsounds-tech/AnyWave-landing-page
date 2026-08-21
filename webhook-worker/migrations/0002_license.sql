-- Paid-licence activations, worker-mediated.
--
-- The desktop app used to call api.lemonsqueezy.com directly and trust the JSON
-- it got back, which a fake server (local root CA + hosts entry) could forge,
-- and it stored a locally self-signed license.dat that a compiled-in key let
-- anyone hand-write. Both are closed by routing validation through the worker
-- and returning an Ed25519-signed entitlement token the client verifies with a
-- public key it cannot use to forge.
--
-- This table is the worker's cache of the last Lemon Squeezy answer per device,
-- so ordinary client traffic (re-validation on launch, every LICENSE_RECHECK)
-- does not burn the store-wide 60-requests-per-minute License API limit.
--
-- Apply with:
--   wrangler d1 migrations apply beatcue-quota --local    # wrangler dev
--   wrangler d1 migrations apply beatcue-quota --remote    # remote

CREATE TABLE IF NOT EXISTS license_activations (
    -- Same stable hardware id the quota ledger uses (DeviceId::get), so a
    -- reinstall re-validates the same row instead of re-activating and burning
    -- another Lemon Squeezy activation slot.
    device_id       TEXT    PRIMARY KEY,

    -- MachineId::generate — the licence-binding fingerprint. Recorded so a
    -- support agent can see which machine an instance belongs to, and echoed
    -- into the signed token for the client to match.
    machine_id      TEXT,

    -- The Lemon Squeezy license key and the activation instance it created.
    -- instance_id is required for validate/deactivate calls.
    license_key     TEXT    NOT NULL,
    instance_id     TEXT,

    -- Last known Lemon Squeezy verdict, cached to serve re-validation cheaply.
    status          TEXT,               -- active | inactive | expired | disabled | cancelled
    ends_at         INTEGER NOT NULL DEFAULT 0,   -- subscription/license expiry, ms epoch, 0 = none

    -- Denormalised customer info for support lookups and to surface in-app.
    email           TEXT,
    name            TEXT,
    order_id        TEXT,

    created_at      INTEGER NOT NULL,
    last_validated_at INTEGER NOT NULL DEFAULT 0
);

-- Support lookup: "customer says their key is X, which devices activated it?"
CREATE INDEX IF NOT EXISTS idx_license_key ON license_activations (license_key);
