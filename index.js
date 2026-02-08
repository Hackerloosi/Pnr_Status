import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import fs from "fs";

/* =========================
   OWNER / ADMIN
========================= */
const ADMIN_ID = 1609002531;

/* =========================
   BOT TOKEN (HARDCODED)
========================= */
const BOT_TOKEN = "8582437230:AAHh_kqzgaVQamSUUe3qUAzGFMJgN75qnEc";

/* =========================
   BOT INIT
========================= */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* =========================
   USER STORAGE
========================= */
const USER_FILE = "./users.json";

if (!fs.existsSync(USER_FILE)) {
  fs.writeFileSync(
    USER_FILE,
    JSON.stringify({ approved: [], pending: [], banned: [] }, null, 2)
  );
}

let users = JSON.parse(fs.readFileSync(USER_FILE));

function saveUsers() {
  fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
}

function getUserStatus(userId) {
  if (userId === ADMIN_ID) return "APPROVED";
  if (users.banned.includes(userId)) return "BANNED";
  if (users.approved.includes(userId)) return "APPROVED";
  if (users.pending.includes(userId)) return "PENDING";
  return "NEW";
}

/* =========================
   /START
========================= */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const status = getUserStatus(userId);

  if (status === "BANNED") {
    return bot.sendMessage(chatId, "🚫 You are banned from using this bot.");
  }

  if (status === "NEW") {
    users.pending.push(userId);
    saveUsers();

    bot.sendMessage(
      chatId,
`🤖 Bot Status: ONLINE 🟢
⚡ Service: Active

⏳ Awaiting for approval from owner...
🕒 Please wait, you will be notified once approved.`
    );

    bot.sendMessage(
      ADMIN_ID,
`🆕 New User Request

👤 Name: ${msg.from.first_name}
👤 Username: ${msg.from.username ? '@' + msg.from.username : 'NoUsername'}
🆔 User ID: ${userId}

👉 /approve ${userId}`
    );
    return;
  }

  if (status === "PENDING") {
    return bot.sendMessage(
      chatId,
`🤖 Bot Status: ONLINE 🟢
⚡ Service: Active

⏳ Awaiting for approval from owner...`
    );
  }

  bot.sendMessage(
    chatId,
`🤖 Bot Status: ONLINE 🟢
⚡ Service: Active

📱 Please send 10-digit PNR number.`
  );
});

/* =========================
   /APPROVE (ADMIN)
========================= */
bot.onText(/\/approve (\d+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const userId = Number(match[1]);
  if (!users.pending.includes(userId)) return;

  users.pending = users.pending.filter(u => u !== userId);
  users.approved.push(userId);
  saveUsers();

  bot.sendMessage(
    userId,
`✅ Owner approved you!
🎉 Now you can use this bot.
📱 Send /start`
  );
});

/* =========================
   /BAN (ADMIN)
========================= */
bot.onText(/\/ban (\d+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const userId = Number(match[1]);

  users.approved = users.approved.filter(u => u !== userId);
  users.pending = users.pending.filter(u => u !== userId);
  if (!users.banned.includes(userId)) users.banned.push(userId);
  saveUsers();

  bot.sendMessage(userId, "🚫 You are banned from using this bot.");
});

/* =========================
   DIRECT PNR HANDLER
========================= */
bot.onText(/^\d{10}$/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (getUserStatus(userId) !== "APPROVED") return;

  const pnr = msg.text;

  try {
    const response = await fetch(
      "https://api.v2.pnr.railcore.tech/api/v1/pnr/status",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnr })
      }
    );

    const json = await response.json();

    // ❌ PNR NOT FOUND
    if (!json.success || !json.data) {
      return bot.sendMessage(chatId, "Details Not Found ❌");
    }

    const d = json.data;
    const coach = d.passengers[0]?.coachPosition || "";
    const seats = d.passengers.map(p => p.berthNo).join(", ");

    const message = `\`\`\`
${d.boardingPoint.name} - ${d.boardingPoint.code}, ${d.boardingTime}
${d.reservationUpto.name} - ${d.reservationUpto.code}, ${d.arrivalTime}
0 nos Veg Food/Non-Veg Food/No Food
DOJ - ${d.doj}
Seat no - ${coach}/${seats}
\`\`\``;

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

  } catch (err) {
    bot.sendMessage(chatId, "Details Not Found ❌");
  }
});

/* =========================
   BOT READY
========================= */
console.log("🤖 Bot running successfully...");
