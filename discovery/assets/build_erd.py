#!/usr/bin/env python3
"""Generate the Ops Hub ER Diagram (IDM-style clustered SVG inside branded HTML).
Entities extracted from prisma/schema.prisma (55 models). Version-controllable source."""
import pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (panel title, tint, [ (Entity, [fields], hero?) ])  — fields: "PK/FK/•" prefixed
PANELS_ROWS = [
 [ # row 1
  ("IDENTITY & TENANCY", "#eef2f7", 330, [
    ("PropertySettings", ["PK id — property root","• name · address · GSTIN","• checkIn/Out · UPI id","• idRules · idRetentionDays"], True),
    ("User", ["PK id","• email · scrypt hash","• role: owner/reception/hk"], False),
    ("UserProperty", ["FK userId","FK propertyId — access grant"], False),
  ]),
  ("SELLABLE SPACE", "#e9f5f1", 330, [
    ("RoomType", ["PK id","• baseRate · maxOccupancy","• rateFloor · rateCeiling"], True),
    ("Room", ["PK id","FK roomTypeId","• label · archivedAt"], True),
    ("Amenity", ["• name"], False),
    ("RoomTypeAmenity", ["FK roomTypeId · FK amenityId"], False),
  ]),
  ("PRICING (ADVISORY)", "#f3f0fa", 320, [
    ("PricingPolicy", ["• weekend · leadTime","• occupancy adjustments"], False),
    ("Season", ["• dateRange · adjustment"], False),
    ("RateOverride", ["FK roomTypeId","• date · pinned rate"], False),
  ]),
  ("SYNC · TRUST · AUDIT", "#fbf3e8", 380, [
    ("IcalFeed", ["FK roomId","• url · direction","• lastSyncAt"], False),
    ("FlaggedNumber", ["• phone · reason (scam list)"], False),
    ("AuditEvent", ["• actor · action · at"], False),
  ]),
 ],
 [ # row 2 — hero
  ("BOOKING CORE — the correctness core", "#e7f5f1", 720, [
    ("Reservation", ["PK id","FK roomId · guestId · channelId","FK agentId? · groupId?","★ stay DATERANGE [in,out)","★ GiST: no overlapping confirmed","• status: confirmed/cancelled/no-show","• checkedInAt · checkedOutAt","• otaRef · grossAmount · advanceRequired"], True),
    ("Guest", ["PK id — owner-wide (shared)","• phone UNIQUE · blacklisted","• ID flags · consent","★ C-Form ×13 (foreign)","• address · vehicle · prefs"], True),
    ("Channel", ["PK id","• commissionPct","• collectsPayment"], False),
    ("Agent", ["PK id — B2B travel agent","• phone · commissionPct · verified"], False),
    ("Block", ["FK roomId","★ period DATERANGE","• source: manual/iCal · reason"], True),
    ("BookingGroup", ["PK id — folio"], False),
    ("InboundBooking", ["• parsed OTA email","• otaRef · status: pending"], False),
  ]),
  ("MONEY", "#fdf0ee", 340, [
    ("Payment", ["FK reservationId","• amount · mode (5)","• isAdvance · UTR ref"], True),
    ("Refund", ["FK reservationId","• amount · status"], False),
    ("CancellationPolicy", ["• ladder: days→refund %"], False),
    ("Expense", ["• amount · date · note"], False),
  ]),
  ("AI & COMMUNICATIONS", "#eef7fb", 360, [
    ("Escalation", ["• source · category · severity","• status (HITL queue)","FK reservationId?"], True),
    ("OutboundMessage", ["• channel · status · text","FK reservationId?"], False),
    ("ConversationTurn", ["• role · text · diagnostics"], False),
    ("FaqEntry", ["• q/a · media"], False),
    ("AssistantPolicy", ["• owner runtime rules"], False),
    ("PushSubscription", ["• endpoint · keys"], False),
  ]),
 ],
 [ # row 3
  ("OPERATIONS & FACILITIES", "#f1f6ee", 560, [
    ("HousekeepingTask", ["FK roomId · staffId?","• status · checklist"], True),
    ("MaintenanceRequest", ["• priority · status · cost","FK assetId?"], False),
    ("Asset", ["• serviceEveryDays","• lastServicedAt"], False),
    ("InventoryItem", ["• unit · lowStockLevel"], False),
    ("StockMovement", ["FK itemId · qty ±"], False),
    ("Vendor", ["• rating"], False),
    ("PurchaseOrder", ["FK vendorId","• status: draft/ordered/received"], False),
    ("VendorPayment", ["FK purchaseOrderId · amount"], False),
  ]),
  ("PEOPLE OPS", "#f7f2ec", 280, [
    ("Staff", ["• name · role · phone · active"], True),
    ("Shift", ["FK staffId · date · start/end"], False),
    ("Attendance", ["FK staffId · date · status"], False),
  ]),
  ("GUEST EXPERIENCE", "#f2f0f7", 580, [
    ("Complaint", ["• category · priority · status"], False),
    ("ReviewRequest", ["FK reservationId · status"], False),
    ("TourPartner", ["• commissionPct"], False),
    ("Tour", ["FK partnerId"], False),
    ("TourBooking", ["FK tourId · guestId"], False),
    ("Driver", ["• name · phone"], False),
    ("Trip", ["FK driverId","• pickup · fare · status"], False),
  ]),
 ],
 [ # row 4
  ("COMMUNITY NETWORK — opt-in · grant-gated · no PII/occupancy/finance across the seam", "#eef4f1", 1440, [
    ("NetworkConnection", ["• peer connect code · status"], True),
    ("SharingGrant", ["FK connectionId","• shareType: rooms/referrals/…"], True),
    ("Referral", ["• peer · status · revenue"], True),
    ("ReferralCreditEntry", ["FK referralId · delta (derived)"], False),
    ("SharedScamReport", ["★ hashedPhone · evidence","• status · expiresAt"], True),
    ("SharedGuestAlert", ["• category · status · expiresAt"], False),
    ("Partner", ["• external partner"], False),
    ("OutboundReferral", ["FK partnerId"], False),
  ]),
 ],
]

