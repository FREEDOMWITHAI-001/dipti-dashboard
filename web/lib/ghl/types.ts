export interface GhlContact {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  tags?: string[];
  customFields?: Array<{ key: string; value: string }>;
  // Millisecond timestamp GHL returns on each contact; used together with
  // startAfterId as the pagination cursor for the contacts search endpoint.
  dateAdded?: string | number | null;
}

export interface GhlContactsResponse {
  contacts: GhlContact[];
  // GHL paginates with a COMPOUND cursor: startAfter (a ms timestamp) plus
  // startAfterId. Passing only the id makes GHL return overlapping windows, so
  // both must be threaded through.
  meta?: { total?: number; startAfterId?: string; startAfter?: string | number };
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
