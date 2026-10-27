// Browser-only test transport. Production builds never resolve this module.
import type { Lobby as LobbyType } from "../../src/lib/multiplayer";
export type Lobby = LobbyType;
export async function connection() {
  return {
    channel(topic: string) {
      const bus = new BroadcastChannel(topic);
      const handlers = new Map<string, (data: unknown) => void>();
      bus.onmessage = (event) => handlers.get(event.data.event)?.({ payload: event.data.payload });
      const channel = {
        on(type: string, filter: { event: string }, callback: (data: unknown) => void) {
          if (type === "broadcast") handlers.set(filter.event, callback);
          return channel;
        },
        subscribe(callback: (status: string) => void) {
          queueMicrotask(() => callback("SUBSCRIBED"));
          return channel;
        },
        send(message: unknown) {
          bus.postMessage(message);
          return Promise.resolve("ok");
        },
        track() {
          return Promise.resolve();
        },
        presenceState() {
          return {};
        },
        close() {
          bus.close();
        },
      };
      return channel;
    },
    removeChannel(channel: { close: () => void }) {
      channel.close();
    },
  };
}
export const multiplayerConfigured = false;
export async function lobbyAction() {
  return null;
}
export async function lobbyPlayerId() {
  return null;
}
