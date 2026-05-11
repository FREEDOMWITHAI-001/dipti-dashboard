export interface GhlContact {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  tags?: string[];
  customFields?: Array<{ key: string; value: string }>;
}

export interface GhlContactsResponse {
  contacts: GhlContact[];
  meta?: { total?: number; startAfterId?: string };
}

export class GhlError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`GHL ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}
