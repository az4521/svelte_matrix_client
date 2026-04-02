/**
 * Matrix Push Gateway for FCM
 *
 * Receives push notifications from a Matrix homeserver and forwards them
 * to Android devices via Firebase Cloud Messaging.
 *
 * Matrix spec: https://spec.matrix.org/latest/push-gateway-api/
 *
 * Setup:
 *   1. Create a Firebase project at https://console.firebase.google.com/
 *   2. Go to Project Settings > Service Accounts > Generate new private key
 *   3. Save the JSON as service-account.json in this directory
 *   4. Deploy this server somewhere with a public HTTPS URL
 *   5. Set GATEWAY_URL in src/lib/push.ts to https://your-server/_matrix/push/v1/notify
 *
 * Run:
 *   npm install
 *   node server.js
 */

import express from "express";
import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { readFileSync } from "fs";

// --- Config ---
const PORT = process.env.PORT || 3000;
const SERVICE_ACCOUNT_PATH =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
const APP_ID = "moe.crafty.matrix";

// --- Firebase init ---
let serviceAccount;
try {
    serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
} catch {
    console.error(`[gateway] ERROR: Could not read ${SERVICE_ACCOUNT_PATH}`);
    console.error(
        "[gateway] Download your Firebase service account JSON and save it as service-account.json",
    );
    process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const messaging = getMessaging();

// --- Express ---
const app = express();
app.use(express.json());

/**
 * POST /_matrix/push/v1/notify
 *
 * Body (event_id_only format):
 * {
 *   "notification": {
 *     "event_id": "$abc",
 *     "room_id": "!xyz:server",
 *     "counts": { "unread": 1, "missed_calls": 0 },
 *     "devices": [{ "app_id": "...", "pushkey": "<fcm_token>", "data": {} }]
 *   }
 * }
 */
app.post("/_matrix/push/v1/notify", async (req, res) => {
    const notification = req.body?.notification;
    if (!notification) {
        return res.status(400).json({ error: "Missing notification" });
    }

    const { event_id, room_id, counts, devices } = notification;
    const rejected = [];

    for (const device of devices ?? []) {
        if (device.app_id !== APP_ID) {
            console.warn(`[gateway] Unknown app_id: ${device.app_id}`);
            rejected.push(device.pushkey);
            continue;
        }

        const fcmToken = device.pushkey;
        const unread = counts?.unread ?? 1;

        try {
            await messaging.send({
                token: fcmToken,
                // Data-only message so the app can handle it (no system notification shown by OS)
                data: {
                    event_id: event_id ?? "",
                    room_id: room_id ?? "",
                    unread: String(unread),
                },
                android: {
                    priority: "high",
                    // For background wake-up without showing a notification
                    // (the Capacitor plugin will show one if the app is in background)
                    notification:
                        unread > 0
                            ? {
                                  title: "New message",
                                  body: room_id
                                      ? `In ${room_id}`
                                      : "You have a new message",
                                  sound: "default",
                                  channelId: "matrix_messages",
                              }
                            : undefined,
                },
            });
            console.log(
                `[gateway] Sent to ${fcmToken.slice(0, 16)}… room=${room_id}`,
            );
        } catch (err) {
            console.error(
                `[gateway] FCM error for token ${fcmToken.slice(0, 16)}…:`,
                err?.errorInfo?.code ?? err,
            );
            // FCM errors that mean the token is permanently invalid
            const invalidCodes = [
                "messaging/invalid-registration-token",
                "messaging/registration-token-not-registered",
            ];
            if (invalidCodes.includes(err?.errorInfo?.code)) {
                rejected.push(fcmToken);
            }
        }
    }

    // Rejected pushkeys tell the homeserver to remove those pushers
    res.json({ rejected });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
    console.log(`[gateway] Matrix push gateway listening on port ${PORT}`);
    console.log(`[gateway] POST /_matrix/push/v1/notify`);
});
