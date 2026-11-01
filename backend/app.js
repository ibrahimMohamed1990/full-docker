
const http = require("node:http");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const pathname = url.pathname;

      if (pathname === "/api/health" && req.method === "GET") {
        return sendJson(res, 200, { status: "ok" });
      }

      if (pathname === "/api/tasks" && req.method === "GET") {
        const result = await pool.query(
          "SELECT id, title, completed FROM tasks ORDER BY id"
        );
        return sendJson(res, 200, result.rows);
      }

      if (pathname === "/api/tasks" && req.method === "POST") {
        const body = await readJson(req);
        const title = body.title?.trim();

        if (!title || title.length > 200) {
          return sendJson(res, 400, {
            message: "Title is required and must be at most 200 characters",
          });
        }

        const result = await pool.query(
          "INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed",
          [title]
        );

        return sendJson(res, 201, result.rows[0]);
      }

      const match = pathname.match(/^\/api\/tasks\/(\d+)$/);

      if (match) {
        const id = Number(match[1]);

        if (req.method === "PUT") {
          const body = await readJson(req);
          const fields = [];
          const values = [];

          if (Object.hasOwn(body, "title")) {
            const title = body.title?.trim();

            if (!title || title.length > 200) {
              return sendJson(res, 400, {
                message: "Invalid title",
              });
            }

            values.push(title);
            fields.push(`title = $${values.length}`);
          }

          if (Object.hasOwn(body, "completed")) {
            if (typeof body.completed !== "boolean") {
              return sendJson(res, 400, {
                message: "completed must be a boolean",
              });
            }

            values.push(body.completed);
            fields.push(`completed = $${values.length}`);
          }

          if (fields.length === 0) {
            return sendJson(res, 400, {
              message: "Provide title or completed",
            });
          }

          values.push(id);

          const result = await pool.query(
            `UPDATE tasks SET ${fields.join(", ")}
             WHERE id = $${values.length}
             RETURNING id, title, completed`,
            values
          );

          if (result.rowCount === 0) {
            return sendJson(res, 404, { message: "Task not found" });
          }

          return sendJson(res, 200, result.rows[0]);
        }

        if (req.method === "DELETE") {
          const result = await pool.query(
            "DELETE FROM tasks WHERE id = $1 RETURNING id",
            [id]
          );

          if (result.rowCount === 0) {
            return sendJson(res, 404, { message: "Task not found" });
          }

          return sendJson(res, 200, {
            message: "Task deleted",
            id,
          });
        }
      }

      return sendJson(res, 404, { message: "Route not found" });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { message: "Invalid JSON body" });
      }

      console.error(error);
      return sendJson(res, 500, { message: "Internal server error" });
    }
  });

  server.listen(3000, "0.0.0.0", () => {
    console.log("Backend running on port 3000");
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;

      if (data.length > 100_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new SyntaxError("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

start().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
