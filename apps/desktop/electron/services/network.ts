import net from "net";

/**
 * Checks if a TCP port is open and reachable on 127.0.0.1.
 */
export function isPortOpen(port: number): Promise<boolean> {
  if (!port || isNaN(port) || port <= 0 || port > 65535) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = (isOpen: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(600);
    socket.once("connect", () => cleanup(true));
    socket.once("timeout", () => cleanup(false));
    socket.once("error", () => cleanup(false));

    try {
      socket.connect(port, "127.0.0.1");
    } catch {
      cleanup(false);
    }
  });
}
