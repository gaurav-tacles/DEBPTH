// Supabase Edge Function: send-push
// Production-hardened, zero-cost Native Web Push sender for DEBPTH
// Triggered strictly via Database Webhook on public.notifications INSERT or authenticated Service Role backend dispatch.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

interface WebhookRecord {
  id: string;
  recipient_id: string;
  type?: string;
  title: string;
  body: string;
  link?: string;
  created_at?: string;
}

interface WebhookPayload {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: WebhookRecord;
  // Direct admin dispatch payload (requires SUPABASE_SERVICE_ROLE_KEY)
  event_id?: string;
  recipient_id?: string;
  notification?: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    tag?: string;
  };
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PAYLOAD_BYTES = 16 * 1024;

// Validates safe same-origin relative URLs (blocks protocol-relative '//evil.com' and external schemes)
function sanitizeRelativeUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "/";
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/";
  }
  return trimmed;
}

// L1 fast in-memory deduplication window for active isolate
const PROCESSED_CACHE_MAX = 1000;
const processedEvents = new Map<string, number>();

function isDuplicateEventInMemory(eventId: string): boolean {
  const now = Date.now();
  if (processedEvents.size > PROCESSED_CACHE_MAX) {
    for (const [id, ts] of processedEvents.entries()) {
      if (now - ts > 10 * 60 * 1000) {
        processedEvents.delete(id);
      }
    }
  }
  const ts = processedEvents.get(eventId);
  return ts !== undefined && now - ts <= 10 * 60 * 1000;
}

// Two-phase durable claim (prevents duplicate dispatch across isolates while permitting retries on transient failures)
async function claimDurableEvent(
  supabaseAdmin: any,
  eventId: string
): Promise<"claimed" | "duplicate"> {
  if (isDuplicateEventInMemory(eventId)) {
    return "duplicate";
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("claim_webhook_event", {
      p_event_id: eventId,
    });

    if (!error && data) {
      if (data === "already_completed" || data === "in_progress") {
        processedEvents.set(eventId, Date.now());
        return "duplicate";
      }
      return "claimed";
    }

    // Fallback to direct table insert if claim RPC is unavailable
    const { error: insertError } = await supabaseAdmin
      .from("processed_webhook_events")
      .insert({ event_id: eventId, status: "processing" });

    if (insertError) {
      if (
        insertError.code === "23505" ||
        insertError.message?.includes("duplicate") ||
        insertError.message?.includes("unique")
      ) {
        // Check if existing row is retryable ('failed')
        const { data: existing } = await supabaseAdmin
          .from("processed_webhook_events")
          .select("status")
          .eq("event_id", eventId)
          .single();

        if (existing?.status === "failed") {
          await supabaseAdmin
            .from("processed_webhook_events")
            .update({ status: "processing", claimed_at: new Date().toISOString() })
            .eq("event_id", eventId)
            .eq("status", "failed");
          return "claimed";
        }

        processedEvents.set(eventId, Date.now());
        return "duplicate";
      }
      console.warn("[send-push] Idempotency claim warning:", insertError.message);
    }
  } catch (err: any) {
    console.warn("[send-push] Could not persist idempotency claim:", err?.message);
  }

  return "claimed";
}

async function finalizeDurableEvent(
  supabaseAdmin: any,
  eventId: string,
  status: "completed" | "failed",
  errorMessage?: string
): Promise<void> {
  if (status === "completed") {
    processedEvents.set(eventId, Date.now());
  } else {
    processedEvents.delete(eventId);
  }

  try {
    const { error } = await supabaseAdmin.rpc("complete_webhook_event", {
      p_event_id: eventId,
      p_status: status,
      p_error: errorMessage ? errorMessage.slice(0, 500) : null,
    });

    if (error) {
      await supabaseAdmin
        .from("processed_webhook_events")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
          last_error: errorMessage ? errorMessage.slice(0, 500) : null,
        })
        .eq("event_id", eventId);
    }
  } catch (err: any) {
    console.warn("[send-push] Could not finalize idempotency event:", err?.message);
  }
}

