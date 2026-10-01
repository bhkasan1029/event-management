import { neon } from "neondatabase/serverless";

export const sql = neon(proces.env.DATABASE_URL!);
