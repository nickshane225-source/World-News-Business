import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashAdminPassword } from "../src/lib/password.js";
const rl = createInterface({ input: stdin, output: stdout });
try {
  const password = await rl.question("Admin password (terminal input may be visible): ");
  console.log("\nADMIN_PASSWORD_HASH=" + await hashAdminPassword(password));
  console.log("Set ALLOW_LEGACY_ADMIN_PASSWORD=false and remove ADMIN_PASSWORD after deploying the hash.");
} finally { rl.close(); }
