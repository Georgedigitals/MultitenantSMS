import { formatNigerianPhoneNumber } from '@/lib/sms-service';

type WhatsAppSendResult = { success: boolean; providerMessageId?: string; error?: string };

/** Sends an approved WhatsApp Business template through Meta Cloud API.
 * The school/platform must create and approve the template in Meta first. */
export async function sendWhatsAppTemplate(options: {
  phone: string;
  template: string;
  parameters?: string[];
}): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';
  if (!token || !phoneNumberId || !apiVersion) {
    return { success: false, error: 'WhatsApp Cloud API credentials are not configured.' };
  }
  if (!/^v\d+\.\d+$/.test(apiVersion)) return { success: false, error: 'WHATSAPP_GRAPH_API_VERSION is invalid.' };
  if (!/^[a-z0-9_]{2,128}$/.test(options.template)) return { success: false, error: 'WhatsApp template name is invalid.' };
  const to = formatNigerianPhoneNumber(options.phone);
  if (!/^\d{10,15}$/.test(to)) return { success: false, error: 'Recipient phone number is invalid.' };
  const parameters = (options.parameters || []).map((value) => String(value).slice(0, 1024));

  try {
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: options.template,
          language: { code: languageCode },
          ...(parameters.length ? { components: [{ type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) }] } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({}));
    const messageId = data?.messages?.[0]?.id;
    if (!response.ok || typeof messageId !== 'string') {
      const providerCode = data?.error?.code;
      return { success: false, error: `WhatsApp provider rejected the template${providerCode ? ` (code ${providerCode})` : ''}.` };
    }
    return { success: true, providerMessageId: messageId };
  } catch {
    return { success: false, error: 'Could not connect to the WhatsApp provider.' };
  }
}
