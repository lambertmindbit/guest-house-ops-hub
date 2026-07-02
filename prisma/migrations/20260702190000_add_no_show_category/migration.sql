-- No-show reliability (Phase 3, slice g). Additive: a new value on the
-- GuestAlertCategory enum so a shared repeat-offender flag reuses the bad-guest
-- alert machinery (verify / dispute / retention / hashed phone). No new table.
ALTER TYPE "GuestAlertCategory" ADD VALUE IF NOT EXISTS 'no_show';
