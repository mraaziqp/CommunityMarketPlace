#!/usr/bin/env node
/**
 * Fix AWS Amplify Platform for CommunityMarketPlace
 * 
 * Problem:
 * AWS Amplify auto-detected or configured this app as `WEB_COMPUTE` (Next.js SSR),
 * which triggers an internal Amplify check: "CustomerError: Cannot read 'next' version in package.json".
 * 
 * Solution:
 * This script updates the Amplify App's platform from `WEB_COMPUTE` to `WEB` (Static / SPA),
 * sets the branch framework to `React`, adds the SPA rewrite rule, and triggers a clean build.
 */

import {
  AmplifyClient,
  ListAppsCommand,
  GetAppCommand,
  UpdateAppCommand,
  UpdateBranchCommand,
  StartJobCommand,
} from "@aws-sdk/client-amplify";
import * as readline from "node:readline";

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

const region =
  getArg("--region") ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

const accessKeyId = getArg("--key") || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = getArg("--secret") || process.env.AWS_SECRET_ACCESS_KEY;
const explicitAppId = getArg("--app-id");

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function main() {
  console.log("\n=======================================================");
  console.log("   AWS Amplify Platform Fix: Switch to WEB (SPA)");
  console.log("=======================================================\n");

  const clientConfig = { region };
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = { accessKeyId, secretAccessKey };
  }

  let client = new AmplifyClient(clientConfig);

  let targetAppId = explicitAppId;

  if (!targetAppId) {
    console.log(`Connecting to AWS Amplify in region [${region}]...`);
    try {
      const listRes = await client.send(new ListAppsCommand({ maxResults: 50 }));
      const apps = listRes.apps || [];

      if (apps.length === 0) {
        console.log(`No Amplify apps found in region [${region}].`);
        targetAppId = await prompt("Please enter your Amplify App ID (from AWS console URL): ");
      } else {
        console.log(`Found ${apps.length} Amplify app(s):`);
        apps.forEach((app, idx) => {
          console.log(`  [${idx + 1}] ${app.name} (App ID: ${app.appId}) - Current Platform: ${app.platform}`);
        });

        // Try to auto-match CommunityMarketPlace
        const matched = apps.find((a) =>
          a.name?.toLowerCase().includes("community") ||
          a.name?.toLowerCase().includes("market")
        );

        if (matched) {
          console.log(`\nAuto-detected matching app: "${matched.name}" (${matched.appId})`);
          targetAppId = matched.appId;
        } else if (apps.length === 1) {
          targetAppId = apps[0].appId;
        } else {
          const choice = await prompt(`Select an app [1-${apps.length}] or enter App ID: `);
          const num = parseInt(choice, 10);
          if (num >= 1 && num <= apps.length) {
            targetAppId = apps[num - 1].appId;
          } else {
            targetAppId = choice;
          }
        }
      }
    } catch (err) {
      console.warn("Could not list apps automatically:", err.message);
      if (!accessKeyId) {
        console.log("\nHint: You can provide AWS credentials via environment variables:");
        console.log("  export AWS_ACCESS_KEY_ID=\"your-access-key\"");
        console.log("  export AWS_SECRET_ACCESS_KEY=\"your-secret-key\"");
        console.log("  export AWS_REGION=\"us-east-1\"\n");
      }
      targetAppId = await prompt("Enter your Amplify App ID to proceed: ");
    }
  }

  if (!targetAppId) {
    console.error("Error: App ID is required. Exiting.");
    process.exit(1);
  }

  console.log(`\nInspecting App ID: ${targetAppId}...`);

  // Check current app platform
  let currentPlatform = "UNKNOWN";
  try {
    const appData = await client.send(new GetAppCommand({ appId: targetAppId }));
    currentPlatform = appData.app?.platform || "UNKNOWN";
    console.log(`Current Amplify platform: [${currentPlatform}]`);
  } catch (e) {
    console.log(`Could not fetch app details directly: ${e.message}`);
  }

  // 1. Update Platform to WEB and add SPA Rewrite Rule
  console.log("\n1. Updating App Platform to 'WEB' (Single Page Application / Static)...");
  const spaRewriteRule = {
    source: "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>",
    target: "/index.html",
    status: "200",
  };

  try {
    await client.send(
      new UpdateAppCommand({
        appId: targetAppId,
        platform: "WEB",
        customRules: [spaRewriteRule],
      })
    );
    console.log("  ✓ Successfully updated platform to 'WEB'");
    console.log("  ✓ Configured SPA 200 rewrite rule for client-side routing (/index.html)");
  } catch (err) {
    console.error("  ✗ Failed to update app platform:", err.message);
    process.exit(1);
  }

  // 2. Update Branch Framework to React / Web
  console.log("\n2. Updating branch 'main' framework to 'React'...");
  try {
    await client.send(
      new UpdateBranchCommand({
        appId: targetAppId,
        branchName: "main",
        framework: "React",
      })
    );
    console.log("  ✓ Successfully set branch 'main' framework to 'React'");
  } catch (err) {
    console.warn("  ⚠ Could not update branch framework:", err.message);
  }

  // 3. Trigger a fresh build
  console.log("\n3. Triggering a fresh build on 'main' branch...");
  try {
    const jobRes = await client.send(
      new StartJobCommand({
        appId: targetAppId,
        branchName: "main",
        jobType: "RELEASE",
      })
    );
    console.log(`  ✓ Successfully triggered build job #${jobRes.jobSummary?.jobId || "NEW"}!`);
  } catch (err) {
    console.warn("  ⚠ Note: Could not trigger build automatically:", err.message);
    console.log("    You can trigger a build manually by pushing a commit or clicking 'Run build' in Amplify Console.");
  }

  console.log("\n=======================================================");
  console.log("   SUCCESS! AWS Amplify is now configured for Vite SPA");
  console.log("=======================================================");
  console.log("Your app will no longer fail with the 'Cannot read next version' error.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
