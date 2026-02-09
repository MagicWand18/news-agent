import http from "node:http";

const PORT = parseInt(process.env.HEALTH_PORT || "3001", 10);

let server: http.Server | null = null;

/**
 * Servidor HTTP mínimo para healthcheck de Docker.
 * Si el event loop está congelado, el servidor no responde y Docker lo marca unhealthy.
 */
export function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        const payload = JSON.stringify({
          status: "healthy",
          uptime: process.uptime(),
          pid: process.pid,
          memoryUsage: process.memoryUsage().rss,
          timestamp: new Date().toISOString(),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(payload);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(PORT, () => {
      console.log(`🏥 Health server listening on port ${PORT}`);
      resolve();
    });

    server.on("error", (err) => {
      console.error(`[Health] Error starting health server:`, err);
      reject(err);
    });
  });
}

export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      console.log("[Health] Server stopped");
      resolve();
    });
  });
}
