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

  return {
    CH, rooms, checkins, checkouts, inhouse, upcoming, toClean, grid, days, dows, conflict, reservation, finance, channels,
    property, roomTypes, roomList, pricing, seasons, blocks,
    kpis: { occupancy: 83, occRooms: "5 / 6 rooms", inhouse: 5, checkins: 3, checkouts: 2 },
    money: (n) => "₹" + n.toLocaleString("en-IN"),
  };
})();
