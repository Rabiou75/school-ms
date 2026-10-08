import { Injectable, Logger } from '@nestjs/common';

type SmsConfig = {
  provider: string;
  username: string;
  apiKey: string;
  sender: string;
};

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  async send(cfg: SmsConfig, to: string, message: string): Promise<{ ok: boolean; providerId?: string; error?: string }> {
    if (!cfg.provider || !cfg.apiKey) return { ok: false, error: 'sms_not_configured' };

    switch (cfg.provider) {
      case 'africastalking':
        return this.sendAfricasTalking(cfg, to, message);
      case 'twilio':
        return this.sendTwilio(cfg, to, message);
      case 'orange':
        return this.sendOrange(cfg, to, message);
      case 'mtn':
        return this.sendMtn(cfg, to, message);
      default:
        return { ok: false, error: 'unknown_provider' };
    }
  }

  private async sendAfricasTalking(cfg: SmsConfig, to: string, message: string) {
    try {
      const params = new URLSearchParams({
        username: cfg.username,
        to,
        message,
      });
      if (cfg.sender) params.set('from', cfg.sender);

      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: cfg.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const json: any = await res.json();
      const recipient = json?.SMSMessageData?.Recipients?.[0];
      if (recipient?.status === 'Success') return { ok: true, providerId: recipient.messageId };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      this.logger.error('Africa\'s Talking failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  private async sendTwilio(cfg: SmsConfig, to: string, message: string) {
    try {
      const auth = Buffer.from(cfg.username + ':' + cfg.apiKey).toString('base64');
      const params = new URLSearchParams({ To: to, From: cfg.sender, Body: message });
      const res = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts/' + cfg.username + '/Messages.json',
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + auth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );
      const json: any = await res.json();
      if (json?.sid) return { ok: true, providerId: json.sid };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      this.logger.error('Twilio failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  private async sendOrange(cfg: SmsConfig, to: string, message: string) {
    // Orange SMS API (Cameroon) — placeholder; adjust to the operator's spec
    try {
      const res = await fetch('https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2370000/requests', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cfg.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: 'tel:' + to,
            senderAddress: 'tel:' + (cfg.sender || '+2370000'),
            outboundSMSTextMessage: { message },
          },
        }),
      });
      const json: any = await res.json();
      if (res.ok) return { ok: true, providerId: json?.resourceURL || 'orange_ok' };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  private async sendMtn(cfg: SmsConfig, to: string, message: string) {
    // MTN Cameroon SMS — placeholder; adjust to the operator's spec
    try {
      const res = await fetch('https://api.mtn.com/v1/messages/sms', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cfg.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senderAddress: cfg.sender || 'SCHOOL', receiverAddress: to, message }),
      });
      const json: any = await res.json();
      if (res.ok) return { ok: true, providerId: json?.messageId || 'mtn_ok' };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}
