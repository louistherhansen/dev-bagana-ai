import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook receiver for CrewAI Cloud (app.crewai).
 * CrewAI calls this URL when a task/step/crew completes if you set:
 * - taskWebhookUrl / stepWebhookUrl / crewWebhookUrl di kickoff atau di env.
 *
 * Contoh: CREWAI_WEBHOOK_CREW_URL=https://your-domain.com/api/crew/webhook
 *
 * Method: POST
 * Body: JSON dari CrewAI (biasanya berisi kickoff_id, status, result, dll.)
 * Response: 200 OK (CrewAI expects 2xx to avoid retries).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const kickoffId = (body.kickoff_id ?? body.id ?? body.task_id ?? "") as string;
    const status = (body.status ?? body.state ?? "") as string;

    // Optional secret validation: X-CrewAI-Signature header or query/body secret
    const secret = process.env.CREWAI_WEBHOOK_SECRET;
    if (secret) {
      const received = request.headers.get("x-crewai-signature") ?? (body.secret as string);
      if (received !== secret) {
        return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
      }
    }

    // You can: persist to DB, enqueue, notify client, etc.
    // For now, only log (in production you can write to project-context/2.build/logs/webhook.log)
    if (process.env.NODE_ENV === "development") {
      console.log("[CrewAI Webhook]", { kickoffId, status, keys: Object.keys(body) });
    }

    return NextResponse.json({ received: true, kickoffId, status });
  } catch {
    return NextResponse.json({ received: false }, { status: 200 });
  }
}

/** GET: verifikasi endpoint (beberapa sistem ping URL webhook). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "CrewAI webhook receiver. POST payload from CrewAI Cloud (task/step/crew callbacks).",
  });
}
