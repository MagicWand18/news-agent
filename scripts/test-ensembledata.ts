/**
 * Script para probar los endpoints de EnsembleData API
 *
 * Uso:
 *   ENSEMBLEDATA_TOKEN=tu_token npx ts-node scripts/test-ensembledata.ts
 *
 * O agregar ENSEMBLEDATA_TOKEN al .env y ejecutar:
 *   npx ts-node scripts/test-ensembledata.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.ENSEMBLEDATA_TOKEN;
const BASE_URL = "https://ensembledata.com/apis";

if (!TOKEN) {
  console.error("❌ Error: ENSEMBLEDATA_TOKEN no está configurado");
  console.log("\nPara obtener un token:");
  console.log("1. Regístrate en https://ensembledata.com");
  console.log("2. Verifica tu email");
  console.log("3. Copia el token del dashboard");
  console.log("\nLuego ejecuta:");
  console.log("ENSEMBLEDATA_TOKEN=tu_token npx ts-node scripts/test-ensembledata.ts");
  process.exit(1);
}

interface TestResult {
  endpoint: string;
  platform: string;
  success: boolean;
  statusCode?: number;
  dataCount?: number;
  error?: string;
  responseTime?: number;
  rawResponse?: string;
}

async function testEndpoint(
  name: string,
  platform: string,
  endpoint: string,
  params: Record<string, string>
): Promise<TestResult> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("token", TOKEN!);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const startTime = Date.now();

  try {
    console.log(`\n🔄 Testing ${platform} - ${name}...`);
    console.log(`   URL: ${endpoint}?${Object.entries(params).map(([k,v]) => `${k}=${v}`).join("&")}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const responseTime = Date.now() - startTime;
    const text = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.log(`   ❌ Error ${response.status}: ${text.substring(0, 200)}`);
      return {
        endpoint: name,
        platform,
        success: false,
        statusCode: response.status,
        error: text.substring(0, 100),
        responseTime,
        rawResponse: text.substring(0, 300),
      };
    }

    // Contar resultados según la estructura de respuesta
    let dataCount = 0;
    if (data.data) {
      if (Array.isArray(data.data)) {
        dataCount = data.data.length;
      } else if (typeof data.data === "object") {
        dataCount = 1;
      }
    } else if (Array.isArray(data)) {
      dataCount = data.length;
    } else if (typeof data === "object" && Object.keys(data).length > 0) {
      dataCount = 1;
    }

    console.log(`   ✅ Success! ${dataCount} items, ${responseTime}ms`);
    console.log(`   Units charged: ${data.units_charged || 0}`);

    // Mostrar preview de los datos
    const preview = JSON.stringify(data).substring(0, 200);
    console.log(`   Preview: ${preview}...`);

    return {
      endpoint: name,
      platform,
      success: true,
      statusCode: response.status,
      dataCount,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Exception: ${errorMsg}`);
    return {
      endpoint: name,
      platform,
      success: false,
      error: errorMsg,
      responseTime,
    };
  }
}

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        EnsembleData API Endpoint Tests                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nToken: ${TOKEN!.substring(0, 8)}...${TOKEN!.substring(TOKEN!.length - 4)}`);

  const results: TestResult[] = [];

  // ==================== TWITTER ====================
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━ TWITTER ━━━━━━━━━━━━━━━━━━━━");

  // Probar con 'name' en lugar de 'username'
  results.push(await testEndpoint(
    "User Info (name param)",
    "Twitter",
    "/twitter/user/info",
    { name: "elaboratorio_" }
  ));

  await delay(500);

  // Probar user tweets con ID numérico conocido
  results.push(await testEndpoint(
    "User Tweets (by ID)",
    "Twitter",
    "/twitter/user/tweets",
    { id: "50393960" }
  ));

  // ==================== INSTAGRAM ====================
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━ INSTAGRAM ━━━━━━━━━━━━━━━━━━");

  await delay(500);

  // Probar diferentes paths de Instagram
  results.push(await testEndpoint(
    "User Info (/instagram/user/info)",
    "Instagram",
    "/instagram/user/info",
    { username: "natgeo" }
  ));

  await delay(500);

  results.push(await testEndpoint(
    "User Posts (/instagram/user/posts)",
    "Instagram",
    "/instagram/user/posts",
    { user_id: "787132" }
  ));

  // ==================== TIKTOK ====================
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━ TIKTOK ━━━━━━━━━━━━━━━━━━━━");

  await delay(500);

  // Probar TikTok con path diferente
  results.push(await testEndpoint(
    "User Info (/tt/user/info)",
    "TikTok",
    "/tt/user/info",
    { username: "tiktok" }
  ));

  await delay(500);

  results.push(await testEndpoint(
    "User Posts (/tt/user/posts)",
    "TikTok",
    "/tt/user/posts",
    { username: "tiktok", depth: "1" }
  ));

  await delay(500);

  results.push(await testEndpoint(
    "Hashtag Search",
    "TikTok",
    "/tt/hashtag/posts",
    { name: "technology", depth: "1" }
  ));

  await delay(500);

  // Probar keyword con name y period
  results.push(await testEndpoint(
    "Keyword Search (with name+period)",
    "TikTok",
    "/tt/keyword/search",
    { name: "technology", period: "7" }
  ));

  // ==================== RESUMEN ====================
  console.log("\n\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                        RESUMEN                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total: ${results.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  console.log("\n┌─────────────┬────────────────────────────────┬─────────┬───────────┬──────────┐");
  console.log("│ Platform    │ Endpoint                       │ Status  │ Items     │ Time     │");
  console.log("├─────────────┼────────────────────────────────┼─────────┼───────────┼──────────┤");

  for (const r of results) {
    const platform = r.platform.padEnd(11);
    const endpoint = r.endpoint.padEnd(30);
    const status = r.success ? "✅ OK   " : "❌ FAIL ";
    const items = (r.dataCount?.toString() || "-").padEnd(9);
    const time = `${r.responseTime || 0}ms`.padEnd(8);
    console.log(`│ ${platform} │ ${endpoint} │ ${status} │ ${items} │ ${time} │`);
  }

  console.log("└─────────────┴────────────────────────────────┴─────────┴───────────┴──────────┘");

  if (failed > 0) {
    console.log("\n⚠️  Algunos endpoints fallaron. Revisar errores arriba.");

    console.log("\n📋 Errores detallados:");
    for (const r of results.filter(r => !r.success)) {
      console.log(`\n${r.platform} - ${r.endpoint}:`);
      console.log(`  Error: ${r.error}`);
      if (r.rawResponse) {
        console.log(`  Response: ${r.rawResponse}`);
      }
    }
  } else {
    console.log("\n🎉 ¡Todos los endpoints funcionan correctamente!");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runTests().catch(console.error);
