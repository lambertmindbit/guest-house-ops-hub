-- ID-collection acknowledgement (booking time). Additive nullable column: when
-- the person taking the booking confirmed the guest accepts that a valid ID will
-- be collected at check-in. Does not touch the stay/status columns or the
-- no_overlapping_confirmed_stays GiST constraint.
ALTER TABLE "reservations" ADD COLUMN "id_ack_at" TIMESTAMP(3);