EDGES = [  # (from, to, label, dashed)
 ("RoomType","Room","1 ⟶ *",0), ("Room","Reservation","1 ⟶ * · GiST",0),
 ("Room","Block","1 ⟶ *",0), ("Room","IcalFeed","1 ⟶ *",0), ("Room","HousekeepingTask","1 ⟶ *",0),
 ("Guest","Reservation","1 ⟶ *",0), ("Channel","Reservation","1 ⟶ *",0),
 ("Agent","Reservation","0..1",1), ("BookingGroup","Reservation","0..1 folio",1),
 ("InboundBooking","Reservation","creates 0..1",1),
 ("Reservation","Payment","1 ⟶ *",0), ("Reservation","Refund","0 ⟶ *",0),
 ("CancellationPolicy","Refund","suggests",1), ("RoomType","RateOverride","1 ⟶ *",0),
 ("User","UserProperty","1 ⟶ *",0), ("UserProperty","PropertySettings","* ⟶ 1",0),
 ("Staff","HousekeepingTask","assigned",1), ("Staff","Shift","1 ⟶ *",0), ("Staff","Attendance","1 ⟶ *",0),
 ("Vendor","PurchaseOrder","1 ⟶ *",0), ("PurchaseOrder","VendorPayment","1 ⟶ *",0),
 ("InventoryItem","StockMovement","1 ⟶ *",0),
 ("TourPartner","Tour","1 ⟶ *",0), ("Tour","TourBooking","1 ⟶ *",0),
 ("Driver","Trip","1 ⟶ *",0), ("Reservation","ReviewRequest","0 ⟶ *",1),
 ("Reservation","Escalation","0 ⟶ *",1), ("Reservation","OutboundMessage","0 ⟶ *",1),
 ("Guest","ConversationTurn","0 ⟶ *",1), ("Guest","Complaint","0 ⟶ *",1),
 ("NetworkConnection","SharingGrant","1 ⟶ *",0), ("Referral","ReferralCreditEntry","1 ⟶ *",0),
 ("Partner","OutboundReferral","1 ⟶ *",0),
]

# ---- layout ----
BOX_W, PAD, GAPX, GAPY, ROWGAP, PANEL_HEAD = 205, 16, 14, 12, 46, 30
def box_h(fields): return 24 + 14*len(fields) + 8

