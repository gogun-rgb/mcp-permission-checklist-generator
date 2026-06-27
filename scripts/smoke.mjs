const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("Usage: npm run smoke -- <base-url>");
  process.exit(1);
}

const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
const requestOrigin = new URL(normalizedBaseUrl).origin;

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
  const html = await pageResponse.text();
  const scriptSources = extractScriptSources(html);
  const stylesheetHrefs = extractStylesheetHrefs(html);

  assert(
    scriptSources.length > 0,
    "/ HTML should include at least one JavaScript asset"
  );
  assert(
    stylesheetHrefs.length > 0,
    "/ HTML should include at least one stylesheet asset"
  );

  for (const scriptSource of scriptSources) {
    await assertAsset(scriptSource, "JavaScript", /javascript|ecmascript/i);
  }

  for (const stylesheetHref of stylesheetHrefs) {
    await assertAsset(stylesheetHref, "CSS", /text\/css/i);
  }

  const apiResponse = await fetch(`${normalizedBaseUrl}/api/checklists/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin
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

async function assertAsset(assetPath, label, expectedContentTypePattern) {
  const assetUrl = new URL(assetPath, `${normalizedBaseUrl}/`).toString();
  const response = await fetch(assetUrl, {
    headers: {
      Origin: requestOrigin
    }
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  assert(
    response.status === 200,
    `${label} asset ${assetPath} expected 200, got ${response.status}: ${summarizeBody(body)}`
  );
  assert(
    expectedContentTypePattern.test(contentType),
    `${label} asset ${assetPath} has unexpected Content-Type "${contentType || "missing"}"`
  );
  assert(
    !contentType.includes("application/json"),
    `${label} asset ${assetPath} returned JSON instead of a static asset`
  );
  assert(
    !contentType.includes("text/html") && !looksLikeHtml(body),
    `${label} asset ${assetPath} returned the HTML fallback instead of the asset`
  );
  assert(
    !looksLikeJsonError(body),
    `${label} asset ${assetPath} returned a JSON error instead of the asset`
  );
}

function extractScriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1]
  );
}

function extractStylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((match) => /\brel=["'][^"']*\bstylesheet\b[^"']*["']/i.test(match[0]))
    .map((match) => match[0].match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean);
}

function looksLikeHtml(body) {
  const normalizedBody = body.trimStart().toLowerCase();
  return normalizedBody.startsWith("<!doctype html") || normalizedBody.startsWith("<html");
}

function looksLikeJsonError(body) {
  try {
    const parsed = JSON.parse(body);
    return Boolean(parsed && typeof parsed === "object" && "error" in parsed);
  } catch {
    return false;
  }
}

function summarizeBody(body) {
  const normalizedBody = body.replace(/\s+/g, " ").trim();
  return normalizedBody.length > 140
    ? `${normalizedBody.slice(0, 137)}...`
    : normalizedBody;
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
