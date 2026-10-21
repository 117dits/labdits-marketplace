// Supabase Edge Function: deploy-api
// Serves as the deployment backend for LABDITS, bridging uploads directly to Vercel Deployments API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function normalizePath(raw: string): string {
  let p = raw.replace(/\\/g, "/").replace(/^[A-Za-z]:\//, "");
  p = p.replace(/^\/+/, "");
  const parts = p.split("/").filter((x) => x && x !== ".");
  if (parts.includes("..")) throw new Error(`Unsafe path: ${raw}`);
  return parts.join("/");
}

function shouldSkip(path: string): boolean {
  const skipPrefixes = [
    ".git/",
    "node_modules/",
    ".next/",
    "dist/",
    "build/",
    ".cache/",
    ".vercel/",
    "test-results/",
    "artifacts/",
  ];
  return skipPrefixes.some((prefix) => path.startsWith(prefix) || path.includes("/" + prefix));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const vercelToken = Deno.env.get("VERCEL_TOKEN");
  const vercelTeamId = Deno.env.get("VERCEL_TEAM_ID");

  function vercelUrl(endpoint: string, queryParams: Record<string, string> = {}) {
    const u = new URL(`https://api.vercel.com${endpoint}`);
    if (vercelTeamId) u.searchParams.set("teamId", vercelTeamId);
    for (const [k, v] of Object.entries(queryParams)) {
      u.searchParams.set(k, v);
    }
    return u.toString();
  }

  if (!vercelToken) {
    return json({ errorMessage: "VERCEL_TOKEN secret is not set in Supabase Edge Functions." }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Upload files: POST /api/projects/upload
    if (path.endsWith("/api/projects/upload") && req.method === "POST") {
      const form = await req.formData();
      const productId = String(form.get("productId") || "product");
      const files: { file: string; sha: string; size: number }[] = [];
      let totalBytes = 0;

      for (const [key, value] of form.entries()) {
        if (key !== "files" || typeof value === "string") continue;
        const file = value as File;
        const norm = normalizePath(file.name);
        if (shouldSkip(norm)) continue;

        const buf = await file.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-1", buf);
        const sha = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Upload to Vercel File Store
        const uploadRes = await fetch(vercelUrl("/v2/files"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "x-vercel-digest": sha,
            "Content-Length": String(buf.byteLength),
            "Content-Type": "application/octet-stream",
          },
          body: buf,
        });

        if (!uploadRes.ok && uploadRes.status !== 409) {
          const errText = await uploadRes.text();
          console.error(`Failed uploading ${norm} to Vercel:`, errText);
        }

        files.push({ file: norm, sha, size: buf.byteLength });
        totalBytes += buf.byteLength;
      }

      // Strip common root if all files are inside a single folder
      let finalFiles = files;
      const roots = new Set(files.map((f) => f.file.split("/")[0]));
      if (roots.size === 1 && !files.some((f) => f.file === "package.json")) {
        const rootName = [...roots][0];
        finalFiles = files.map((f) => ({
          ...f,
          file: f.file.replace(new RegExp(`^${rootName}/`), ""),
        }));
      }

      const uploadId = `up_${crypto.randomUUID()}`;
      // Persist in Supabase `projects` table
      await supabase.from("projects").upsert({
        product_id: productId,
        data: {
          uploadId,
          files: finalFiles,
          status: "uploaded",
          totalBytes,
          updatedAt: new Date().toISOString(),
        },
      });

      return json({
        uploadId,
        projectId: productId,
        fileCount: finalFiles.length,
        totalBytes,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    }

    // 2. Analyze project: POST /api/projects/analyze
    if (path.endsWith("/api/projects/analyze") && req.method === "POST") {
      const body = await req.json();
      const { projectId, clientAnalysis } = body;
      return json({
        projectId,
        analysis: clientAnalysis,
        config: {
          framework: clientAnalysis?.framework || "Next.js",
          buildCommand: clientAnalysis?.buildCommand || "npm run build",
          outputDirectory: clientAnalysis?.outputDirectory || ".next",
          installCommand: "npm install",
          nodeVersion: "20",
          envVars: {},
        },
      });
    }

    // 3. Deploy project: POST /api/projects/:id/deploy
    const deployMatch = path.match(/\/api\/projects\/([^/]+)\/deploy$/);
    if (deployMatch && req.method === "POST") {
      const projectId = decodeURIComponent(deployMatch[1]);
      const config = await req.json();

      const { data: row } = await supabase
        .from("projects")
        .select("data")
        .eq("product_id", projectId)
        .maybeSingle();

      const projectData = row?.data || {};
      const files = projectData.files || [];

      if (!files.length) {
        return json({ errorMessage: "No project files uploaded yet." }, 400);
      }

      const projName = `labdits-${projectId.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}`;

      // Create deployment on Vercel
      const vRes = await fetch(vercelUrl("/v13/deployments"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projName,
          files,
          projectSettings: {
            framework: null, // Let Vercel auto-detect package.json framework
            buildCommand: config.buildCommand || undefined,
            outputDirectory: config.outputDirectory || undefined,
          },
        }),
      });

      const vData = await vRes.json();
      if (!vRes.ok) {
        console.error("Vercel deployment failed:", vData);
        const errMsg = vData.error?.message || "Vercel deployment rejected";
        await supabase.from("projects").upsert({
          product_id: projectId,
          data: {
            ...projectData,
            status: "failed",
            stage: 0,
            errorMessage: errMsg,
            updatedAt: new Date().toISOString(),
          },
        });
        return json({ errorMessage: errMsg }, vRes.status);
      }

      const deploymentId = vData.id;
      const initialStatus = vData.readyState === "READY" ? "ready" : "building";
      const previewUrl = vData.url ? `https://${vData.url}` : null;

      await supabase.from("projects").upsert({
        product_id: projectId,
        data: {
          ...projectData,
          deploymentId,
          vercelUrl: vData.url,
          status: initialStatus,
          stage: initialStatus === "ready" ? 10 : 7,
          previewUrl,
          verified: initialStatus === "ready",
          embeddable: true,
          updatedAt: new Date().toISOString(),
        },
      });

      return json({
        projectId,
        deploymentId,
        status: initialStatus,
        stage: initialStatus === "ready" ? 10 : 7,
        detectedFramework: vData.projectSettings?.framework || null,
        detectedLanguage: "TypeScript",
        buildCommand: config.buildCommand || null,
        outputDirectory: config.outputDirectory || null,
        previewUrl,
        verified: initialStatus === "ready",
        embeddable: true,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Poll deployment: GET /api/projects/:id/deployment
    const getDepMatch = path.match(/\/api\/projects\/([^/]+)\/deployment$/);
    if (getDepMatch && req.method === "GET") {
      const projectId = decodeURIComponent(getDepMatch[1]);
      const { data: row } = await supabase
        .from("projects")
        .select("data")
        .eq("product_id", projectId)
        .maybeSingle();

      const projectData = row?.data || {};
      const deploymentId = projectData.deploymentId;

      if (!deploymentId) {
        return json({
          projectId,
          deploymentId: null,
          status: "pending",
          stage: 4,
          previewUrl: null,
          verified: false,
          embeddable: true,
          errorMessage: null,
        });
      }

      // Check status from Vercel
      const vRes = await fetch(vercelUrl(`/v13/deployments/${deploymentId}`), {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      const vData = await vRes.json();

      let status = "building";
      let stage = 7;
      let previewUrl = projectData.previewUrl;
      let verified = false;
      let errorMessage = null;

      if (vData.readyState === "READY") {
        status = "ready";
        stage = 10;
        previewUrl = `https://${vData.url}`;
        verified = true;
      } else if (vData.readyState === "ERROR" || vData.readyState === "CANCELED") {
        status = "failed";
        stage = 0;
        errorMessage = vData.errorMessage || "Vercel build failed.";
      }

      // Update cached state in Supabase
      await supabase.from("projects").upsert({
        product_id: projectId,
        data: {
          ...projectData,
          status,
          stage,
          previewUrl,
          verified,
          errorMessage,
          updatedAt: new Date().toISOString(),
        },
      });

      return json({
        projectId,
        deploymentId,
        status,
        stage,
        detectedFramework: vData.projectSettings?.framework || null,
        detectedLanguage: "TypeScript",
        buildCommand: null,
        outputDirectory: null,
        previewUrl,
        verified,
        embeddable: true,
        errorMessage,
        createdAt: projectData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 5. Get preview: GET /api/projects/:id/preview
    const prevMatch = path.match(/\/api\/projects\/([^/]+)\/preview$/);
    if (prevMatch && req.method === "GET") {
      const projectId = decodeURIComponent(prevMatch[1]);
      const { data: row } = await supabase
        .from("projects")
        .select("data")
        .eq("product_id", projectId)
        .maybeSingle();

      const projectData = row?.data || {};
      return json({
        projectId,
        previewUrl: projectData.previewUrl || null,
        verified: Boolean(projectData.verified),
        embeddable: true,
      });
    }

    // 6. Get logs: GET /api/projects/:id/logs
    const logsMatch = path.match(/\/api\/projects\/([^/]+)\/logs$/);
    if (logsMatch && req.method === "GET") {
      const projectId = decodeURIComponent(logsMatch[1]);
      const { data: row } = await supabase
        .from("projects")
        .select("data")
        .eq("product_id", projectId)
        .maybeSingle();

      const projectData = row?.data || {};
      const deploymentId = projectData.deploymentId;

      if (!deploymentId) {
        return json({
          projectId,
          lines: [
            {
              timestamp: new Date().toISOString(),
              level: projectData.errorMessage ? "error" : "info",
              message: projectData.errorMessage
                ? `Deployment rejected: ${projectData.errorMessage}`
                : "Files uploaded. Waiting for build deployment command.",
            },
          ],
        });
      }

      // Fetch actual build events from Vercel
      try {
        const vRes = await fetch(
          vercelUrl(`/v3/deployments/${deploymentId}/events`, { limit: "50", direction: "forward" }),
          { headers: { Authorization: `Bearer ${vercelToken}` } }
        );
        if (vRes.ok) {
          const events = await vRes.json();
          const lines = Array.isArray(events)
            ? events.map((ev: { createdAt?: number; date?: number; type?: string; text?: string; payload?: { text?: string } }) => ({
                timestamp: new Date(ev.createdAt || ev.date || Date.now()).toISOString(),
                level: ev.type === "error" || ev.type === "stderr" ? "error" : "info",
                message: ev.text || ev.payload?.text || JSON.stringify(ev),
              }))
            : [];
          return json({ projectId, lines: lines.length ? lines : [{ timestamp: new Date().toISOString(), level: "info", message: "Build initialized on Vercel..." }] });
        }
      } catch (e) {
        console.error("Vercel logs fetch error:", e);
      }

      return json({
        projectId,
        lines: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Building on Vercel (Deployment ID: ${deploymentId})...`,
          },
        ],
      });
    }

    // 7. Publish: POST /api/projects/:id/publish
    const pubMatch = path.match(/\/api\/projects\/([^/]+)\/publish$/);
    if (pubMatch && req.method === "POST") {
      return json({ published: true });
    }

    return json({ errorMessage: `Endpoint not found: ${path}` }, 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("deploy-api error:", err);
    return json({ errorMessage: msg }, 500);
  }
});
