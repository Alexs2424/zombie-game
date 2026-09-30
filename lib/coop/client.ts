import { COOP_VERSION, type ClientMessage, type CoopAction, type CoopInput, type ServerMessage } from './protocol.ts';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type ConnectOptions = { mode: 'create' | 'join' | 'resume'; endpoint: string; name: string; code?: string; hostKey?: string };
export type SavedSession = { endpoint: string; code: string; token: string; name: string };
type ClientHandlers = { message: (message: ServerMessage) => void; status: (status: ConnectionStatus) => void; error: (message: string) => void };
const STORAGE_KEY = 'last-jackpot.coop.session.v1';

export function defaultCoopEndpoint() {
  if (typeof window === 'undefined') return 'ws://localhost:2567';
  const configured = process.env.NEXT_PUBLIC_COOP_SERVER_URL;
  if (configured) return configured;
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname || 'localhost'}:2567`;
}
export function normalizeEndpoint(endpoint: string) {
  const url = new URL(endpoint.trim());
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('Use a ws:// or wss:// server address without credentials or a fragment.');
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol !== 'wss:')
    throw new Error('This HTTPS page needs a secure wss:// co-op server.');
  return url.href;
}
export function getSavedSession(endpoint: string): SavedSession | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as SavedSession | null;
    return saved && saved.endpoint === normalizeEndpoint(endpoint) && typeof saved.code === 'string' && typeof saved.token === 'string' && typeof saved.name === 'string' ? saved : null;
  } catch { return null; }
}
function storeSession(session: SavedSession | null) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Private browsing can deny storage; a live connection still works. */ }
}

/** Sends intent only. Actions are never queued or retried after a network interruption. */
export class CoopClient {
  status: ConnectionStatus = 'idle';
  endpoint = '';
  private socket: WebSocket | null = null;
  private options: ConnectOptions | null = null;
  private session: SavedSession | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private stopped = true;
  private actionId = 0;
  private epoch = 0;
  private pendingConnect: { resolve: () => void; reject: (error: Error) => void } | null = null;
  private handlers: ClientHandlers;
  constructor(handlers: ClientHandlers) { this.handlers = handlers; }
  connect(options: ConnectOptions): Promise<void> {
    this.disconnect(false);
    this.endpoint = normalizeEndpoint(options.endpoint);
    this.options = { ...options, endpoint: this.endpoint };
    this.session = options.mode === 'resume' ? getSavedSession(this.endpoint) : null;
    if (options.mode === 'resume' && !this.session) return Promise.reject(new Error('No saved seat was found for this server in this tab. Join with the room code.'));
    this.stopped = false;
    this.retry = 0;
    this.setStatus('connecting');
    return new Promise((resolve, reject) => { this.pendingConnect = { resolve, reject }; this.open(); });
  }
  private setStatus(status: ConnectionStatus) { this.status = status; this.handlers.status(status); }
  private open() {
    if (this.stopped || !this.options) return;
    let socket: WebSocket;
    try { socket = new WebSocket(this.endpoint); }
    catch { this.fail('Unable to open this co-op server address.'); return; }
    this.socket = socket;
    this.handshakeTimer = setTimeout(() => socket.close(), 10000);
    socket.onopen = () => {
      if (this.socket !== socket || !this.options) return;
      const message: ClientMessage = this.session
        ? { type: 'resume', version: COOP_VERSION, code: this.session.code, token: this.session.token }
        : this.options.mode === 'create'
          ? { type: 'create', version: COOP_VERSION, name: this.options.name, ...(this.options.hostKey ? { hostKey: this.options.hostKey } : {}) }
          : { type: 'join', version: COOP_VERSION, name: this.options.name, code: (this.options.code ?? '').trim().toUpperCase() };
      socket.send(JSON.stringify(message));
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let message: ServerMessage;
      try { message = JSON.parse(event.data) as ServerMessage; }
      catch { this.fail('The server sent an invalid response.'); return; }
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'welcome') {
        this.epoch = message.room.epoch;
        if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
        this.handshakeTimer = null;
        this.session = { endpoint: this.endpoint, code: message.room.code, token: message.token, name: this.options?.name ?? '' };
        storeSession(this.session);
        this.retry = 0;
        this.setStatus('connected');
        this.handlers.message(message);
        this.pendingConnect?.resolve();
        this.pendingConnect = null;
        return;
      }
      if (message.type === 'room') this.epoch = message.room.epoch;
      if (message.type === 'error') {
        this.handlers.error(message.message);
        if (this.status !== 'connected') { this.fail(message.message); return; }
      }
      this.handlers.message(message);
    };
    socket.onerror = () => { /* close reports failures without leaking a token into diagnostics. */ };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
      if (this.stopped) return;
      if (this.session && this.retry < 5) {
        this.setStatus('reconnecting');
        this.retryTimer = setTimeout(() => { this.retryTimer = null; this.open(); }, Math.min(4000, 500 * 2 ** this.retry++));
      } else this.fail(this.session ? 'Connection lost. Your controls are paused. Try reconnecting to your saved seat.' : 'Could not connect. Check the server address and that the co-op server is running.');
    };
  }
  private fail(message: string) {
    this.stopped = true;
    this.closeSocket();
    this.setStatus('disconnected');
    this.handlers.error(message);
    this.pendingConnect?.reject(new Error(message));
    this.pendingConnect = null;
  }
  private send(message: ClientMessage) {
    if (this.status !== 'connected' || this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 65536) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }
  input(input: CoopInput) { return this.send({ type: 'input', epoch: this.epoch, input }); }
  action(action: CoopAction) {
    const id = ++this.actionId;
    if (!this.send({ type: 'action', epoch: this.epoch, id, action })) { this.handlers.error('Action not sent: the connection is unavailable.'); return null; }
    return id;
  }
  start() { return this.send({ type: 'start' }); }
  private closeSocket() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
    this.retryTimer = this.handshakeTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; socket.close(); }
  }
  disconnect(forget = true) {
    if (forget) this.send({ type: 'leave' });
    this.stopped = true;
    this.closeSocket();
    this.pendingConnect?.reject(new Error('Connection cancelled.'));
    this.pendingConnect = null;
    if (forget) { this.session = null; storeSession(null); }
    this.setStatus('idle');
  }
}
