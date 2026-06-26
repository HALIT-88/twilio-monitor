require('dotenv').config();
const express = require('express');
const axios = require('axios');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function getMessageBody(sid) {
  try {
    const msg = await twilioClient.messages(sid).fetch();
    return msg.body || '(بدون نص)';
  } catch {
    return '(تعذّر جلب النص)';
  }
}

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

// Twilio يضرب هذا الـ endpoint عند كل تغيير في حالة الرسالة
app.post('/twilio/status', async (req, res) => {
  const signature = req.headers['x-twilio-signature'];
  const url = `https://${req.headers.host}/twilio/status`;
  const valid = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, req.body);

  if (!valid) {
    console.warn('طلب غير موثوق - تم الرفض');
    return res.sendStatus(403);
  }

  res.sendStatus(200); // رد فوري لـ Twilio قبل أي معالجة

  const { To, From, MessageStatus, MessageSid, ErrorCode } = req.body;

  // فقط عند أول إرسال لتجنب تكرار الإشعار
  if (MessageStatus !== 'sent' && MessageStatus !== 'failed' && MessageStatus !== 'undelivered') return;

  const body = await getMessageBody(MessageSid);

  const statusEmoji = { sent: '✅', delivered: '✅✅', undelivered: '❌', failed: '🚫' };
  const emoji = statusEmoji[MessageStatus] || '📨';

  const time = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', hour12: true });

  let msg = `${emoji} <b>SMS - ${MessageStatus.toUpperCase()}</b>
📞 إلى: <code>${To}</code>
📤 من: <code>${From}</code>
💬 النص: ${body}
🆔 SID: <code>${MessageSid}</code>
🕐 ${time}`;

  if (ErrorCode) msg += `\n⚠️ خطأ: <code>${ErrorCode}</code>`;

  sendToTelegram(msg);
  console.log(`[${time}] ${MessageStatus} → ${To} | ${body}`);
});

// endpoint للتأكد أن السيرفر شغال
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Twilio Monitor شغال على البورت ${PORT}`);
  sendToTelegram(`🚀 <b>Twilio Monitor تشغّل</b>\nجاهز لاستقبال إشعارات الرسائل.`);
});

// endpoint تجريبي فقط
app.post('/test', async (req, res) => {
  await sendToTelegram(`🧪 <b>اختبار ناجح!</b>\nالبوت شغال وجاهز لاستقبال إشعارات Twilio.`);
  res.json({ ok: true });
});