positions, panels_out = {}, []
y_cursor = 128
for row in PANELS_ROWS:
    row_h = 0
    x_cursor = 30
    row_panels = []
    for title, tint, pw, ents in row:
        # flow boxes inside panel
        bx, by, line_h = PAD, PANEL_HEAD, 0
        placed = []
        for name, fields, hero in ents:
            w = BOX_W if not hero else BOX_W + 20
            h = box_h(fields)
            if bx + w > pw - PAD:
                bx = PAD; by += line_h + GAPY; line_h = 0
            placed.append((name, fields, hero, bx, by, w, h))
            bx += w + GAPX; line_h = max(line_h, h)
        ph = by + line_h + PAD
        row_panels.append((title, tint, x_cursor, pw, ph, placed))
        row_h = max(row_h, ph)
        x_cursor += pw + 26
    for title, tint, px, pw, ph, placed in row_panels:
        panels_out.append((title, tint, px, y_cursor, pw, row_h))
        for name, fields, hero, bx, by, w, h in placed:
            positions[name] = (px+bx, y_cursor+by, w, h, fields, hero)
    y_cursor += row_h + ROWGAP
CANVAS_W, CANVAS_H = 1500, y_cursor + 30

def esc(s): return html.escape(s, quote=False)

svg = [f'<svg viewBox="0 0 {CANVAS_W} {CANVAS_H}" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, Inter, sans-serif">']
svg.append('''<defs>
<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0 0 L10 5 L0 10 z" fill="#1c4356"/></marker>
<marker id="arrd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0 0 L10 5 L0 10 z" fill="#8aa39b"/></marker>
</defs>''')
svg.append(f'<rect width="{CANVAS_W}" height="{CANVAS_H}" fill="#fbfdfc"/>')
svg.append(f'<text x="30" y="44" font-size="21" font-weight="800" fill="#12303f">Guest House Ops Hub — Entity Relationship Diagram v1.0</text>')
svg.append(f'<text x="30" y="66" font-size="12.5" fill="#5b6b64">All 55 Prisma models · extracted from prisma/schema.prisma · ★ = correctness/legal-critical field · dashed = optional/derived link · derived values (availability, balance, advance, commission, credit) are computed, never stored</text>')
# legend
lg = [("#12303f","core entity (bold header)"),("#4c6b7d","supporting entity"),("#8aa39b","dashed = optional / derived")]
lx = 30
for c,t in lg:
    svg.append(f'<rect x="{lx}" y="82" width="12" height="12" rx="3" fill="{c}"/><text x="{lx+18}" y="93" font-size="12" fill="#374d44">{t}</text>')
    lx += 18 + 8*len(t) + 26

# panels
for title, tint, px, py, pw, ph in panels_out:
    svg.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="12" fill="{tint}" stroke="#dbe4e0"/>')
    svg.append(f'<text x="{px+14}" y="{py+20}" font-size="12.5" font-weight="800" letter-spacing="1.5" fill="#26504a">{esc(title)}</text>')

# edges under boxes? draw edges first would hide under panels; draw now (over panels, under boxes)
def anchor(a, b):
    ax, ay, aw, ah, *_ = positions[a]; bx, by, bw, bh, *_ = positions[b]
    acx, acy = ax+aw/2, ay+ah/2; bcx, bcy = bx+bw/2, by+bh/2
    if abs(acx-bcx) > abs(acy-bcy):
        p1 = (ax+aw, acy) if bcx > acx else (ax, acy)
        p2 = (bx, bcy) if bcx > acx else (bx+bw, bcy)
    else:
        p1 = (acx, ay+ah) if bcy > acy else (acx, ay)
        p2 = (bcx, by) if bcy > acy else (bcx, by+bh)
    return p1, p2

