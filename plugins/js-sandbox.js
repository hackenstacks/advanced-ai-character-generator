// js-sandbox — NeXuS Characters Plugin
// Executes ```js code blocks from AI responses and injects output back into the thread.
// Converted from OpenCharacters oc.thread pattern → nexus.hooks pattern.
//
// Install: paste this entire file into the character's Plugin Code field.

nexus.hooks.register("afterResponseGenerate", async function(data) {
  const content = data?.content ?? "";

  // Extract all ```js or ``` code blocks
  const codeChunks = [...content.matchAll(/```(?:js|javascript)?\n([\s\S]+?)```/g)]
    .map(c => c[1].trim());

  if (codeChunks.length === 0) {
    // Warn if message looks like it should have had code but didn't
    const looksLikeCode = /;\n|console\.log|\blet |\bconst |\bfetch\(|nexus\./s.test("\n" + content + "\n");
    if (looksLikeCode) {
      data.sandboxOutput = "(No code blocks detected. Wrap code in triple backticks.)";
    }
    return data;
  }

  // Sandboxed console
  const returnData = [];

  const sandboxConsole = {
    log: (...args) => {
      returnData.push(
        ...args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))
      );
    },
    error: (...args) => {
      returnData.push(
        ...args.map(a => (a?.message && a?.stack) ? `${a.message}\n${a.stack}` : String(a))
      );
    },
    warn: (...args) => {
      returnData.push("[warn] " + args.map(a => String(a)).join(" "));
    }
  };

  // Uncaught error buffer
  const uncaughtErrors = [];

  const combined = codeChunks.join("\n\n");

  try {
    // Worker scope — no window/DOM, but we can simulate console
    // Use Function constructor to isolate scope, inject sandboxed console
    const fn = new Function("console", "nexus", `
      return (async function() {
        ${combined}
      })();
    `);
    await fn(sandboxConsole, nexus);
  } catch (e) {
    uncaughtErrors.push(`Error: ${e.message}`);
  }

  const allOutput = [...returnData, ...uncaughtErrors].join("\n\n").trim();

  let result;
  if (allOutput) {
    result = "```\n" + allOutput + "\n```";
  } else if (combined.includes("console.log")) {
    result = "(Code executed successfully, but console.log produced no output.)";
  } else {
    result = "(Code executed successfully. Add console.log() to see output.)";
  }

  // Attach output to data so ChatInterface can inject it as a narrator/system message
  data.sandboxOutput = result;

  return data;
});
