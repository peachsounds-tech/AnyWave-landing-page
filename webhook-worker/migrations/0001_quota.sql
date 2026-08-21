-- Server-authoritative free-tier song quota.
--
-- Replaces the client-side counter in the desktop app's trial.dat, which reset
-- to zero whenever that file went missing. On Microsoft Store installs an
-- ordinary uninstall wipes the package's AppData container, so the free tier
-- was resettable without any deliberate tampering.
--
-- Apply with:
--   wrangler d1 migrations apply beatcue-quota           # remote
--   wrangler d1 migrations apply beatcue-quota --local   # wrangler dev

-- ─── Accounts ────────────────────────────────────────────────────────────────
-- One row per entitlement identity. Keyed on a hashed hardware fingerprint
-- rather than the analytics bcid: the bcid lives in BeatCue.settings and dies
-- with the app data, while the fingerprint is derived from OS-level machine
-- identifiers that survive reinstalling the app.
CREATE TABLE IF NOT EXISTS quota_accounts (
    device_id         TEXT    PRIMARY KEY,

    created_at        INTEGER NOT NULL,
    last_seen_at      INTEGER NOT NULL,

    -- Rolling period, anchored on the account's first claim and advanced one
    -- calendar month at a time. Server clock only, so moving the client clock
    -- forward no longer rolls the period.
    period_start      INTEGER NOT NULL,

    -- The limit in force for the *current* period, snapshotted when the period
    -- began. Lowering the global default therefore can't strand someone who is
    -- already mid-period above the new number — the change lands at their next
    -- rollover. Raising it applies immediately (see resolveEffectiveLimit).
    period_limit      INTEGER NOT NULL,

    -- Per-account limit, NULL to inherit the global default. This is the
    -- support lever: granting a user extra songs is an UPDATE, not a release.
    limit_override    INTEGER,

    -- Last known analytics / attribution identity. Denormalised for support
    -- lookups ("user says they're bc_x, what does their ledger look like?").
    -- Never used for entitlement decisions.
    bcid              TEXT,

    platform          TEXT,
    app_version       TEXT,

    -- 1 when the row was bootstrapped from a client's local trial.dat during
    -- the migration window rather than built from real claims.
    seeded_from_local INTEGER NOT NULL DEFAULT 0,

    -- Free-text support notes, e.g. why an override was granted.
    notes             TEXT
);

-- ─── Owned songs ─────────────────────────────────────────────────────────────
-- One row per (device, song) ever granted. Presence means ownership, forever —
-- this preserves the existing grandfathering rule where a song you've already
-- analysed stays usable in later periods and never consumes a second slot.
--
-- period_start records which period paid for the slot, so usage is a COUNT
-- against the account's current period rather than a mutable counter that
-- could drift.
CREATE TABLE IF NOT EXISTS quota_songs (
    device_id    TEXT    NOT NULL,
    song_hash    TEXT    NOT NULL,   -- lowercase hex SHA-256 of the file bytes
    granted_at   INTEGER NOT NULL,
    period_start INTEGER NOT NULL,
    source       TEXT    NOT NULL,   -- 'claim' | 'seed' | 'grant'

    PRIMARY KEY (device_id, song_hash)
);

-- Serves the hot path: counting this period's usage for one device.
CREATE INDEX IF NOT EXISTS idx_quota_songs_period
    ON quota_songs (device_id, period_start);

-- ─── Identity links ──────────────────────────────────────────────────────────
-- Secondary identities that resolve to an account. Lets a reinstall recover
-- its bcid (so analytics stops counting it as a new user) and lets a license
-- activation attach a purchase to a device without the device being the key.
--
-- Deliberately not a uniqueness constraint on device_id: one device can carry
-- several historical bcids.
CREATE TABLE IF NOT EXISTS quota_identity_links (
    kind      TEXT    NOT NULL,   -- 'bcid' | 'email_hash' | 'store_cid'
    value     TEXT    NOT NULL,
    device_id TEXT    NOT NULL,
    linked_at INTEGER NOT NULL,

    PRIMARY KEY (kind, value)
);

CREATE INDEX IF NOT EXISTS idx_quota_identity_device
    ON quota_identity_links (device_id);

-- ─── Config ──────────────────────────────────────────────────────────────────
-- Global knobs, readable and writable without shipping a build. The desktop
-- app never sees these directly; it only ever renders the numbers the claim
-- response hands back.
CREATE TABLE IF NOT EXISTS quota_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Matches FREE_TIER_SONGS_PER_MONTH at the time of writing. A missing or
-- unparseable row falls back to the same number in code rather than to zero,
-- so a bad write can't become an accidental kill switch for the free tier.
INSERT INTO quota_config (key, value) VALUES ('default_limit', '5')
    ON CONFLICT(key) DO NOTHING;
