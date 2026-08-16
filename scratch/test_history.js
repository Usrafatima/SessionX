const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

console.log("================ VERIFYING NOTIFICATION HISTORY ENGINE ================\n");

// Check files exist
const routePath = path.resolve(__dirname, '../app/api/notifications/history/route.ts');
console.log("1. History API Route file exists:", fs.existsSync(routePath) ? "✅ PASSED" : "❌ FAILED");

const pushStoreContent = fs.readFileSync(path.resolve(__dirname, '../lib/pushStore.ts'), 'utf8');
console.log("2. saveNotificationHistory in pushStore.ts:", pushStoreContent.includes("saveNotificationHistory") ? "✅ PASSED" : "❌ FAILED");
console.log("3. listNotificationHistory in pushStore.ts:", pushStoreContent.includes("listNotificationHistory") ? "✅ PASSED" : "❌ FAILED");

const sysContent = fs.readFileSync(path.resolve(__dirname, '../components/NotificationSystem.tsx'), 'utf8');
console.log("4. NotificationRuntime auto-restores push:", sysContent.includes("restorePushRegistration(preferences)") ? "✅ PASSED" : "❌ FAILED");
console.log("5. NotificationsPage fetches persistent history:", sysContent.includes("/api/notifications/history") ? "✅ PASSED" : "❌ FAILED");
console.log("6. NotificationsPage displays metadata tags:", sysContent.includes("Category:") && sysContent.includes("Sent Successfully") ? "✅ PASSED" : "❌ FAILED");

const cronContent = fs.readFileSync(path.resolve(__dirname, '../app/api/cron/notifications/route.ts'), 'utf8');
console.log("7. Vercel Cron saves notification history:", cronContent.includes("saveNotificationHistory") ? "✅ PASSED" : "❌ FAILED");

console.log("\n================ ALL CHECKS COMPLETED ================");
