-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('organiser', 'volunteer', 'participant');

-- CreateEnum
CREATE TYPE "VolunteerSubRole" AS ENUM ('team_lead', 'normal');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('gate', 'registration', 'stage', 'first_aid', 'parking', 'food', 'other');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('assigned', 'standby', 'completed', 'no_show', 'reassigned');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('auto', 'manual', 'rebalance');

-- CreateEnum
CREATE TYPE "GateCountSource" AS ENUM ('manual', 'ticket_scan', 'camera', 'simulated');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('available', 'dispatched', 'offline');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('medical', 'crowd', 'equipment', 'other');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "EvacuationStatus" AS ENUM ('active', 'ended');

-- CreateEnum
CREATE TYPE "VipReservationStatus" AS ENUM ('reserved', 'arrived', 'cancelled');

-- CreateEnum
CREATE TYPE "LostFoundKind" AS ENUM ('lost', 'found');

-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('open', 'matched', 'returned');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('inventory', 'clear_path', 'reassignment', 'escalation', 'out_of_zone', 'evacuation', 'general');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'volunteer',
    "volunteer_sub_role" "VolunteerSubRole",
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_hours" INTEGER DEFAULT 8,
    "reliability" DECIMAL(3,2) DEFAULT 1.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "center_lat" DOUBLE PRECISION,
    "center_lng" DOUBLE PRECISION,
    "created_by" INTEGER,
    "head_coordinator_id" INTEGER,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL DEFAULT 'other',
    "polygon" JSONB,
    "lead_id" INTEGER,
    "priority" INTEGER DEFAULT 1,
    "capacity" INTEGER,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeslots" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "label" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timeslots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "user_id" INTEGER NOT NULL,
    "timeslot_id" INTEGER NOT NULL,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("user_id","timeslot_id")
);

