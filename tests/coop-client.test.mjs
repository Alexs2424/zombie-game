import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CoopClient, normalizeEndpoint, getSavedSession } from '../lib/coop/client.ts';

const originalSocket = globalThis.WebSocket;
const originalStorage = globalThis.sessionStorage;
const originalWindow = globalThis.window;
const clients = [];
class FakeSocket {
  static OPEN = 1;
  static instances = [];
  readyState = 0;
  bufferedAmount = 0;
  sent = [];
  constructor(url) { this.url = url; FakeSocket.instances.push(this); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
}
function setup() {
  FakeSocket.instances = [];
  globalThis.WebSocket = FakeSocket;
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const messages = [], statuses = [], errors = [];
  const client = new CoopClient({ message: message => messages.push(message), status: status => statuses.push(status), error: message => errors.push(message) });
  clients.push(client);
  return { client, messages, statuses, errors, storage };
}
function welcome(socket, epoch = 1) {
  socket.receive({ type: 'welcome', playerId: 'a', token: 'secret-seat-token', room: { code: 'ABCDEF', hostId: 'a', phase: 'lobby', epoch, players: [] }, snapshot: { tick: 0, phase: 'lobby', self: {}, players: [], events: [] } });
}
afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect(false);
  globalThis.WebSocket = originalSocket;
  globalThis.sessionStorage = originalStorage;
  globalThis.window = originalWindow;
});

test('endpoint validation rejects credential-bearing and mixed-content servers', () => {
  assert.equal(normalizeEndpoint(' ws://localhost:2567 '), 'ws://localhost:2567/');
  assert.throws(() => normalizeEndpoint('https://localhost:2567'));
  assert.throws(() => normalizeEndpoint('ws://person:password@example.com'));
  globalThis.window = { location: { protocol: 'https:' } };
  assert.throws(() => normalizeEndpoint('ws://example.com:2567'));
  assert.equal(normalizeEndpoint('wss://example.com/coop'), 'wss://example.com/coop');
});

test('create handshake carries host key once; commands follow latest run epoch', async () => {
  const { client } = setup();
  const connected = client.connect({ mode: 'create', endpoint: 'ws://localhost:2567', name: 'Alex', hostKey: 'test-key' });
  const socket = FakeSocket.instances[0];
  assert.equal(client.action({ kind: 'grenade' }), null, 'actions before welcome are not queued');
  socket.open();
  assert.equal(socket.sent[0].type, 'create');
  assert.equal(socket.sent[0].hostKey, 'test-key');
  welcome(socket, 2); await connected;
  const id = client.action({ kind: 'grenade' });
  assert.equal(socket.sent.at(-1).epoch, 2);
  assert.equal(socket.sent.at(-1).id, id);
  socket.receive({ type: 'room', room: { code: 'ABCDEF', hostId: 'a', phase: 'playing', epoch: 3, players: [] } });
  client.input({ seq: 1, forward: 1, strafe: 0, yaw: 0, pitch: 0, sprint: false, fire: false, aim: false });
  assert.equal(socket.sent.at(-1).epoch, 3);
  assert.equal(getSavedSession('ws://localhost:2567').token, 'secret-seat-token');
  assert.equal(getSavedSession('ws://other-server:2567'), null, 'seat tokens are scoped to their endpoint');
});

test('reconnect resumes the seat and never replays uncertain purchase actions', async () => {
  const { client, statuses } = setup();
  const connected = client.connect({ mode: 'join', endpoint: 'ws://localhost:2567', name: 'Player', code: 'abcdef' });
  const first = FakeSocket.instances[0]; first.open();
  assert.equal(first.sent[0].code, 'ABCDEF'); welcome(first); await connected;
  client.action({ kind: 'purchase', purchase: 'shotgun' });
  first.close();
  assert.equal(client.status, 'reconnecting');
  assert.equal(client.action({ kind: 'purchase', purchase: 'shotgun' }), null);
  await new Promise(resolve => setTimeout(resolve, 550));
  const second = FakeSocket.instances[1]; second.open();
  assert.deepEqual(second.sent.map(message => message.type), ['resume']);
  assert.equal(second.sent[0].token, 'secret-seat-token');
  welcome(second, 4);
  assert.equal(client.status, 'connected');
  assert.deepEqual(second.sent.map(message => message.type), ['resume']);
  assert.ok(statuses.includes('reconnecting'));
  client.disconnect();
  assert.equal(second.sent.at(-1).type, 'leave');
  assert.equal(getSavedSession('ws://localhost:2567'), null);
});

test('resume rejection stops automatic retries and does not turn into a new admission', async () => {
  const { client } = setup();
  const connected = client.connect({ mode: 'create', endpoint: 'ws://localhost:2567', name: 'Alex' });
  const first = FakeSocket.instances[0]; first.open(); welcome(first); await connected;
  client.disconnect(false);
  const resumed = client.connect({ mode: 'resume', endpoint: 'ws://localhost:2567', name: 'Alex' });
  const second = FakeSocket.instances[1]; second.open();
  second.receive({ type: 'error', code: 'expired', message: 'This seat expired.' });
  await assert.rejects(resumed, /seat expired/);
  assert.equal(client.status, 'disconnected');
  assert.deepEqual(second.sent.map(message => message.type), ['resume']);
});

test('congested sockets discard input and economic actions instead of building a replay queue', async () => {
  const { client } = setup();
  const connected = client.connect({ mode: 'create', endpoint: 'ws://localhost:2567', name: 'Alex' });
  const socket = FakeSocket.instances[0]; socket.open(); welcome(socket); await connected;
  socket.bufferedAmount = 100000;
  assert.equal(client.action({ kind: 'purchase', purchase: 'shotgun' }), null);
  assert.equal(socket.sent.length, 1);
  socket.bufferedAmount = 0;
  client.start();
  assert.deepEqual(socket.sent.map(message => message.type), ['create', 'start']);
});
