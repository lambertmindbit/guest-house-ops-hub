"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RoomOption = { id: string; label: string; roomTypeName: string };
export type ChannelOption = { id: string; name: string };

export type ReservationFormValues = {
  id?: string;
  roomId: string;
  channelId: string;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  specialRequests: string;
  grossAmount: string;
  guestName: string;
  guestPhone: string;
};

type Props = {
  mode: "create" | "edit";
  rooms: RoomOption[];
  channels: ChannelOption[];
  initial: ReservationFormValues;
};

export function ReservationForm({ mode, rooms, channels, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ReservationFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const amount = values.grossAmount.trim();
      const common = {
        roomId: values.roomId,
        channelId: values.channelId,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        arrivalTime: values.arrivalTime || undefined,
        specialRequests: values.specialRequests || undefined,
        grossAmount: amount ? Number(amount) : undefined,
      };

      const res =
        mode === "create"
          ? await fetch("/api/reservations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                ...common,
                guest: { name: values.guestName, phone: values.guestPhone },
              }),
            })
          : await fetch(`/api/reservations/${values.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(common),
            });

      const json = await res.json();
      if (!res.ok) {
        // 409 overlap and 422 validation both arrive as a friendly { error }.
        setError(json.error ?? "Something went wrong.");
        return;
      }
      const id = mode === "create" ? json.data.id : values.id;
      router.push(`/reservations/${id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {mode === "create" ? (
        <>
          <Field label="Guest name">
            <input
              required
              className={inputClass}
              value={values.guestName}
              onChange={(e) => set("guestName", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              required
              className={inputClass}
              value={values.guestPhone}
              onChange={(e) => set("guestPhone", e.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field label="Guest">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            {values.guestName} · {values.guestPhone}
          </div>
        </Field>
      )}

      <Field label="Channel">
        <select
          required
          className={inputClass}
          value={values.channelId}
          onChange={(e) => set("channelId", e.target.value)}
        >
          <option value="">Select…</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Room">
        <select
          required
          className={inputClass}
          value={values.roomId}
          onChange={(e) => set("roomId", e.target.value)}
        >
          <option value="">Select…</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} · {r.roomTypeName}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          <input
            required
            type="date"
            className={inputClass}
            value={values.checkIn}
            onChange={(e) => set("checkIn", e.target.value)}
          />
        </Field>
        <Field label="Check-out">
          <input
            required
            type="date"
            className={inputClass}
            value={values.checkOut}
            onChange={(e) => set("checkOut", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Arrival time">
          <input
            type="time"
            className={inputClass}
            value={values.arrivalTime}
            onChange={(e) => set("arrivalTime", e.target.value)}
          />
        </Field>
        <Field label="Amount (₹)">
          <input
            type="number"
            min="0"
            step="1"
            className={inputClass}
            value={values.grossAmount}
            onChange={(e) => set("grossAmount", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Special requests">
        <textarea
          rows={2}
          className={inputClass}
          value={values.specialRequests}
          onChange={(e) => set("specialRequests", e.target.value)}
        />
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : mode === "create" ? "Create reservation" : "Save changes"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
