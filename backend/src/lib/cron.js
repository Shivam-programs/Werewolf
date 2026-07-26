import { CronJob } from "cron";
import dotenv from "dotenv";
dotenv.config();
import http from "node:http";
import https from "node:https";

// Every 14 minutes send a GET request to the backend health endpoint
const job = new CronJob("*/14 * * * *", function () {
    const base = process.env.BACKEND_URL;
    if (!base) return;
    const url = new URL("/api/health", base).href;
    const client = url.startsWith("https:") ? https : http;

    client
        .get(url, (res) => {
            if (res.statusCode === 200) {
                console.log("Health check successful");
            } else {
                console.log(`Health check failed: ${res.statusCode}`);
            }

            res.resume(); // consume response
        })
        .on("error", (err) => {
            console.error("Health check error:", err);
        });
});

export default job;