// Timing-safe constant-time string comparison (portable across Deno & Node runtimes, avoids length/prefix leaks)
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  const len = Math.max(aBuf.byteLength, bBuf.byteLength);
  let diff = aBuf.byteLength ^ bBuf.byteLength;

  for (let i = 0; i < len; i++) {
    const aByte = i < aBuf.byteLength ? aBuf[i] : 0;
    const bByte = i < bBuf.byteLength ? bBuf[i] : 0;
    diff |= aByte ^ bByte;
  }

  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fast reject when Content-Length header exceeds limit
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:realgauravpatel@gmail.com";
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");

    // CRITICAL: Unconditional secret requirement - fail closed if not configured
    if (!webhookSecret) {
      console.error("[send-push] Fatal: WEBHOOK_SECRET is not configured in Supabase environment.");
      return new Response(
        JSON.stringify({ error: "Server configuration missing: Webhook secret required" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[send-push] Fatal: Missing Supabase service role credentials.");
      return new Response(
        JSON.stringify({ error: "Server configuration missing: Supabase service role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[send-push] Fatal: Missing VAPID keys in environment.");
      return new Response(
        JSON.stringify({ error: "Server configuration missing: VAPID keys required" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate caller unconditionally
    const rawHeader = req.headers.get("authorization") || req.headers.get("x-webhook-secret");
    if (!rawHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = rawHeader.replace(/^Bearer\s+/i, "").trim();

    const isWebhookAuth = timingSafeEqual(token, webhookSecret);
    const isServiceRoleAuth = timingSafeEqual(token, supabaseServiceKey);

    if (!isWebhookAuth && !isServiceRoleAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid authentication credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce actual byte limit on body even for chunked transfer encoding
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Malformed request: Valid JSON payload required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "Malformed request: JSON object payload required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client (Service Role bypasses RLS for subscription lookup, durable idempotency, & pruning)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let eventId: string | null = null;
    let recipientId = "";
    let pushPayload = {
      title: "DEBPTH Workspace Update",
      body: "You have a new notification in your DEBPTH workspace.",
      url: "/",
      icon: "/pwa-192x192.png",
      badge: "/icon.svg",
      tag: "debpth-notification",
    };

    // Strict schema & pathway validation
    if (payload.record && typeof payload.record === "object") {
      // Pathway 1: Database Webhook on public.notifications INSERT
      if (payload.type && payload.type !== "INSERT") {
        return new Response(
          JSON.stringify({ error: "Unsupported event type: Only INSERT events are handled" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (payload.table && payload.table !== "notifications") {
        return new Response(
          JSON.stringify({ error: "Unsupported table: Only notifications table is handled" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (payload.schema && payload.schema !== "public") {
        return new Response(
          JSON.stringify({ error: "Unsupported schema: Only public schema is handled" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rec = payload.record;
      if (
        !rec.id ||
        typeof rec.id !== "string" ||
        !rec.recipient_id ||
        typeof rec.recipient_id !== "string"
      ) {
        return new Response(
          JSON.stringify({ error: "Malformed notification record: id and recipient_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      eventId = `notif:${rec.id}`;
      const claimResult = await claimDurableEvent(supabase, eventId);
      if (claimResult === "duplicate") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Duplicate notification event suppressed (durable idempotency)",
            delivered: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipientId = rec.recipient_id;
      pushPayload = {
        title: String(rec.title || "DEBPTH Workspace").slice(0, 120),
        body: String(rec.body || "New activity in your workspace.").slice(0, 500),
        url: sanitizeRelativeUrl(rec.link),
        icon: "/pwa-192x192.png",
        badge: "/icon.svg",
        tag: `debpth-${String(rec.type || "notification").slice(0, 40)}-${rec.id}`,
      };
    } else if (payload.recipient_id && payload.notification && typeof payload.notification === "object") {
      // Pathway 2: Direct dispatch (Permitted ONLY for authenticated Service Role calls)
      if (!isServiceRoleAuth) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Direct notification dispatch requires Service Role authority" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (
        typeof payload.recipient_id !== "string" ||
        typeof payload.notification.title !== "string" ||
        typeof payload.notification.body !== "string"
      ) {
        return new Response(
          JSON.stringify({ error: "Malformed direct dispatch payload: recipient_id, title, and body must be strings" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (payload.event_id && typeof payload.event_id === "string") {
        eventId = `direct:${payload.event_id}`;
        const claimResult = await claimDurableEvent(supabase, eventId);
        if (claimResult === "duplicate") {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Duplicate direct dispatch event suppressed",
              delivered: 0,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      recipientId = payload.recipient_id;
      pushPayload = {
        title: payload.notification.title.slice(0, 120),
        body: payload.notification.body.slice(0, 500),
        url: sanitizeRelativeUrl(payload.notification.url),
        icon: sanitizeRelativeUrl(payload.notification.icon || "/pwa-192x192.png"),
        badge: "/icon.svg",
        tag: String(payload.notification.tag || `debpth-${Date.now()}`).slice(0, 80),
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid payload: Database webhook record or direct notification structure required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query active push subscriptions for recipient
    const { data: subscriptions, error: dbError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, user_agent")
      .eq("user_id", recipientId);

    if (dbError) {
      console.error("[send-push] Database error querying subscriptions:", dbError.message);
      if (eventId) {
        await finalizeDurableEvent(supabase, eventId, "failed", dbError.message);
      }
      return new Response(
        JSON.stringify({ error: "Failed to query subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      if (eventId) {
        await finalizeDurableEvent(supabase, eventId, "completed");
      }
      return new Response(
        JSON.stringify({
          success: true,
          delivered: 0,
          message: "No active push subscriptions found for recipient.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configure VAPID details (RFC 8292)
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const stringifiedPayload = JSON.stringify(pushPayload);
    let deliveredCount = 0;
    let transientFailureCount = 0;
    let lastTransientError = "";
    const expiredSubIds: string[] = [];

    // Deliver to all subscribed devices of user
    for (const sub of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          stringifiedPayload,
          {
            TTL: 86400, // 24 hours
          }
        );
        deliveredCount++;
      } catch (pushErr: any) {
        const statusCode = pushErr.statusCode || pushErr.status;
        // 404 (Not Found) or 410 (Gone) indicates unsubscribed or expired browser endpoint
        if (statusCode === 404 || statusCode === 410) {
          expiredSubIds.push(sub.id);
        } else {
          transientFailureCount++;
          lastTransientError = `Status ${statusCode || "network"}: ${pushErr.message || "Push service error"}`;
          console.warn(
            `[send-push] Transient push delivery failure (status ${statusCode}):`,
            pushErr.message || "Push service error"
          );
        }
      }
    }

    // Automatically prune dead/expired endpoints from database
    if (expiredSubIds.length > 0) {
      const { error: pruneError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubIds);

      if (pruneError) {
        console.warn("[send-push] Failed to prune expired subscriptions:", pruneError.message);
      } else {
        console.log(`[send-push] Successfully pruned ${expiredSubIds.length} expired subscriptions.`);
      }
    }

    // Transaction boundary: if every live subscription failed transiently, mark event 'failed' for retry
    if (deliveredCount === 0 && transientFailureCount > 0) {
      if (eventId) {
        await finalizeDurableEvent(supabase, eventId, "failed", lastTransientError);
      }
      return new Response(
        JSON.stringify({
          success: false,
          delivered: 0,
          transientFailures: transientFailureCount,
          pruned: expiredSubIds.length,
          error: "Push service temporarily unavailable; event marked retryable",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventId) {
      await finalizeDurableEvent(supabase, eventId, "completed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        pushServiceAccepted: deliveredCount,
        delivered: deliveredCount,
        total: subscriptions.length,
        pruned: expiredSubIds.length,
        transientFailures: transientFailureCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (globalErr: any) {
    console.error("[send-push] Unhandled exception:", globalErr.message || "Unknown error");
    return new Response(
      JSON.stringify({ error: "Internal server error in push delivery handler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
