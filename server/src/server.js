import app from "./app.js";
import { startSchedulers } from "./queues/index.js";

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API on http://localhost:${port}`));

if (process.env.RUN_WORKER !== "false") {
  const { startWorker } = await import("./workers/index.js");
  startWorker();
  await startSchedulers();
}
