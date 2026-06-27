const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("Usage: npm run smoke -- <base-url>");
  process.exit(1);
}

const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

async function main() {
  const healthResponse = await fetch(`${normalizedBaseUrl}/health`);
  assertStatus(healthResponse, 200, "/health");
  const health = await healthResponse.json();
  assert(health.ok === true, "/health should return { ok: true }");

  const pageResponse = await fetch(`${normalizedBaseUrl}/`);
  assertStatus(pageResponse, 200, "/");
  assert(
    pageResponse.headers.get("content-type")?.includes("text/html"),
    "/ should return HTML"
  );

  const apiResponse = await fetch(`${normalizedBaseUrl}/api/checklists/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      toolType: "github",
      toolName: "GitHub MCP",
      purpose: "Code review",
      permissionIds: ["github.read.repo_info"],
      scope: {
        type: "specific_repository",
        description: "specific_repository"
      },
      credentials: ["none"],
      automation: "approve_every_time",
      extraContext: ""
    })
  });

  assertStatus(apiResponse, 200, "/api/checklists/generate");
  const result = await apiResponse.json();
  assert(result.analysisMode === "RULE_ONLY", "Checklist should work without OpenAI");
  assert(result.riskModelVersion === "1.0.0", "Risk model version should be present");

  console.log(`Smoke test passed for ${normalizedBaseUrl}`);
}

function assertStatus(response, expectedStatus, label) {
  assert(
    response.status === expectedStatus,
    `${label} expected ${expectedStatus}, got ${response.status}`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
