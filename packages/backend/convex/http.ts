import { httpRouter } from "convex/server";
import { httpAction, ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { betterAuthComponentClient, createAuth } from "./auth";

const http = httpRouter();

betterAuthComponentClient.registerRoutes(http, createAuth);

const createCreemWebhookHandler =
  (secretEnvKey: string) => async (ctx: ActionCtx, request: Request) => {
    console.log(`----- Incoming Webhook Request (${secretEnvKey}) -----`);
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });

    const payloadString = await request.text();
    const signature = request.headers.get("creem-signature");

    if (!signature) {
      console.error("Missing creem-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    const webhookSecret = process.env[secretEnvKey];
    if (!webhookSecret) {
      console.error(`Missing ${secretEnvKey}`);
      return new Response("Server error", { status: 500 });
    }

    // Verify HMAC SHA256 using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payloadString),
    );

    // Convert buffer to hex string
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== signatureHex) {
      console.error("Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    let event;
    try {
      event = JSON.parse(payloadString);
    } catch (e) {
      console.error("Invalid JSON payload");
      return new Response("Invalid JSON", { status: 400 });
    }

    const eventType = event.type || event.eventType;

    try {
      switch (eventType) {
        case "checkout.completed":
          console.log("Payment successful!", {
            checkoutId: event.object?.id,
            customerId: event.object?.customer?.id,
            productId: event.object?.product?.id,
          });
          await ctx.runMutation(api.billing.handleCheckoutCompleted, {
            data: event.object,
            secret: webhookSecret,
          });
          break;
        case "subscription.active":
        case "subscription.past_due":
        case "subscription.paid":
        case "subscription.update":
          console.log(`Subscription updated (${eventType}):`, event.object?.id);
          await ctx.runMutation(api.billing.handleSubscriptionEvent, {
            type: eventType,
            data: event.object,
            secret: webhookSecret,
          });
          break;
        case "subscription.canceled":
          console.log("Subscription canceled:", event.object?.id);
          await ctx.runMutation(api.billing.handleSubscriptionEvent, {
            type: eventType,
            data: event.object,
            secret: webhookSecret,
          });
          break;
        case "subscription.expired":
          console.log("Subscription expired:", event.object?.id);
          await ctx.runMutation(api.billing.handleSubscriptionExpired, {
            data: event.object,
            secret: webhookSecret,
          });
          break;
        default:
          console.log(`Unhandled event type: ${eventType}`);
      }
    } catch (e) {
      console.error("Error processing webhook:", e);
      return new Response("Webhook processing failed", { status: 500 });
    }

    return new Response("Webhook received", { status: 200 });
  };

http.route({
  path: "/creem-subscription-webhook",
  method: "POST",
  handler: httpAction(
    createCreemWebhookHandler("CREEM_SUBSCRIPTION_WEBHOOK_SECRET"),
  ),
});

export default http;
