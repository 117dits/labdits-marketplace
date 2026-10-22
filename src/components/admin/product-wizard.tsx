import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileArchive,
  FolderOpen,
  ImagePlus,
  Info,
  LoaderCircle,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AdminHeading } from "@/components/admin/admin-pages";
import { ProjectUploader } from "@/components/admin/project-uploader";
import { ProductCard } from "@/components/products/product-card";
import { useMarketplace } from "@/hooks/use-marketplace";
import { categories, seedProducts } from "@/data/products";
import { publishReadiness } from "@/lib/publish-readiness";
import { mockService } from "@/services/mock-service";
import type { Product } from "@/types";

const steps = [
  "Basic information",
  "Project & deployment",
  "Demo configuration",
  "Pricing",
  "Publish",
];
const FILE_PREVIEW_LIMIT = 10;

type UploadFile = {
  name: string;
  valid: boolean;
  reason: string;
  size: number;
};

type SelectedFile = {
  file: File;
  path: string;
};

type FileEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (callback: (file: File) => void, error?: () => void) => void;
  createReader?: () => {
    readEntries: (callback: (entries: FileEntry[]) => void, error?: () => void) => void;
  };
};

function inputFiles(list: FileList | null): SelectedFile[] {
  return Array.from(list ?? []).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }));
}

async function readEntry(entry: FileEntry, parent = ""): Promise<SelectedFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject));
    return [{ file, path }];
  }

  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const entries: FileEntry[] = [];
  while (true) {
    const batch = await new Promise<FileEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (!batch.length) break;
    entries.push(...batch);
  }
  return (await Promise.all(entries.map((child) => readEntry(child, path)))).flat();
}

async function droppedFiles(dataTransfer: DataTransfer) {
  const entries = Array.from(dataTransfer.items)
    .map((item) =>
      (
        item as unknown as { webkitGetAsEntry?: () => FileEntry | null }
      ).webkitGetAsEntry?.(),
    )
    .filter((entry): entry is FileEntry => Boolean(entry));

  if (!entries.length) {
    return { files: inputFiles(dataTransfer.files), includesFolder: false };
  }

  return {
    files: (await Promise.all(entries.map((entry) => readEntry(entry)))).flat(),
    includesFolder: entries.some((entry) => entry.isDirectory),
  };
}

