import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    console.error("[readyz] DB check failed:", e);
  }

  return Response.json(
    {
      ok: dbOk,
      timestamp: new Date().toISOString(),
      db: dbOk ? "connected" : "disconnected",
    },
    { status: dbOk ? 200 : 503 }
  );
};