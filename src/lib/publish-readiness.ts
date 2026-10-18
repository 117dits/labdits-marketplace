import { isDeploymentLive, type Product } from "@/types";

/** Returns blocking issues; empty array means the product may be published. */
export function publishReadiness(p: Product): string[] {
  const issues: string[] = [];
  if (!p.name.trim() || !p.slug.trim()) issues.push("Add a product name and slug.");
  if (!p.description.trim()) issues.push("Add a product description.");
  if (!(p.price > 0)) issues.push("Set a personal license price.");
  const externalDemo =
    p.demoMode !== "mock" && typeof p.demoUrl === "string" && /^https:\/\//.test(p.demoUrl);
  if (p.project && !isDeploymentLive(p.project.deployment))
    issues.push(
      "Live demo not confirmed: the deployment backend must return a verified preview URL before publishing.",
    );
  else if (!p.project && !externalDemo)
    issues.push(
      "Add and deploy a supported project, or configure a public HTTPS demo URL before publishing.",
    );
  return issues;
}
