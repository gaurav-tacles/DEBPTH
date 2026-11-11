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

// Replay & duplicate event cache (in-memory deduplication window)
const PROCESSED_CACHE_MAX = 1000;
const processedEvents = new Map<string, number>();

function isDuplicateEvent(eventId: string): boolean {
  const now = Date.now();
  // Evict entries older than 10 minutes
  if (processedEvents.size > PROCESSED_CACHE_MAX) {
    for (const [id, ts] of processedEvents.entries()) {
      if (now - ts > 10 * 60 * 1000) {
        processedEvents.delete(id);
      }
    }
  }

  if (processedEvents.has(eventId)) {
    return true;
  }
  processedEvents.set(eventId, now);
  return false;
}

// Timing-safe constant-time string comparison using Web Crypto API
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBuf, bBuf);
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

  // Reject oversized requests (> 16 KB)
  const MAX_PAYLOAD_BYTES = 16 * 1024;
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
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@debpth.vercel.app";
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

    const isWebhookAuth = await timingSafeEqual(token, webhookSecret);
    const isServiceRoleAuth = await timingSafeEqual(token, supabaseServiceKey);

    if (!isWebhookAuth && !isServiceRoleAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid authentication credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: WebhookPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Malformed request: Valid JSON payload required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      if (!rec.id || typeof rec.id !== "string" || !rec.recipient_id || typeof rec.recipient_id !== "string") {
        return new Response(
          JSON.stringify({ error: "Malformed notification record: id and recipient_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Replay / duplicate event suppression
      if (isDuplicateEvent(rec.id)) {
        return new Response(
          JSON.stringify({ success: true, message: "Duplicate notification event suppressed", delivered: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipientId = rec.recipient_id;
      pushPayload = {
        title: (rec.title || "DEBPTH Workspace").slice(0, 120),
        body: (rec.body || "New activity in your workspace.").slice(0, 500),
        url: rec.link && rec.link.startsWith("/") ? rec.link : "/",
        icon: "/pwa-192x192.png",
        badge: "/icon.svg",
        tag: `debpth-${rec.type || "notification"}-${rec.id}`,
      };
    } else if (payload.recipient_id && payload.notification) {
      // Pathway 2: Direct dispatch (Permitted ONLY for authenticated Service Role calls)
      if (!isServiceRoleAuth) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Direct notification dispatch requires Service Role authority" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipientId = payload.recipient_id;
      pushPayload = {
        title: (payload.notification.title || "DEBPTH Workspace").slice(0, 120),
        body: (payload.notification.body || "New activity.").slice(0, 500),
        url: payload.notification.url && payload.notification.url.startsWith("/") ? payload.notification.url : "/",
        icon: payload.notification.icon || "/pwa-192x192.png",
        badge: "/icon.svg",
        tag: payload.notification.tag || `debpth-${Date.now()}`,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid payload: Database webhook record or direct notification structure required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client (Service Role bypasses RLS for subscription lookup & pruning)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Query active push subscriptions for recipient
    const { data: subscriptions, error: dbError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, user_agent")
      .eq("user_id", recipientId);

    if (dbError) {
      console.error("[send-push] Database error querying subscriptions:", dbError.message);
      return new Response(
        JSON.stringify({ error: "Failed to query subscriptions", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
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
          // Log sanitized error without dumping keys or secrets
          console.warn(
            `[send-push] Non-fatal delivery failure (status ${statusCode}):`,
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

    return new Response(
      JSON.stringify({
        success: true,
        delivered: deliveredCount,
        total: subscriptions.length,
        pruned: expiredSubIds.length,
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
