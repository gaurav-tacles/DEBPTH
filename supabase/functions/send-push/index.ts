// Supabase Edge Function: send-push
// Production-ready, zero-cost Native Web Push sender for DEBPTH
// Triggered either via Database Webhook on public.notifications INSERT or direct backend invocation.

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
  // Direct dispatch payload
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@debpth.vercel.app";
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[send-push] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY configuration.");
      return new Response(
        JSON.stringify({ error: "Server configuration missing: Supabase service role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[send-push] Missing VAPID keys in environment variables (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).");
      return new Response(
        JSON.stringify({ error: "Server configuration missing: VAPID keys required" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional webhook secret validation if configured
    if (webhookSecret) {
      const authHeader = req.headers.get("authorization") || req.headers.get("x-webhook-secret");
      const token = authHeader?.replace(/^Bearer\s+/i, "");
      if (token !== webhookSecret && token !== supabaseServiceKey) {
        return new Response(
          JSON.stringify({ error: "Unauthorized webhook request" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const payload: WebhookPayload = await req.json();

    let recipientId = "";
    let pushPayload = {
      title: "DEBPTH Workspace Update",
      body: "You have a new notification in your DEBPTH workspace.",
      url: "/",
      icon: "/pwa-192x192.png",
      badge: "/icon.svg",
      tag: "debpth-notification",
    };

    // 1. Check if incoming request is a Postgres Database Webhook payload
    if (payload.record && payload.record.recipient_id) {
      recipientId = payload.record.recipient_id;
      pushPayload = {
        title: payload.record.title || "DEBPTH Workspace",
        body: payload.record.body || "New activity in your workspace.",
        url: payload.record.link || "/",
        icon: "/pwa-192x192.png",
        badge: "/icon.svg",
        tag: `debpth-${payload.record.type || "notification"}-${payload.record.id}`,
      };
    } else if (payload.recipient_id && payload.notification) {
      // 2. Direct dispatch payload
      recipientId = payload.recipient_id;
      pushPayload = {
        title: payload.notification.title || "DEBPTH Workspace",
        body: payload.notification.body || "New activity.",
        url: payload.notification.url || "/",
        icon: payload.notification.icon || "/pwa-192x192.png",
        badge: "/icon.svg",
        tag: payload.notification.tag || `debpth-${Date.now()}`,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid payload: recipient_id and notification content required" }),
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
          // Log high-level error without dumping cryptographic keys
          console.warn(
            `[send-push] Non-fatal delivery failure (status ${statusCode}):`,
            pushErr.message || "Unknown push service error"
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
    console.error("[send-push] Unhandled exception:", globalErr.message || globalErr);
    return new Response(
      JSON.stringify({ error: "Internal server error in push delivery handler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
