import dotenv from "dotenv";
import { spawnSync } from "node:child_process";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

function main() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "nowsome-469ec";

  // Use `firebase login` credentials — NOT the Firestore service account.
  // The service account can read/write data but cannot deploy indexes.
  const env = { ...process.env };
  delete env.GOOGLE_APPLICATION_CREDENTIALS;

  console.log(`Deploying Firestore indexes to ${projectId} (database: council-hr-dashboard)...`);
  console.log("Using Firebase CLI login — run `npm run firebase:login` first if this fails.\n");

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "-y",
      "firebase-tools@latest",
      "deploy",
      "--only",
      "firestore:indexes",
      "--project",
      projectId,
    ],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: true,
    },
  );

  if (result.status !== 0) {
    console.error(
      "\nIf deploy failed, create indexes manually:\n" +
        "Firebase Console → Firestore → council-hr-dashboard → Indexes → Add index\n" +
        "Or run: npm run firebase:login\n" +
        "Then: npm run firestore:indexes\n",
    );
    process.exit(result.status ?? 1);
  }
}

main();
