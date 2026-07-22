// English UI strings (GAP-16/US-801). This is the source-of-truth pack: keys map to
// the EXACT strings the app rendered before i18n, so with the default locale the
// output is byte-identical. Other packs (kha.ts) fall back to these keys, so a
// missing translation shows English rather than a blank or a raw key.
//
// Keys are dotted namespaces. Interpolate with {name}-style placeholders.
export const en: Record<string, string> = {
  // Navigation (labels mirror NavShell META exactly).
  "nav.today": "Today",
  "nav.calendar": "Calendar",
  "nav.bookings": "Bookings",
  "nav.groups": "Groups",
  "nav.guests": "Guests",
  "nav.housekeeping": "Housekeeping",
  "nav.complaints": "Complaints",
  "nav.staff": "Staff",
  "nav.maintenance": "Maintenance",
  "nav.inventory": "Inventory",
  "nav.vendors": "Vendors",
  "nav.transport": "Transport",
  "nav.tours": "Tours",
  "nav.partners": "Partners",
  "nav.referrals": "Referrals",
  "nav.assistant": "Owner console",
  "nav.needsyou": "Needs you",
  "nav.finance": "Finance",
  "nav.pricing": "Pricing",
  "nav.analytics": "Analytics",
  "nav.inbox": "Inbox",
  "nav.messages": "Messages",
  "nav.escalations": "Escalations",
  "nav.reviews": "Reviews",
  "nav.settings": "Property setup",
  "nav.help": "Help",
  // Toolbar titles for deep-link routes without a standing nav entry.
  "nav.newBooking": "New booking",
  "nav.reservation": "Reservation",
  "nav.more": "More",

  // Dashboard (Today).
  "dashboard.today": "Today",
  "dashboard.welcome": "Welcome",
  "dashboard.occupancy": "Occupancy",
  "dashboard.arrivals": "Arrivals",
  "dashboard.departures": "Departures",
  "dashboard.roomsOf": "{occupied} of {total} rooms",
  "dashboard.notSetUp": "Your guest house isn’t set up yet. A few quick steps and you can take your first booking.",
  "dashboard.startSetup": "Start setup",

  // Onboarding wizard.
  "onboarding.title": "Set up your guest house",
  "onboarding.subtitle": "A few steps to your first booking",
  "onboarding.ready": "You’re ready to take bookings.",
  "onboarding.readyHint": "Open the calendar to make your first one — or add staff below to track housekeeping.",
  "onboarding.stepsToGo": "{n} step(s) to go.",
  "onboarding.stepsToGoHint": "Finish the required steps below and you can start booking guests.",
  "onboarding.goToCalendar": "Go to the calendar",
  "onboarding.optional": "optional",
  "onboarding.step.property": "Property details",
  "onboarding.step.property.hint": "Name your guest house (address & GSTIN optional).",
  "onboarding.step.roomTypes": "Room types",
  "onboarding.step.roomTypes.hint": "Add at least one room type with its base rate.",
  "onboarding.step.rooms": "Rooms",
  "onboarding.step.rooms.hint": "Add the physical rooms guests can be booked into.",
  "onboarding.step.channels": "Booking channels",
  "onboarding.step.channels.hint": "Direct, WhatsApp and the OTAs. Seeded by default.",
  "onboarding.step.staff": "Staff",
  "onboarding.step.staff.hint": "Add staff to assign housekeeping and track attendance.",

  // Common actions & vocabulary (adopt these across forms incrementally).
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.cancel": "Cancel",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.back": "Back",
  "common.confirm": "Confirm",
  "common.close": "Close",

  // Settings — language.
  "settings.language": "Language",
  "settings.language.sub": "Choose the language for the app on this device.",
  "settings.language.en": "English",
  "settings.language.kha": "Khasi",
  "settings.language.khaComingSoon": "Khasi is being translated — untranslated screens stay in English for now.",
};