-- CreateTable
CREATE TABLE "volunteer_preferences" (
    "user_id" INTEGER NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "rank" INTEGER DEFAULT 1,

    CONSTRAINT "volunteer_preferences_pkey" PRIMARY KEY ("user_id","zone_id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "zone_id" INTEGER,
    "timeslot_id" INTEGER,
    "title" TEXT NOT NULL,
    "required_skill" TEXT,
    "needed" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER,
    "user_id" INTEGER,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'assigned',
    "source" "AssignmentSource" DEFAULT 'auto',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_reports" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "runs" INTEGER DEFAULT 100,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "results" JSONB NOT NULL,

    CONSTRAINT "risk_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "zone_id" INTEGER,
    "name" TEXT NOT NULL,
    "unit" TEXT DEFAULT 'pcs',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "usage_per_person" DECIMAL(6,3) DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER,
    "change" INTEGER NOT NULL,
    "reason" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_counts" (
    "id" SERIAL NOT NULL,
    "zone_id" INTEGER,
    "count" INTEGER NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "window_minutes" INTEGER DEFAULT 5,
    "source" "GateCountSource" DEFAULT 'manual',

    CONSTRAINT "gate_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulances" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "node_id" INTEGER,
    "status" "AmbulanceStatus" DEFAULT 'available',

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "zone_id" INTEGER,
    "type" "IssueType" NOT NULL,
    "description" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "reported_by" INTEGER,
    "assigned_to" INTEGER,
    "escalation_level" INTEGER DEFAULT 0,
    "escalate_at" TIMESTAMPTZ(6),
    "status" "IssueStatus" DEFAULT 'open',
    "ambulance_id" INTEGER,
    "route" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_nodes" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zone_id" INTEGER,
    "is_exit" BOOLEAN DEFAULT false,

    CONSTRAINT "venue_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_edges" (
    "id" SERIAL NOT NULL,
    "from_node" INTEGER,
    "to_node" INTEGER,
    "length_m" DECIMAL(8,2) NOT NULL,
    "width_m" DECIMAL(5,2) DEFAULT 3,
    "is_blocked" BOOLEAN DEFAULT false,

    CONSTRAINT "venue_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evacuations" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "triggered_by" INTEGER,
    "reason" TEXT,
    "blocked_edge_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "plan" JSONB,
    "status" "EvacuationStatus" DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "evacuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_spots" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "label" TEXT NOT NULL,
    "lot" TEXT,
    "is_vip" BOOLEAN DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "parking_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "plate" TEXT NOT NULL,
    "owner_name" TEXT,
    "spot_id" INTEGER,
    "is_vip" BOOLEAN DEFAULT false,
    "entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exited_at" TIMESTAMPTZ(6),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_reservations" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "guest_name" TEXT NOT NULL,
    "plate" TEXT,
    "spot_id" INTEGER,
    "expected_arrival" TIMESTAMPTZ(6),
    "status" "VipReservationStatus" DEFAULT 'reserved',

    CONSTRAINT "vip_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_found_items" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "kind" "LostFoundKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "image_url" TEXT,
    "zone_id" INTEGER,
    "reported_by" INTEGER,
    "contact" TEXT,
    "status" "LostFoundStatus" DEFAULT 'open',
    "matched_item_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "urgency_score" DECIMAL(5,2),
    "data" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_locations" (
    "user_id" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zone_id" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_locations_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "carpool_groups" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER,
    "name" TEXT NOT NULL,
    "origin_area" TEXT,
    "departure_time" TIMESTAMPTZ(6),
    "seats" INTEGER,
    "created_by" INTEGER,

    CONSTRAINT "carpool_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_members" (
    "group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "carpool_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER,
    "user_id" INTEGER,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_tasks_timeslot" ON "tasks"("timeslot_id");

-- CreateIndex
CREATE INDEX "idx_assign_user" ON "assignments"("user_id");

-- CreateIndex
CREATE INDEX "idx_assign_task" ON "assignments"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_task_id_user_id_key" ON "assignments"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_gate_counts_time" ON "gate_counts"("zone_id", "window_start" DESC);

-- CreateIndex
CREATE INDEX "idx_issues_open" ON "issues"("status");

-- CreateIndex
CREATE INDEX "idx_edges_from" ON "venue_edges"("from_node");

-- CreateIndex
CREATE INDEX "idx_notif_user_unread" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_chat_group_time" ON "chat_messages"("group_id", "created_at");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_head_coordinator_id_fkey" FOREIGN KEY ("head_coordinator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_timeslot_id_fkey" FOREIGN KEY ("timeslot_id") REFERENCES "timeslots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_preferences" ADD CONSTRAINT "volunteer_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_preferences" ADD CONSTRAINT "volunteer_preferences_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_timeslot_id_fkey" FOREIGN KEY ("timeslot_id") REFERENCES "timeslots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_reports" ADD CONSTRAINT "risk_reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_counts" ADD CONSTRAINT "gate_counts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "venue_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_nodes" ADD CONSTRAINT "venue_nodes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_nodes" ADD CONSTRAINT "venue_nodes_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_edges" ADD CONSTRAINT "venue_edges_from_node_fkey" FOREIGN KEY ("from_node") REFERENCES "venue_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_edges" ADD CONSTRAINT "venue_edges_to_node_fkey" FOREIGN KEY ("to_node") REFERENCES "venue_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evacuations" ADD CONSTRAINT "evacuations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evacuations" ADD CONSTRAINT "evacuations_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spots" ADD CONSTRAINT "parking_spots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "parking_spots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_reservations" ADD CONSTRAINT "vip_reservations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_reservations" ADD CONSTRAINT "vip_reservations_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "parking_spots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_matched_item_id_fkey" FOREIGN KEY ("matched_item_id") REFERENCES "lost_found_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_locations" ADD CONSTRAINT "live_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_locations" ADD CONSTRAINT "live_locations_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_groups" ADD CONSTRAINT "carpool_groups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_groups" ADD CONSTRAINT "carpool_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_members" ADD CONSTRAINT "carpool_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "carpool_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_members" ADD CONSTRAINT "carpool_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "carpool_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: one car per spot while parked (exited_at IS NULL)
CREATE UNIQUE INDEX "uniq_spot_occupied" ON "vehicles"("spot_id") WHERE "exited_at" IS NULL;

-- View: live parking status (free / occupied / reserved_vip)
CREATE VIEW "parking_status" AS
SELECT
  s.id,
  s.label,
  s.lot,
  s.is_vip,
  CASE
    WHEN v.id IS NOT NULL THEN 'occupied'
    WHEN r.id IS NOT NULL THEN 'reserved_vip'
    ELSE 'free'
  END AS status,
  v.plate,
  r.guest_name AS reserved_for
FROM "parking_spots" s
LEFT JOIN "vehicles" v
  ON v.spot_id = s.id AND v.exited_at IS NULL
LEFT JOIN "vip_reservations" r
  ON r.spot_id = s.id AND r.status = 'reserved'
     AND r.expected_arrival::date = CURRENT_DATE;