export function ProductWizard({ id }: { id?: string }) {
  const store = useMarketplace();
  const existing = store.products.find((product) => product.id === id);
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Product>(
    () =>
      existing || {
        ...(seedProducts[0] ?? { image: "", theme: "mint", version: "1.0.0", updated: "" }),
        id: "",
        slug: "",
        name: "",
        subtitle: "",
        description: "",
        category: categories[0] ?? "Custom Applications",
        features: [],
        stack: ["React", "TypeScript", "Tailwind CSS"],
        price: 899000,
        commercialPrice: 1798000,
        installationPrice: 2697000,
        status: "draft",
        featured: false,
        popularity: 0,
        files: [],
      },
  );
  const [feature, setFeature] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "complete">("idle");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [projectDragging, setProjectDragging] = useState(false);
  const [thumbnailDragging, setThumbnailDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing && !ready) {
      setDraft(existing);
      setFiles(
        (existing.files ?? []).map((name) => ({
          name,
          valid: true,
          reason: "Saved in this browser",
          size: 0,
        })),
      );
      setUploadStatus(existing.files?.length ? "complete" : "idle");
      setProgress(existing.files?.length ? 100 : 0);
      setReady(true);
    }
  }, [existing, ready]);

  useEffect(() => {
    if (uploadStatus !== "uploading") return;
    if (progress >= 100) {
      setUploadStatus("complete");
      return;
    }
    const timeout = window.setTimeout(
      () =>
        setProgress((current) =>
          Math.min(current + Math.max(4, Math.round((100 - current) * 0.2)), 100),
        ),
      140,
    );
    return () => window.clearTimeout(timeout);
  }, [progress, uploadStatus]);

  const update = <K extends keyof Product>(key: K, value: Product[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function updateProject(project: Product["project"]) {
    const { project: _currentProject, ...withoutProject } = draft;
    const next: Product = project ? { ...draft, project } : withoutProject;
    setDraft(next);
    if (existing) store.saveProduct(next);
  }

  async function selectFiles(selected: SelectedFile[], source: "zip" | "folder" | "drop") {
    if (!selected.length) return;
    const isZip = selected.length === 1 && Boolean(selected[0]?.file.name.toLowerCase().endsWith(".zip"));
    const isFolder =
      source === "folder" ||
      selected.some(({ file }) => Boolean(file.webkitRelativePath)) ||
      selected.length > 1;

    if (!isZip && !isFolder) {
      toast.error("Drop a ZIP archive or choose a complete project folder.");
      return;
    }

    const validation = await mockService.validateProjectFiles(selected.map(({ file }) => file));
    const nextFiles = validation.map((result, index) => ({
      ...result,
      name: selected[index]?.path ?? result.name,
      size: selected[index]?.file.size ?? 0,
    }));
    setFiles(nextFiles);
    update(
      "files",
      nextFiles.filter((file) => file.valid).map((file) => file.name),
    );

    if (nextFiles.some((file) => !file.valid)) {
      setUploadStatus("idle");
      setProgress(0);
      toast.error("Some files could not be inspected.");
      return;
    }

    setProgress(6);
    setUploadStatus("uploading");
  }

  async function handleProjectDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setProjectDragging(false);
    const dropped = await droppedFiles(event.dataTransfer);
    await selectFiles(dropped.files, dropped.includesFolder ? "folder" : "drop");
  }

  function selectThumbnail(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error("Choose a JPG, PNG, or WebP smaller than 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") update("image", reader.result);
    };
    reader.readAsDataURL(file);
    toast.success("Thumbnail preview updated.");
  }

  function thumbnail(event: ChangeEvent<HTMLInputElement>) {
    selectThumbnail(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleThumbnailDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setThumbnailDragging(false);
    selectThumbnail(event.dataTransfer.files?.[0]);
  }

  function removeFile(index: number) {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(nextFiles);
    update(
      "files",
      nextFiles.filter((file) => file.valid).map((file) => file.name),
    );
    if (!nextFiles.length) {
      setProgress(0);
      setUploadStatus("idle");
    }
  }

  function removeInvalidFiles() {
    const validFiles = files.filter((file) => file.valid);
    const removed = files.length - validFiles.length;
    setFiles(validFiles);
    update(
      "files",
      validFiles.map((file) => file.name),
    );
    setProgress(validFiles.length ? 100 : 0);
    setUploadStatus(validFiles.length ? "complete" : "idle");
    toast.success(`${removed} invalid ${removed === 1 ? "file" : "files"} removed.`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 4) {
      if (step === 0 && (!draft.name.trim() || !draft.slug.trim() || !draft.description.trim())) {
        toast.error("Add a product name, slug, and description.");
        return;
      }
      if (step === 1 && draft.project && !draft.project.uploadId) {
        toast.error("Upload the project successfully before continuing to demo configuration.");
        return;
      }
      if (step === 3 && (!draft.price || !draft.commercialPrice || !draft.installationPrice)) {
        toast.error("Complete all required prices.");
        return;
      }
      setStep((current) => current + 1);
      if (step === 1 && draft.project?.uploadId) toast.success("Upload complete. Configure your demo next.");
      return;
    }

    if (!confirmed) {
      toast.error("Confirm the frontend-only demo publication first.");
      return;
    }
    const readinessIssues = publishReadiness(draft);
    if (draft.status === "published" && readinessIssues.length) {
      toast.error(readinessIssues[0]);
      return;
    }
    if (store.products.some((product) => product.slug === draft.slug && product.id !== draft.id)) {
      toast.error("This slug is already used by another product.");
      setStep(0);
      return;
    }
    const product = {
      ...draft,
      id: draft.id || `p-${Date.now()}`,
      updated: new Date().toISOString().slice(0, 10),
      subtitle: draft.subtitle || draft.category,
    };
    store.saveProduct(product);
    toast.success(
      product.status === "published"
        ? "Product published to the marketplace!"
        : "Product saved as a draft",
    );
    navigate({ to: "/admin/products" });
  }

  if (id && !existing && store.hydrated) {
    return (
      <DashboardLayout owner title="Edit product">
        <div className="empty-state">
          <h2>Product not found</h2>
          <Button asChild>
            <Link to="/admin/products">Back to products</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const invalidCount = files.filter((file) => !file.valid).length;
  const hiddenFileCount = Math.max(files.length - FILE_PREVIEW_LIMIT, 0);
  const previewFiles = files
    .map((file, index) => ({ file, index }))
    .sort((a, b) => Number(a.file.valid) - Number(b.file.valid))
    .slice(0, FILE_PREVIEW_LIMIT);
  const isUploading = uploadStatus === "uploading";

  return (
    <DashboardLayout owner title={id ? "Edit product" : "New product"}>
      <AdminHeading
        title={id ? `Refine ${existing?.name || "your product"}.` : "Build your next bestseller."}
        description="A thoughtful product listing, from first impression to final detail."
      />
      <div className="wizard-steps">
        {steps.map((label, index) => (
          <div key={label} className={`wizard-step ${step === index ? "wizard-active" : ""}`}>
            <span>{index < step ? "✓" : `0${index + 1}`}</span>
            {label}
          </div>
        ))}
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <motion.div
          className="panel max-w-4xl"
          key={step}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h2>{steps[step]}</h2>
          {step === 0 ? (
            <div className="form-stack">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="product-name">Product name *</label>
                  <input
                    id="product-name"
                    className="form-input"
                    value={draft.name}
                    placeholder="Your next great product"
                    onChange={(event) => {
                      update("name", event.target.value);
                      if (!id) {
                        update(
                          "slug",
                          event.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, ""),
                        );
                      }
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-slug">URL slug *</label>
                  <input
                    id="product-slug"
                    className="form-input"
                    pattern="[a-z0-9-]+"
                    value={draft.slug}
                    onChange={(event) => update("slug", event.target.value)}
                    placeholder="your-product"
                  />
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="product-category">Category</label>
                  <select
                    id="product-category"
                    className="form-input"
                    value={draft.category}
                    onChange={(event) => update("category", event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="product-subtitle">Short description</label>
                  <input
                    id="product-subtitle"
                    className="form-input"
                    value={draft.subtitle}
                    onChange={(event) => update("subtitle", event.target.value)}
                    placeholder="A beautifully simple project dashboard"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="product-description">Description *</label>
                <textarea
                  id="product-description"
                  className="form-input"
                  value={draft.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="product-stack">Technology stack (comma separated)</label>
                <input
                  id="product-stack"
                  className="form-input"
                  value={draft.stack.join(", ")}
                  onChange={(event) =>
                    update(
                      "stack",
                      event.target.value.split(",").map((item) => item.trim()),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="product-feature">Product features</label>
                <div className="flex gap-2">
                  <input
                    id="product-feature"
                    className="form-input"
                    value={feature}
                    onChange={(event) => setFeature(event.target.value)}
                    placeholder="Add a key feature"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Add feature"
                    onClick={() => {
                      if (feature.trim()) {
                        update("features", [...draft.features, feature.trim()]);
                        setFeature("");
                      }
                    }}
                  >
                    <Plus />
                  </Button>
                </div>
                {draft.features.map((item, index) => (
                  <div
                    className="flex items-center justify-between text-xs"
                    key={`${item}-${index}`}
                  >
                    <span className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-success" />
                      {item}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`Remove ${item}`}
                      onClick={() =>
                        update(
                          "features",
                          draft.features.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : step === 1 ? (
            <div className="form-stack">
              <ProjectUploader
                productId={draft.id || draft.slug || "new"}
                value={draft.project}
                onChange={updateProject}
                onAutoExtracted={(extracted) => {
                  setDraft((curr) => ({
                    ...curr,
                    name: curr.name || extracted.title || curr.name,
                    slug: curr.slug || (extracted.title ? extracted.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") : curr.slug),
                    description: curr.description || extracted.description || curr.description,
                    subtitle: curr.subtitle || extracted.description?.slice(0, 50) || curr.subtitle,
                    image: extracted.thumbnail || curr.image,
                  }));
                }}
              />
              <div className="hidden" aria-hidden="true">
                <div className="notice">
                  <Info />
                  Legacy local file inspection.
                </div>
                <motion.div
                  className={`upload-zone ${projectDragging ? "upload-zone-active" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setProjectDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node))
                      setProjectDragging(false);
                  }}
                  onDrop={handleProjectDrop}
                  animate={reducedMotion || !projectDragging ? { scale: 1 } : { scale: 1.008 }}
                >
                  <div className="upload-icon-wrap">
                    {isUploading ? <LoaderCircle className="upload-spinner" /> : <Upload />}
                  </div>
                  <h3>
                    {projectDragging
                      ? "Release to inspect your project."
                      : "Drag & drop your project here."}
                  </h3>
                  <p>ZIP archive or complete project folder · No per-file size limit</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button type="button" onClick={() => fileRef.current?.click()}>
                      <FileArchive />
                      Choose ZIP
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => folderRef.current?.click()}
                    >
                      <FolderOpen />
                      Choose folder
                    </Button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".zip,application/zip"
                    hidden
                    onChange={(event) => {
                      void selectFiles(inputFiles(event.target.files), "zip");
                      event.target.value = "";
                    }}
                  />
                  <input
                    ref={folderRef}
                    type="file"
                    hidden
                    multiple
                    {...{ webkitdirectory: "", directory: "" }}
                    onChange={(event) => {
                      void selectFiles(inputFiles(event.target.files), "folder");
                      event.target.value = "";
                    }}
                  />
                </motion.div>

                {files.length > 0 && (
                  <div className="upload-summary">
                    <div className="upload-summary-head">
                      <div>
                        <strong>{files.length.toLocaleString()} files selected</strong>
                        <p>
                          {(totalSize / 1024 / 1024).toFixed(totalSize > 10 * 1024 * 1024 ? 1 : 2)}{" "}
                          MB total
                          {hiddenFileCount > 0 ? ` · Previewing ${FILE_PREVIEW_LIMIT}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFiles([]);
                          update("files", []);
                          setProgress(0);
                          setUploadStatus("idle");
                        }}
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="upload-list">
                      {previewFiles.map(({ file, index }) => (
                        <div
                          className={`upload-row ${file.valid ? "" : "upload-row-invalid"}`}
                          key={`${file.name}-${index}`}
                        >
                          <span className="upload-file-name" title={file.name}>
                            {file.name}
                          </span>
                          <span className={file.valid ? "text-success" : "text-destructive"}>
                            {file.valid ? "Ready" : file.reason}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            aria-label={`Remove file ${file.name}`}
                            onClick={() => removeFile(index)}
                          >
                            <X />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {hiddenFileCount > 0 && (
                      <div className="upload-more">
                        + {hiddenFileCount.toLocaleString()} more files safely collapsed
                      </div>
                    )}
                  </div>
                )}

                {uploadStatus !== "idle" && (
                  <div
                    className={`upload-progress-card ${uploadStatus === "complete" ? "upload-complete" : ""}`}
                  >
                    <div className="upload-progress-copy">
                      {uploadStatus === "complete" ? (
                        <CheckCircle2 />
                      ) : (
                        <LoaderCircle className="upload-spinner" />
                      )}
                      <div>
                        <strong>
                          {uploadStatus === "complete"
                            ? "Local inspection complete"
                            : "Inspecting project files"}
                        </strong>
                        <p>
                          {uploadStatus === "complete"
                            ? "Ready to continue. Nothing has been sent to a server."
                            : `Checking file structure · ${progress}%`}
                        </p>
                      </div>
                    </div>
                    <div className="progress-track" aria-label={`File inspection ${progress}%`}>
                      <motion.div
                        className="progress-fill"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      />
                    </div>
                  </div>
                )}

                {invalidCount > 0 && (
                  <div className="upload-invalid-warning" role="alert">
                    <div>
                      <strong>
                        {invalidCount} invalid {invalidCount === 1 ? "file" : "files"} found
                      </strong>
                      <p>
                        Invalid files are shown first. Remove them automatically to continue with
                        the valid project files.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={removeInvalidFiles}>
                      <X />
                      Remove invalid {invalidCount === 1 ? "file" : "files"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="field">
                <label>Project thumbnail</label>
                <div
                  className={`thumbnail-drop-zone ${thumbnailDragging ? "upload-zone-active" : ""}`}
                  onClick={() => thumbRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") thumbRef.current?.click();
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setThumbnailDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node))
                      setThumbnailDragging(false);
                  }}
                  onDrop={handleThumbnailDrop}
                  role="button"
                  tabIndex={0}
                >
                  <img src={draft.image} alt="Selected product thumbnail" />
                  <div>
                    <span className="thumbnail-drop-title">
                      <ImagePlus />
                      {thumbnailDragging ? "Release image to preview" : "Drag & drop a thumbnail"}
                    </span>
                    <p>or click to choose JPG, PNG, or WebP · Up to 5 MB</p>
                  </div>
                  <span className="thumbnail-drop-action">Choose thumbnail</span>
                  <input
                    hidden
                    ref={thumbRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={thumbnail}
                  />
                </div>
              </div>
            </div>
          ) : step === 2 ? (
            <div className="form-stack">
              {draft.project?.uploadId && (
                <div className="notice">
                  <Info /> Upload tersimpan. Alamat katalog demo: <code>/{draft.slug}</code>.
                  Upload saja belum membuat demo live: deploy project dan tunggu health check
                  berhasil sebelum publish. Source tetap dilayani dari origin preview terpisah.
                </div>
              )}
              <div className="field">
                <label htmlFor="demo-url">External HTTPS demo URL (optional)</label>
                <input
                  id="demo-url"
                  type="url"
                  className="form-input"
                  value={draft.demoUrl || ""}
                  onChange={(event) => {
                    const demoUrl = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      demoUrl,
                      demoMode: demoUrl.trim() ? 'iframe' : current.demoMode,
                    }));
                  }}
                  placeholder="https://your-demo.example.com"
                />
              </div>
              <div className="field">
                <label htmlFor="demo-mode">Preview mode</label>
                <select
                  id="demo-mode"
                  className="form-input"
                  value={draft.demoMode || "mock"}
                  onChange={(event) => update("demoMode", event.target.value)}
                >
                  <option value="mock">Interactive mock workspace</option>
                  <option value="iframe">Embedded website (requires HTTPS URL)</option>
                </select>
              </div>
              <div>
                <p className="mb-3 text-xs text-muted-foreground">Supported devices</p>
                <div className="flex flex-wrap gap-6">
                  {["Desktop", "Tablet", "Mobile"].map((device) => (
                    <label className="filter-choice" key={device}>
                      <input
                        type="checkbox"
                        checked={draft.devices?.includes(device) || false}
                        onChange={() =>
                          update(
                            "devices",
                            draft.devices?.includes(device)
                              ? draft.devices.filter((item) => item !== device)
                              : [...(draft.devices || []), device],
                          )
                        }
                      />
                      {device}
                    </label>
                  ))}
                </div>
              </div>
              <div className="notice">
                <Info />
                Only public test-account credentials belong here. Never enter real or private
                passwords. Demo fields are stored in this browser.
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="demo-user">Public demo username</label>
                  <input
                    id="demo-user"
                    className="form-input"
                    value={draft.demoUser || ""}
                    onChange={(event) => update("demoUser", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="demo-pass">Public test password</label>
                  <input
                    id="demo-pass"
                    type="password"
                    autoComplete="off"
                    className="form-input"
                    value={draft.demoPassword || ""}
                    onChange={(event) => update("demoPassword", event.target.value)}
                  />
                </div>
              </div>
              <span className="status status-positive">
                {draft.demoUrl ? "External URL configured" : "Mock demo available"}
              </span>
            </div>
          ) : step === 3 ? (
            <div className="form-stack">
              <div className="form-grid">
                {(
                  [
                    ["price", "Personal license price"],
                    ["commercialPrice", "Commercial license price"],
                    ["installationPrice", "Installation + customization"],
                    ["discountPrice", "Discount price (optional)"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label} · IDR</label>
                    <input
                      id={key}
                      type="number"
                      min={0}
                      step={1000}
                      className="form-input"
                      value={draft[key] ?? ""}
                      onChange={(event) =>
                        update(
                          key,
                          event.target.value === ""
                            ? (undefined as never)
                            : Number(event.target.value),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <label className="filter-choice">
                <input
                  type="checkbox"
                  checked={draft.freeDemo !== false}
                  onChange={(event) => update("freeDemo", event.target.checked)}
                />
                Free demo availability
              </label>
              <div className="notice">
                <Info />
                Illustrative pricing only. No payment gateway is connected.
              </div>
            </div>
          ) : (
            <div className="two-column">
              <div className="max-w-sm">
                <ProductCard
                  product={{
                    ...draft,
                    id: draft.id || "preview",
                    name: draft.name || "Your product",
                  }}
                />
              </div>
              <div className="form-stack">
                <div className="field">
                  <label htmlFor="publish-status">Publication status</label>
                  <select
                    id="publish-status"
                    className="form-input"
                    value={draft.status}
                    onChange={(event) =>
                      update("status", event.target.value === "published" ? "published" : "draft")
                    }
                  >
                    <option value="draft">Draft — keep it in the studio</option>
                    <option value="published" disabled={publishReadiness(draft).length > 0}>
                      Published — show in marketplace
                    </option>
                  </select>
                </div>
                {publishReadiness(draft).map((issue) => (
                  <p key={issue} className="text-xs text-destructive">
                    {issue}
                  </p>
                ))}
                <label className="filter-choice">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(event) => update("featured", event.target.checked)}
                  />
                  Feature on the homepage
                </label>
                <label className="filter-choice">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  I confirm this is a frontend-only demo publication.
                </label>
                <div className="notice">
                  <Info />A product can be published only after its deployment returns a verified
                  live preview URL.
                </div>
              </div>
            </div>
          )}
        </motion.div>
        <div className="mt-6 flex max-w-4xl justify-between gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              step ? setStep((current) => current - 1) : navigate({ to: "/admin/products" })
            }
          >
            <ArrowLeft />
            {step ? "Back" : "Cancel"}
          </Button>
          <Button type="submit" disabled={step === 1 && isUploading}>
            {step === 1 && isUploading
              ? `Inspecting ${progress}%`
              : step === 4
                ? draft.status === "published"
                  ? "Publish product"
                  : "Save draft"
                : "Continue"}
            {step === 1 && isUploading ? (
              <LoaderCircle className="upload-spinner" />
            ) : step === 4 ? (
              <Check />
            ) : (
              <ArrowRight />
            )}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