for a, b, lbl, dashed in EDGES:
    if a not in positions or b not in positions: continue
    (x1,y1),(x2,y2) = anchor(a,b)
    mx, my = (x1+x2)/2, (y1+y2)/2
    stroke = "#8aa39b" if dashed else "#1c4356"
    dash = ' stroke-dasharray="5 4"' if dashed else ""
    marker = "arrd" if dashed else "arr"
    c = 0.35
    cx1, cy1 = x1+(x2-x1)*c, y1; cx2, cy2 = x2-(x2-x1)*c, y2
    svg.append(f'<path d="M{x1:.0f} {y1:.0f} C{cx1:.0f} {cy1:.0f} {cx2:.0f} {cy2:.0f} {x2:.0f} {y2:.0f}" fill="none" stroke="{stroke}" stroke-width="1.4"{dash} marker-end="url(#{marker})" opacity="0.85"/>')
    svg.append(f'<rect x="{mx-30:.0f}" y="{my-9:.0f}" width="60" height="14" rx="7" fill="#ffffff" opacity="0.85"/>')
    svg.append(f'<text x="{mx:.0f}" y="{my+2:.0f}" font-size="9.5" fill="#3f5a52" text-anchor="middle">{esc(lbl)}</text>')

# boxes
for name,(x,y,w,h,fields,hero) in positions.items():
    head = "#12303f" if hero else "#4c6b7d"
    svg.append(f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="#ffffff" stroke="#c8d4cf" stroke-width="1.1"/>')
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="22" rx="7" fill="{head}"/>')
    svg.append(f'<rect x="{x}" y="{y+14}" width="{w}" height="8" fill="{head}"/>')
    svg.append(f'<text x="{x+9}" y="{y+15.5}" font-size="12" font-weight="800" fill="#ffffff">{esc(name)}</text>')
    fy = y + 36
    for f in fields:
        color = "#0b7d6b" if f.startswith("PK") else "#8a5a0a" if f.startswith("FK") else "#b3362b" if f.startswith("★") else "#41544c"
        weight = ' font-weight="700"' if f.startswith(("PK","★")) else ""
        svg.append(f'<text x="{x+9}" y="{fy}" font-size="10.5" fill="{color}"{weight}>{esc(f)}</text>')
        fy += 14
    svg.append('</g>')
svg.append('</svg>')

SHELL = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ER Diagram v1.0 · Guest House Ops Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/doc.css">
<style>.erdwrap{{padding:18px}} .erdwrap svg{{width:100%;height:auto;border:1px solid var(--line);border-radius:12px;background:#fbfdfc}}</style>
</head><body>
<div class="page" style="max-width:1560px">
<div class="confbar"><span>MindBit Solutions LLP · ROOT Platform</span><span>Confidential — for the build team</span></div>
<div class="banner">
  <p class="kicker">Guest House Operations Hub · Discovery Package · Doc 12-A</p>
  <h1>ER Diagram v1.0 — Complete Data Model</h1>
  <p class="sub">Every entity from prisma/schema.prisma in one clustered diagram. Use with Doc 12 (entity catalogue, constraints, retention) as the basis for schema review and estimation.</p>
  <div class="chips"><span class="chip">55 entities</span><span class="chip">12 domain clusters</span><span class="chip">GiST no-double-booking core</span><span class="chip">propertyId tenancy on 55 fields</span><span class="chip">Companion to Doc 12</span></div>
</div>
<div class="erdwrap">{''.join(svg)}</div>
<div class="content" style="padding-top:6px">
<blockquote><strong>Reading notes.</strong> The tenancy root (<code>PropertySettings</code>) scopes every cluster via <code>propertyId</code> (auto-scoping Prisma extension) — those 55 edges are omitted for legibility. <code>Guest</code> is the deliberate exception: shared owner-wide. Availability, balance due, advance status, commissions owed and referral credit are <em>derived at read time — never stored</em> (hard rule C-03). The single most important constraint: <code>no_overlapping_confirmed_stays</code> — GiST exclusion on <code>Reservation(room_id, stay)</code> where status = confirmed.</blockquote>
</div>
<div class="docfooter"><span>© 2026 MindBit Solutions LLP · Shillong, Meghalaya</span><span>assets/build_erd.py is the version-controlled source</span></div>
</div></body></html>"""

(ROOT/"12-er-diagram.html").write_text(SHELL, encoding="utf-8")
(ROOT/"assets/erd.svg").write_text(''.join(svg), encoding="utf-8")
print("OK er-diagram", CANVAS_W, "x", CANVAS_H, "| entities:", len(positions))
