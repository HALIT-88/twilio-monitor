require('dotenv').config();
const axios = require('axios');
const twilio = require('twilio');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const seenSids = new Set();

async function sendToTelegram(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('Telegram error:', err.message);
  }
}

async function checkMessages() {
  try {
    const messages = await twilioClient.messages.list({ limit: 20 });

    for (const msg of messages) {
      if (seenSids.has(msg.sid)) continue;
      seenSids.add(msg.sid);

      // فقط الرسائل المرسلة (outbound) خلال آخر 5 دقائق
      const age = (Date.now() - new Date(msg.dateCreated).getTime()) / 1000 / 60;
      if (msg.direction !== 'outbound-api' || age > 5) continue;

      const time = new Date(msg.dateCreated).toLocaleString('ar-SA', {
        timeZone: 'Asia/Riyadh',
        hour12: true,
      });

      const notification = `✅ <b>SMS مُرسَل</b>
📞 إلى: <code>${msg.to}</code>
📤 من: <code>${msg.from}</code>
💬 النص: ${msg.body}
🕐 ${time}`;

      await sendToTelegram(notification);
      console.log(`[${time}] → ${msg.to} | ${msg.body}`);
    }
  } catch (err) {
    console.error('Twilio fetch error:', err.message);
  }
}

// تشغيل فوري ثم كل دقيقة
checkMessages();
setInterval(checkMessages, 60 * 1000);

console.log('✅ Twilio Monitor شغال — يفحص كل دقيقة');
sendToTelegram('🚀 <b>Twilio Monitor جاهز</b>\nيراقب الرسائل كل دقيقة.');
