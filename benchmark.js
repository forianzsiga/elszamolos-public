import { execSync } from 'child_process';

const PROJECT_ID = 'project-8d9adeca-e0f3-4057-801';
const REGION = 'us-east4';
const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
];

const PROMPT = "Write a detailed, 500-line essay on the history, architecture, and future of artificial intelligence. Be as comprehensive, verbose, and detailed as possible.";

function getAccessToken() {
  try {
    return execSync('/usr/bin/env gcloud auth print-access-token').toString().trim();
  } catch (error) {
    console.error('Error getting access token from gcloud:', error.message);
    process.exit(1);
  }
}

function countTokensApprox(text) {
  // 1 token ~ 4 characters
  return Math.round(text.length / 4);
}

function getRequestBody() {
  return {
    contents: {
      role: 'user',
      parts: { text: PROMPT }
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048
    }
  };
}

function processResponseData(rawTextBuffer) {
  let parsedArray;
  try {
    parsedArray = JSON.parse(rawTextBuffer.trim());
  } catch (parseError) {
    // If JSON.parse fails, it might be due to incomplete streaming chunks not being a valid array. 
    // We attempt to wrap it as an array to recover data.
    console.warn(`⚠️ Warning: Failed to parse complete buffer as standard JSON array (${parseError.message}). Attempting cleanup...`);
    let cleaned = rawTextBuffer.trim();
    if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
    if (!cleaned.endsWith(']')) cleaned = cleaned + ']';
    parsedArray = JSON.parse(cleaned);
  }

  let generatedText = '';
  let outputTokens = 0;

  for (const chunk of parsedArray) {
    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      generatedText += text;
    }
    if (chunk.usageMetadata?.candidatesTokenCount) {
      outputTokens = chunk.usageMetadata.candidatesTokenCount;
    }
  }

  if (outputTokens === 0) {
    outputTokens = countTokensApprox(generatedText);
  }
  
  return outputTokens;
}

function logStatistics(modelName, firstTokenTime, startTime, endTime, outputTokens, tps) {
    console.log(`📊 Statistics for ${modelName}:`);
    console.log(`   - Time to First Token (TTFT): ${(firstTokenTime - startTime).toFixed(2)} ms`);
    console.log(`   - Total Generation Time: ${(endTime - firstTokenTime).toFixed(2)} ms`);
    console.log(`   - Output Tokens Generated: ${outputTokens}`);
    console.log(`   - Average Tokens Per Second (TPS): ${tps} tps`);
}

async function benchmarkModel(modelName, token) {
  console.log(`\n==================================================`);
  console.log(`🚀 Benchmarking model: ${modelName}...`);
  console.log(`==================================================`);

  const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${modelName}:streamGenerateContent`;

  const requestBody = getRequestBody();

  const startTime = performance.now();
  let firstTokenTime = null;
  let rawTextBuffer = '';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Goog-User-Project': PROJECT_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      
      if (firstTokenTime === null && value) {
        firstTokenTime = performance.now();
        const ttft = (firstTokenTime - startTime).toFixed(2);
        console.log(`⏱️  Time to First Token (TTFT): ${ttft} ms`);
      }

      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      rawTextBuffer += chunkText;
      
      process.stdout.write('.');
    }

    const endTime = performance.now();
    console.log(`\n\n✅ Stream Finished. Processing response data...`);

    const outputTokens = processResponseData(rawTextBuffer);

    const generationDurationSec = (endTime - firstTokenTime) / 1000;
    const tps = (outputTokens / generationDurationSec).toFixed(2);

    logStatistics(modelName, firstTokenTime, startTime, endTime, outputTokens, tps);

    return {
      model: modelName,
      ttft: parseFloat((firstTokenTime - startTime).toFixed(2)),
      tps: parseFloat(tps),
      tokens: outputTokens,
      durationMs: parseFloat((endTime - firstTokenTime).toFixed(2))
    };

  } catch (error) {
    console.error(`❌ Error benchmarking ${modelName}:`, error.message);
    return { model: modelName, error: error.message };
  }
}

async function run() {
  const token = getAccessToken();
  const results = [];

  console.log(`🤖 Starting robust sequential Vertex AI model benchmark...`);
  console.log(`Target region: ${REGION}`);

  for (const model of MODELS) {
    const result = await benchmarkModel(model, token);
    results.push(result);
    // Cool down for 3 seconds to avoid quota throttling
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`\n==================================================`);
  console.log(`🏁 BENCHMARK COMPLETE SUMMARY`);
  console.log(`==================================================`);
  console.table(results);
}

run();
