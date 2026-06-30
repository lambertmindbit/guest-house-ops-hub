/* redesign/data.js — seed mirroring the real app screenshots (Mon 1 Jun 2026). */
window.DATA = (function () {
  const CH = {
    Direct: "direct", WhatsApp: "whatsapp", "Booking.com": "booking", Agoda: "agoda", MakeMyTrip: "makemytrip",
  };
  const rooms = [
    { id: "101", label: "101", type: "Standard Double" },
    { id: "102", label: "102", type: "Standard Double" },
    { id: "103", label: "103", type: "Standard Double" },
    { id: "201", label: "201", type: "Deluxe" },
    { id: "202", label: "202", type: "Deluxe" },
    { id: "301", label: "301", type: "Family Suite" },
  ];
  const checkins = [
    { id: "r-tara", name: "Tara Joshi", room: "103", type: "Standard Double", channel: "WhatsApp", time: "13:00" },
    { id: "r-priya", name: "Priya Nair", room: "102", type: "Standard Double", channel: "WhatsApp", time: "14:00" },
    { id: "r-rohan", name: "Rohan Gupta", room: "301", type: "Family Suite", channel: "Direct", time: "16:30" },
  ];
  const checkouts = [
    { id: "r-ravi", name: "Ravi Kumar", room: "103", type: "Standard Double", channel: "MakeMyTrip" },
    { id: "r-sneha", name: "Sneha Reddy", room: "202", type: "Deluxe", channel: "Direct" },
  ];
  const inhouse = [
    { id: "r-asha", name: "Asha Menon", room: "101", type: "Standard Double", channel: "Booking.com" },
    { id: "r-vikram", name: "Vikram Singh", room: "201", type: "Deluxe", channel: "Agoda" },
    { id: "r-priya", name: "Priya Nair", room: "102", type: "Standard Double", channel: "WhatsApp" },
    { id: "r-rohan", name: "Rohan Gupta", room: "301", type: "Family Suite", channel: "Direct" },
    { id: "r-tara", name: "Tara Joshi", room: "103", type: "Standard Double", channel: "WhatsApp" },
  ];
  const upcoming = [
    { id: "r-karan", name: "Karan Shah", room: "202", type: "Deluxe", channel: "Booking.com", date: "2 Jun" },
    { id: "r-meera", name: "Meera Iyer", room: "103", type: "Standard Double", channel: "Agoda", date: "3 Jun", time: "12:00" },
    { id: "r-divya", name: "Divya Rao", room: "101", type: "Standard Double", channel: "Direct", date: "4 Jun" },
    { id: "r-arjun", name: "Arjun Patel", room: "301", type: "Family Suite", channel: "MakeMyTrip", date: "6 Jun" },
  ];
  const toClean = [
    { room: "103", type: "Standard Double", priority: true, note: "Checked out 1 Jun", tags: ["arriving", "occupied"] },
    { room: "202", type: "Deluxe", priority: false, note: "Checked out 1 Jun", tags: [] },
  ];

  // 7-day grid: per room, per day index 0..6 (1 Jun..7 Jun)
  // state: vacant | occ | blocked | conflict ; arr/dep edges; guest+channel
  const days = ["1", "2", "3", "4", "5", "6", "7"];
  const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const grid = {
    "201": [
      { s: "occ", g: "Vikram", ch: "Agoda", dep: true }, { s: "vacant" }, { s: "vacant" }, { s: "vacant" },
      { s: "vacant" }, { s: "occ", g: "Karan", ch: "Booking.com", arr: true }, { s: "occ", g: "Karan", ch: "Booking.com" },
    ],
    "202": [
      { s: "vacant" }, { s: "occ", g: "Karan", ch: "Booking.com", arr: true }, { s: "occ", g: "Karan", ch: "Booking.com" },
      { s: "occ", g: "Karan", ch: "Booking.com", dep: true }, { s: "vacant" }, { s: "vacant" }, { s: "vacant" },
    ],
    "301": [
      { s: "occ", g: "Rohan", ch: "Direct", arr: true }, { s: "occ", g: "Rohan", ch: "Direct" }, { s: "occ", g: "Rohan", ch: "Direct" },
      { s: "occ", g: "Rohan", ch: "Direct", dep: true }, { s: "vacant" }, { s: "occ", g: "Arjun", ch: "MakeMyTrip", arr: true }, { s: "occ", g: "Arjun", ch: "MakeMyTrip" },
    ],
    "101": [
      { s: "occ", g: "Asha", ch: "Booking.com" }, { s: "occ", g: "Asha", ch: "Booking.com", dep: true }, { s: "vacant" },
      { s: "occ", g: "Divya", ch: "Direct", arr: true }, { s: "occ", g: "Divya", ch: "Direct" }, { s: "occ", g: "Divya", ch: "Direct", dep: true }, { s: "vacant" },
    ],
    "102": [
      { s: "occ", g: "Priya", ch: "WhatsApp", arr: true }, { s: "conflict", g: "Conflict" }, { s: "occ", g: "Priya", ch: "WhatsApp" },
      { s: "occ", g: "Priya", ch: "WhatsApp", dep: true }, { s: "vacant" }, { s: "vacant" }, { s: "vacant" },
    ],
    "103": [
      { s: "occ", g: "Tara", ch: "WhatsApp", arr: true }, { s: "occ", g: "Tara", ch: "WhatsApp", dep: true }, { s: "occ", g: "Meera", ch: "Agoda", arr: true },
      { s: "occ", g: "Meera", ch: "Agoda", dep: true }, { s: "vacant" }, { s: "vacant" }, { s: "vacant" },
    ],
  };

  const conflict = {
    room: "102", overlap: "Tue 2 Jun → Wed 3 Jun",
    booking: "Priya Nair (Mon 1 Jun → Thu 4 Jun)", block: "Plumbing repair", source: "manual",
  };

  // one reservation detail (Rohan)
  const reservation = {
    id: "r-rohan", name: "Rohan Gupta", phone: "+91 98220 41100", channel: "Direct", status: "Confirmed",
    room: "301", type: "Family Suite", checkin: "1 Jun", checkout: "4 Jun", nights: 3, arrival: "16:30",
    amount: 30000, collected: 20000, requests: "Extra bed for child; late checkout if possible.",
    payments: [{ amt: 12000, mode: "UPI", date: "28 May" }, { amt: 8000, mode: "Cash", date: "1 Jun" }],
  };

  const finance = {
    gross: 74500, commission: 5400, net: 69100, outstanding: 37000,
    byChannel: [
      { ch: "Direct", bookings: 2, gross: 27500, commission: 0, net: 27500 },
      { ch: "WhatsApp", bookings: 2, gross: 15500, commission: 0, net: 15500 },
      { ch: "MakeMyTrip", bookings: 1, gross: 12000, commission: 2160, net: 9840 },
      { ch: "Agoda", bookings: 1, gross: 10500, commission: 1890, net: 8610 },
      { ch: "Booking.com", bookings: 1, gross: 9000, commission: 1350, net: 7650 },
    ],
    balances: [
      { name: "Rohan Gupta", room: "301", due: 10000 }, { name: "Meera Iyer", room: "103", due: 10500 },
      { name: "Divya Rao", room: "101", due: 4500 }, { name: "Arjun Patel", room: "301", due: 12000 },
    ],
  };

  const channels = [
    { name: "Direct", commission: 0, collects: false, bookings: 2 },
    { name: "WhatsApp", commission: 0, collects: false, bookings: 2 },
    { name: "Booking.com", commission: 15, collects: true, bookings: 1 },
    { name: "Agoda", commission: 18, collects: true, bookings: 1 },
    { name: "MakeMyTrip", commission: 18, collects: false, bookings: 1 },
  ];

  const property = {
    name: "Pinewood Guest House", address: "Laitumkhrah, Shillong, Meghalaya 793003",
    gst: "17ABCDE1234F1Z5", currency: "INR (₹)", timezone: "Asia/Kolkata",
    checkIn: "14:00", checkOut: "11:00",
  };
  const roomTypes = [
    { id: "std", name: "Standard Double", base: 2500, sleeps: 2, floor: 1800, ceiling: 4000, rooms: 3 },
    { id: "dlx", name: "Deluxe", base: 3500, sleeps: 2, floor: 2800, ceiling: 5500, rooms: 2 },
    { id: "fam", name: "Family Suite", base: 5000, sleeps: 4, floor: 4000, ceiling: 8000, rooms: 1 },
  ];
  const roomList = [
    { label: "101", type: "Standard Double", archived: false },
    { label: "102", type: "Standard Double", archived: false },
    { label: "103", type: "Standard Double", archived: false },
    { label: "201", type: "Deluxe", archived: false },
    { label: "202", type: "Deluxe", archived: false },
    { label: "301", type: "Family Suite", archived: false },
  ];
  const pricing = {
    enabled: true, weekendDays: [5, 6], weekendPct: 20,
    leadEarlyDays: 30, leadEarlyPct: -10, leadLateDays: 3, leadLatePct: 15,
    occThreshold: 80, occPct: 15,
  };
  const seasons = [
    { name: "Diwali week", from: "20 Oct", to: "27 Oct", pct: 40 },
    { name: "Christmas – New Year", from: "22 Dec", to: "2 Jan", pct: 50 },
    { name: "Monsoon lull", from: "1 Jul", to: "31 Aug", pct: -15 },
  ];
  const blocks = [
    { room: "102", from: "2 Jun", to: "3 Jun", reason: "Plumbing repair" },
  ];

  // ROOT-agent staged items — what "Needs you" and "Review" surface.
  const escalations = [
    { id: "e1", title: "Approve cancellation — Asha Menon (101)", cat: "Cancellation",
      severity: "high", from: "Booking assistant", note: "Guest requested cancel + refund of ₹4,000 advance.", resId: "r-asha" },
  ];
  const messages = [
    { id: "m1", to: "Rohan Gupta", channel: "WhatsApp", when: "Today 09:12", status: "Logged",
      body: "Hi Rohan, your room 301 is confirmed for 1–4 Jun. Reach out anytime." },
    { id: "m2", to: "Priya Nair", channel: "WhatsApp", when: "Yesterday", status: "Logged",
      body: "Looking forward to hosting you on the 30th. Check-in from 14:00." },
    { id: "m3", to: "Meera Iyer", channel: "SMS", when: "28 Jun", status: "Logged",
      body: "Balance ₹10,500 due at check-in. See you soon!" },
  ];
  const inbox = [
    { id: "i1", channel: "Booking.com", guest: "Karan Shah", dates: "2–4 Jun", room: "Deluxe", ref: "BDC-91183" },
    { id: "i2", channel: "Agoda", guest: "Meera Iyer", dates: "3–4 Jun", room: "Standard Double", ref: "AGD-55012" },
  ];
  // Flat bookings list for the searchable Bookings screen.
  const bookings = [
    ...checkins.map((r) => ({ ...r, when: "Today", status: "Arrives" })),
    ...inhouse.filter((r) => !checkins.find((c) => c.id === r.id)).map((r) => ({ ...r, when: "In-house", status: "Staying" })),
    ...upcoming.map((r) => ({ ...r, when: r.date, status: "Upcoming" })),
    ...checkouts.map((r) => ({ ...r, when: "Today", status: "Departs" })),
  ];

  const analytics = {
    occupancy: 68, occDelta: 6, adr: 3450, adrDelta: -2, revpar: 2346, revenue: 142000,
    range: "Last 30 days",
    trend: [55, 60, 48, 52, 71, 83, 77, 64, 58, 62, 70, 85, 80, 68],
    sourceMix: [
      { ch: "Direct", pct: 34 }, { ch: "Booking.com", pct: 24 }, { ch: "WhatsApp", pct: 18 },
      { ch: "Agoda", pct: 14 }, { ch: "MakeMyTrip", pct: 10 },
    ],
    topTypes: [
      { name: "Deluxe", occ: 82 }, { name: "Standard Double", occ: 64 }, { name: "Family Suite", occ: 51 },
    ],
  };

  const flaggedNumbers = [
    { phone: "+91 99999 00001", reason: "Repeated chargebacks via Booking.com", added: "12 May" },
    { phone: "+91 90000 12345", reason: "No-show, abusive on arrival", added: "3 Apr" },
  ];
  const guestList = [
    { id: "r-tara", name: "Tara Joshi", phone: "+91 70219 88410", channel: "WhatsApp", visits: 5 },
    { id: "r-rohan", name: "Rohan Gupta", phone: "+91 98220 41100", channel: "Direct", visits: 3, balance: 10000 },
    { id: "r-asha", name: "Asha Menon", phone: "+91 99580 22117", channel: "Booking.com", visits: 1 },
    { id: "r-vikram", name: "Vikram Singh", phone: "+91 90071 55243", channel: "Agoda", visits: 2 },
    { id: "r-meera", name: "Meera Iyer", phone: "+44 7700 900812", channel: "Agoda", visits: 1, foreign: true, balance: 10500 },
    { id: "r-priya", name: "Priya Nair", phone: "+91 98451 77329", channel: "WhatsApp", visits: 2 },
    { id: "r-karan", name: "Karan Shah", phone: "+91 99999 00001", channel: "Booking.com", visits: 1, blocked: true, blockReason: "On scam / flagged list" },
  ];

  return {
    CH, rooms, checkins, checkouts, inhouse, upcoming, toClean, grid, days, dows, conflict, reservation, finance, channels,
    property, roomTypes, roomList, pricing, seasons, blocks, escalations, messages, inbox, bookings, analytics, guestList, flaggedNumbers,
    kpis: { occupancy: 83, occRooms: "5 / 6 rooms", inhouse: 5, checkins: 3, checkouts: 2 },
    money: (n) => "₹" + n.toLocaleString("en-IN"),
  };
})();
