import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "password123";

const seedUsers = [
  { name: "Bhumi Kasangottuwar", email: "organiser@eventops.com", role: "organiser" as const, volunteerSubRole: null },
  { name: "Ashish Makhija", email: "volunteer@eventops.com", role: "volunteer" as const, volunteerSubRole: "team_lead" as const },
  { name: "Sam Patel", email: "attendee@eventops.com", role: "participant" as const, volunteerSubRole: null },
  { name: "Priya Shah", email: "lead.north@eventops.com", role: "volunteer" as const, volunteerSubRole: "team_lead" as const },
  { name: "Rohan Mehta", email: "lead.south@eventops.com", role: "volunteer" as const, volunteerSubRole: "team_lead" as const },
  { name: "Aarti Nair", email: "lead.firstaid@eventops.com", role: "volunteer" as const, volunteerSubRole: "team_lead" as const },
  { name: "Vikram Rao", email: "lead.parking@eventops.com", role: "volunteer" as const, volunteerSubRole: "team_lead" as const },
  { name: "Neha Joshi", email: "vol1@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Arjun Desai", email: "vol2@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Kavya Iyer", email: "vol3@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Rahul Verma", email: "vol4@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Ishaan Kapoor", email: "vol5@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Meera Krishnan", email: "vol6@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Dev Agarwal", email: "vol7@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
  { name: "Riya Chatterjee", email: "vol8@eventops.com", role: "volunteer" as const, volunteerSubRole: "normal" as const },
];

const CENTER = { lat: 18.9958, lng: 72.8375 };
const offset = (dLat: number, dLng: number) => ({ lat: CENTER.lat + dLat, lng: CENTER.lng + dLng });

async function main() {
  // USERS
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const users: Record<string, number> = {};
  for (const u of seedUsers) {
    const r = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, volunteerSubRole: u.volunteerSubRole },
      create: { name: u.name, email: u.email, passwordHash, role: u.role, volunteerSubRole: u.volunteerSubRole },
    });
    users[u.email] = r.id;
  }
  console.log(`✓ seeded ${seedUsers.length} users`);

  // EVENT
  const existingEvent = await prisma.event.findFirst({ where: { name: "Lalbaugcha Raja Darshan" } });
  const event = existingEvent
    ? await prisma.event.update({
      where: { id: existingEvent.id },
      data: {
        venue: "Shree Ganesh Nagar, Lalbaug, Parel, Mumbai",
        centerLat: CENTER.lat,
        centerLng: CENTER.lng,
        createdById: users["organiser@eventops.com"],
        headCoordinatorId: users["organiser@eventops.com"],
      },
    })
    : await prisma.event.create({
      data: {
        name: "Lalbaugcha Raja Darshan",
        venue: "Shree Ganesh Nagar, Lalbaug, Parel, Mumbai",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
        centerLat: CENTER.lat,
        centerLng: CENTER.lng,
        createdById: users["organiser@eventops.com"],
        headCoordinatorId: users["organiser@eventops.com"],
      },
    });
  console.log(`✓ event ${event.id}: ${event.name}`);

  // ZONES
  const makeRect = (c: { lat: number; lng: number }, dLat = 0.0004, dLng = 0.0004) => [
    { lat: c.lat - dLat, lng: c.lng - dLng },
    { lat: c.lat - dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng - dLng },
  ];
  const zoneSpecs = [
    { key: "pandal", name: "Main Pandal", type: "stage" as const, lead: "volunteer@eventops.com", c: offset(0, 0), cap: 2000 },
    { key: "gate_n", name: "North Entry Gate", type: "gate" as const, lead: "lead.north@eventops.com", c: offset(0.0010, 0), cap: 500 },
    { key: "gate_s", name: "South Entry Gate", type: "gate" as const, lead: "lead.south@eventops.com", c: offset(-0.0010, 0), cap: 500 },
    { key: "first_aid", name: "First Aid Camp", type: "first_aid" as const, lead: "lead.firstaid@eventops.com", c: offset(0, 0.0008), cap: 50 },
    { key: "parking", name: "Parking Lot A", type: "parking" as const, lead: "lead.parking@eventops.com", c: offset(0, -0.0012), dLat: 0.0005, dLng: 0.0008, cap: 150 },
    { key: "food", name: "Food Court", type: "food" as const, lead: "lead.south@eventops.com", c: offset(-0.0005, 0.0010), cap: 300 },
  ];
  const zones: Record<string, { id: number; c: { lat: number; lng: number } }> = {};
  for (const z of zoneSpecs) {
    const polygon = makeRect(z.c, z.dLat, z.dLng);
    const existing = await prisma.zone.findFirst({ where: { eventId: event.id, name: z.name } });
    const row = existing
      ? await prisma.zone.update({
        where: { id: existing.id },
        data: { type: z.type, polygon, leadId: users[z.lead], capacity: z.cap },
      })
      : await prisma.zone.create({
        data: { eventId: event.id, name: z.name, type: z.type, polygon, leadId: users[z.lead], capacity: z.cap },
      });
    zones[z.key] = { id: row.id, c: z.c };
  }
  console.log(`✓ seeded ${zoneSpecs.length} zones`);

  // VENUE GRAPH
  const nodeSpecs = [
    { key: "n_pandal", zone: "pandal" as const, p: zones.pandal.c, isExit: false, name: "Pandal centre" },
    { key: "n_gate_n", zone: "gate_n" as const, p: zones.gate_n.c, isExit: false, name: "North gate" },
    { key: "n_gate_s", zone: "gate_s" as const, p: zones.gate_s.c, isExit: false, name: "South gate" },
    { key: "n_first_aid", zone: "first_aid" as const, p: zones.first_aid.c, isExit: false, name: "First aid" },
    { key: "n_parking", zone: "parking" as const, p: zones.parking.c, isExit: false, name: "Parking" },
    { key: "n_food", zone: "food" as const, p: zones.food.c, isExit: false, name: "Food court" },
    { key: "exit_n", zone: null, p: offset(0.0018, 0.0002), isExit: true, name: "Exit · North" },
    { key: "exit_s", zone: null, p: offset(-0.0018, -0.0002), isExit: true, name: "Exit · South" },
    { key: "exit_e", zone: null, p: offset(0.0002, 0.0018), isExit: true, name: "Exit · East" },
  ];
  const nodes: Record<string, number> = {};
  for (const n of nodeSpecs) {
    const existing = await prisma.venueNode.findFirst({ where: { eventId: event.id, name: n.name } });
    const row = existing
      ? await prisma.venueNode.update({
        where: { id: existing.id },
        data: { lat: n.p.lat, lng: n.p.lng, isExit: n.isExit, zoneId: n.zone ? zones[n.zone].id : null },
      })
      : await prisma.venueNode.create({
        data: {
          eventId: event.id, name: n.name, lat: n.p.lat, lng: n.p.lng, isExit: n.isExit,
          zoneId: n.zone ? zones[n.zone].id : null,
        },
      });
    nodes[n.key] = row.id;
  }

  const edgeSpecs: Array<[string, string, number]> = [
    ["n_pandal", "n_gate_n", 110], ["n_pandal", "n_gate_s", 110], ["n_pandal", "n_first_aid", 85],
    ["n_pandal", "n_food", 70], ["n_pandal", "n_parking", 130],
    ["n_gate_n", "exit_n", 90], ["n_gate_s", "exit_s", 90], ["n_food", "exit_e", 85],
    ["n_first_aid", "exit_e", 95], ["n_parking", "exit_s", 90],
    ["n_gate_n", "n_first_aid", 95], ["n_gate_s", "n_parking", 60],
  ];
  await prisma.venueEdge.deleteMany({
    where: {
      OR: edgeSpecs.flatMap(([a, b]) => [
        { fromNode: nodes[a], toNode: nodes[b] },
        { fromNode: nodes[b], toNode: nodes[a] },
      ]),
    },
  });
  for (const [a, b, len] of edgeSpecs) {
    await prisma.venueEdge.create({ data: { fromNode: nodes[a], toNode: nodes[b], lengthM: len, widthM: 3 } });
    await prisma.venueEdge.create({ data: { fromNode: nodes[b], toNode: nodes[a], lengthM: len, widthM: 3 } });
  }
  console.log(`✓ seeded ${nodeSpecs.length} nodes, ${edgeSpecs.length * 2} edges`);

  // AMBULANCES
  const ambulanceSpecs = [
    { label: "AMB-01", lat: zones.first_aid.c.lat + 0.0001, lng: zones.first_aid.c.lng - 0.0001, nodeKey: "n_first_aid" },
    { label: "AMB-02", lat: zones.first_aid.c.lat - 0.0001, lng: zones.first_aid.c.lng + 0.0001, nodeKey: "n_first_aid" },
    { label: "AMB-03", lat: zones.gate_s.c.lat, lng: zones.gate_s.c.lng + 0.0002, nodeKey: "n_gate_s" },
  ];
  for (const a of ambulanceSpecs) {
    const existing = await prisma.ambulance.findFirst({ where: { eventId: event.id, label: a.label } });
    if (existing) {
      await prisma.ambulance.update({
        where: { id: existing.id },
        data: { lat: a.lat, lng: a.lng, status: "available", nodeId: nodes[a.nodeKey] },
      });
    } else {
      await prisma.ambulance.create({
        data: { eventId: event.id, label: a.label, lat: a.lat, lng: a.lng, nodeId: nodes[a.nodeKey], status: "available" },
      });
    }
  }
  console.log(`✓ seeded ${ambulanceSpecs.length} ambulances`);

  // PARKING
  const parkingCentre = zones.parking.c;
  const cols = 7;
  const rows = 4;
  const spots: Array<{ id: number; label: string; isVip: boolean; lat: number; lng: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const label = `${String.fromCharCode(65 + r)}${c + 1}`;
      const isVip = r === 0 && c < 4;
      const lat = parkingCentre.lat + (r - rows / 2) * 0.00008;
      const lng = parkingCentre.lng + (c - cols / 2) * 0.00013;
      const existing = await prisma.parkingSpot.findFirst({ where: { eventId: event.id, label } });
      const row = existing
        ? await prisma.parkingSpot.update({ where: { id: existing.id }, data: { isVip, lat, lng, lot: "Lot A" } })
        : await prisma.parkingSpot.create({ data: { eventId: event.id, label, lot: "Lot A", isVip, lat, lng } });
      spots.push({ id: row.id, label, isVip, lat, lng });
    }
  }
  console.log(`✓ seeded ${spots.length} parking spots (${spots.filter((s) => s.isVip).length} VIP)`);

  const demoVehicles = [
    { plate: "MH-01-AB-1234", spot: "B2", owner: "Rohit Kulkarni" },
    { plate: "MH-01-CD-5678", spot: "B3", owner: "Sneha Rao" },
    { plate: "MH-02-EF-9012", spot: "C1", owner: "Mahesh Patil" },
  ];
  for (const v of demoVehicles) {
    const spot = spots.find((s) => s.label === v.spot)!;
    const existing = await prisma.vehicle.findFirst({
      where: { eventId: event.id, plate: v.plate, exitedAt: null },
    });
    if (!existing) {
      await prisma.vehicle.create({
        data: { eventId: event.id, plate: v.plate, ownerName: v.owner, spotId: spot.id, isVip: spot.isVip },
      });
    }
  }

  const vipSpots = spots.filter((s) => s.isVip);
  const vipReservations = [
    { guest: "Hon. Mayor of Mumbai", plate: "MH-01-VIP-001", spot: vipSpots[0], atHour: 11 },
    { guest: "Shri. Ashok Pawar (MP)", plate: "MH-01-VIP-002", spot: vipSpots[1], atHour: 14 },
  ];
  for (const r of vipReservations) {
    const expectedArrival = new Date();
    expectedArrival.setHours(r.atHour, 0, 0, 0);
    const existing = await prisma.vipReservation.findFirst({ where: { eventId: event.id, guestName: r.guest } });
    if (existing) {
      await prisma.vipReservation.update({
        where: { id: existing.id },
        data: { plate: r.plate, spotId: r.spot.id, expectedArrival, status: "reserved" },
      });
    } else {
      await prisma.vipReservation.create({
        data: {
          eventId: event.id, guestName: r.guest, plate: r.plate, spotId: r.spot.id,
          expectedArrival, status: "reserved",
        },
      });
    }
  }
  console.log(`✓ seeded ${demoVehicles.length} parked cars, ${vipReservations.length} VIP reservations`);

  // VOLUNTEER LIVE LOCATIONS
  const volunteerEmails = ["vol1@eventops.com", "vol2@eventops.com", "vol3@eventops.com", "vol4@eventops.com"];
  const scatterZones = ["pandal", "gate_n", "gate_s", "food"] as const;
  for (let i = 0; i < volunteerEmails.length; i++) {
    const z = zones[scatterZones[i]];
    await prisma.liveLocation.upsert({
      where: { userId: users[volunteerEmails[i]] },
      update: {
        lat: z.c.lat + (Math.random() - 0.5) * 0.0003,
        lng: z.c.lng + (Math.random() - 0.5) * 0.0003,
        zoneId: z.id,
      },
      create: { userId: users[volunteerEmails[i]], lat: z.c.lat, lng: z.c.lng, zoneId: z.id },
    });
  }
  console.log(`✓ seeded ${volunteerEmails.length} volunteer live-locations`);

  // SKILLS — scarce 'medical' and 'parking' (2 volunteers each) drive fragility
  const userSkills: Record<string, string[]> = {
    "volunteer@eventops.com": ["crowd_control", "logistics"],
    "lead.north@eventops.com": ["crowd_control", "communication"],
    "lead.south@eventops.com": ["crowd_control", "logistics"],
    "lead.firstaid@eventops.com": ["medical", "first_aid", "crowd_control"],
    "lead.parking@eventops.com": ["parking", "logistics"],
    "vol1@eventops.com": ["medical", "first_aid"],
    "vol2@eventops.com": ["crowd_control", "food_service"],
    "vol3@eventops.com": ["crowd_control", "communication"],
    "vol4@eventops.com": ["parking", "food_service"],
    "vol5@eventops.com": ["crowd_control", "logistics"],
    "vol6@eventops.com": ["crowd_control", "food_service"],
    "vol7@eventops.com": ["crowd_control", "communication"],
    "vol8@eventops.com": ["first_aid", "crowd_control"],
  };
  for (const [email, skills] of Object.entries(userSkills)) {
    if (users[email]) await prisma.user.update({ where: { id: users[email] }, data: { skills } });
  }
  console.log(`✓ assigned skills to ${Object.keys(userSkills).length} volunteers`);

  // TIMESLOTS — 4 shifts spanning the event day, anchored to event start
  const dayAnchor = new Date(event.startsAt ?? Date.now());
  dayAnchor.setHours(6, 0, 0, 0);
  const slotSpecs = [
    { label: "Morning Shift (06:00–10:00)", offsetHrs: 0 },
    { label: "Peak Shift (10:00–14:00)", offsetHrs: 4 },
    { label: "Afternoon Shift (14:00–18:00)", offsetHrs: 8 },
    { label: "Evening Shift (18:00–22:00)", offsetHrs: 12 },
  ];
  const slotIds: number[] = [];
  for (const s of slotSpecs) {
    const startsAt = new Date(dayAnchor.getTime() + s.offsetHrs * 3600 * 1000);
    const endsAt = new Date(startsAt.getTime() + 4 * 3600 * 1000);
    const existing = await prisma.timeslot.findFirst({ where: { eventId: event.id, label: s.label } });
    const row = existing
      ? await prisma.timeslot.update({ where: { id: existing.id }, data: { startsAt, endsAt } })
      : await prisma.timeslot.create({ data: { eventId: event.id, label: s.label, startsAt, endsAt } });
    slotIds.push(row.id);
  }
  const [slotMorn, slotPeak, slotAft, slotEve] = slotIds;
  console.log(`✓ seeded ${slotSpecs.length} timeslots`);

  // TASKS — demand pattern engineered so medical/parking scarcity drives fragility
  const taskSpecs = [
    { zone: "pandal", slot: slotMorn, title: "Crowd Marshal (Pandal) — morning", skill: "crowd_control", needed: 2 },
    { zone: "pandal", slot: slotPeak, title: "Crowd Marshal (Pandal) — peak", skill: "crowd_control", needed: 3 },
    { zone: "pandal", slot: slotAft, title: "Crowd Marshal (Pandal) — afternoon", skill: "crowd_control", needed: 2 },
    { zone: "pandal", slot: slotEve, title: "Crowd Marshal (Pandal) — evening", skill: "crowd_control", needed: 3 },
    { zone: "gate_n", slot: slotMorn, title: "North Gate check — morning", skill: "crowd_control", needed: 1 },
    { zone: "gate_n", slot: slotPeak, title: "North Gate check — peak", skill: "crowd_control", needed: 2 },
    { zone: "gate_n", slot: slotEve, title: "North Gate check — evening", skill: "crowd_control", needed: 2 },
    { zone: "gate_s", slot: slotPeak, title: "South Gate check — peak", skill: "crowd_control", needed: 2 },
    { zone: "gate_s", slot: slotEve, title: "South Gate check — evening", skill: "crowd_control", needed: 1 },
    { zone: "first_aid", slot: slotMorn, title: "First Aid duty — morning", skill: "medical", needed: 1 },
    { zone: "first_aid", slot: slotPeak, title: "First Aid duty — peak", skill: "medical", needed: 1 },
    { zone: "first_aid", slot: slotAft, title: "First Aid duty — afternoon", skill: "medical", needed: 1 },
    { zone: "first_aid", slot: slotEve, title: "First Aid duty — evening", skill: "medical", needed: 1 },
    { zone: "parking", slot: slotMorn, title: "Parking attendant — morning", skill: "parking", needed: 1 },
    { zone: "parking", slot: slotPeak, title: "Parking attendant — peak", skill: "parking", needed: 2 },
    { zone: "parking", slot: slotEve, title: "Parking attendant — evening", skill: "parking", needed: 1 },
    { zone: "food", slot: slotPeak, title: "Food service — peak", skill: "food_service", needed: 2 },
    { zone: "food", slot: slotAft, title: "Food service — afternoon", skill: "food_service", needed: 1 },
  ] as const;
  for (const t of taskSpecs) {
    const existing = await prisma.task.findFirst({
      where: { eventId: event.id, zoneId: zones[t.zone].id, timeslotId: t.slot, title: t.title },
    });
    if (existing) {
      await prisma.task.update({ where: { id: existing.id }, data: { requiredSkill: t.skill, needed: t.needed } });
    } else {
      await prisma.task.create({
        data: {
          eventId: event.id, zoneId: zones[t.zone].id, timeslotId: t.slot,
          title: t.title, requiredSkill: t.skill, needed: t.needed,
        },
      });
    }
  }
  console.log(`✓ seeded ${taskSpecs.length} tasks`);

  // AVAILABILITY — every volunteer available for every slot (keeps solver flexible)
  const volunteerEmailsAll = Object.keys(userSkills);
  for (const email of volunteerEmailsAll) {
    for (const sid of slotIds) {
      await prisma.availability.upsert({
        where: { userId_timeslotId: { userId: users[email], timeslotId: sid } },
        update: {},
        create: { userId: users[email], timeslotId: sid },
      });
    }
  }
  console.log(`✓ seeded availability (${volunteerEmailsAll.length} × ${slotIds.length})`);

  // PREFERENCES — leads prefer their own zone
  const prefSpecs: Array<{ email: string; zone: keyof typeof zones; rank: number }> = [
    { email: "lead.north@eventops.com", zone: "gate_n", rank: 1 },
    { email: "lead.south@eventops.com", zone: "gate_s", rank: 1 },
    { email: "lead.firstaid@eventops.com", zone: "first_aid", rank: 1 },
    { email: "lead.parking@eventops.com", zone: "parking", rank: 1 },
    { email: "vol1@eventops.com", zone: "first_aid", rank: 1 },
    { email: "vol2@eventops.com", zone: "food", rank: 1 },
    { email: "vol4@eventops.com", zone: "parking", rank: 2 },
  ];
  for (const p of prefSpecs) {
    await prisma.volunteerPreference.upsert({
      where: { userId_zoneId: { userId: users[p.email], zoneId: zones[p.zone].id } },
      update: { rank: p.rank },
      create: { userId: users[p.email], zoneId: zones[p.zone].id, rank: p.rank },
    });
  }
  console.log(`✓ seeded ${prefSpecs.length} zone preferences`);

  console.log(`\nDev password for all seed users: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
