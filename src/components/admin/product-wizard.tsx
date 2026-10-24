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
  Film,
  FolderOpen,
  ImagePlus,
  Info,
  LoaderCircle,
  Plus,
  Sparkles,
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
import { categories } from "@/data/products";
import { applyExtractedMetadata, canAdvanceFromProject, initialProjectDraft, projectSlug } from "@/lib/product-wizard-flow";
import { generateAIMetadata } from "@/lib/ai-metadata";
import { uploadPreviewVideo } from "@/lib/preview-video";
import { publishReadiness } from "@/lib/publish-readiness";
import { mockService } from "@/services/mock-service";
import type { Product } from "@/types";

const steps = [
  "Unggah proyek",
  "Informasi otomatis",
  "Konfigurasi pratinjau",
  "Harga",
  "Terbitkan",
];
// Preserve existing editor step IDs while displaying upload before the metadata review.
const stepOrder = [1, 0, 2, 3, 4] as const;
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
  const [step, setStep] = useState(existing ? 0 : 1);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Product>(() => existing || initialProjectDraft());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const persistedDraftId = useRef<string | null>(existing?.id ?? null);
  const pendingDraftSave = useRef<Promise<string> | null>(null);
  const [uploaderBusy, setUploaderBusy] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
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
      setStep(0);
      persistedDraftId.current = existing.id;
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

  async function ensurePersistedProduct(): Promise<string> {
    if (persistedDraftId.current) return persistedDraftId.current;
    if (pendingDraftSave.current) return pendingDraftSave.current;
    const token = crypto.randomUUID();
    const id = `p-${token}`;
    const snapshot = draftRef.current;
    const pending = store.saveProductAsync({
      ...snapshot, id, slug: `upload-${token}`,
      name: snapshot.name || `Upload ${token}`, status: "draft",
      updated: new Date().toISOString().slice(0, 10),
    }).then(() => {
      persistedDraftId.current = id;
      setDraft((current) => ({ ...current, id }));
      return id;
    });
    pendingDraftSave.current = pending;
    try { return await pending; }
    finally { pendingDraftSave.current = null; }
  }

  function updateProject(project: Product["project"]) {
    setDraft((current) => {
      if (project) {
        // A patch to the same project keeps its preview; replacement cannot reuse it.
        if (current.project && project.projectId !== current.project.projectId && !project.uploadId) {
          const { previewVideoUrl: _video, ...rest } = current;
          return { ...rest, project };
        }
        return { ...current, project };
      }
      const { project: _project, previewVideoUrl: _video, ...rest } = current;
      return rest;
    });
  }

  async function handleRegenerateAI() {
    setGeneratingAI(true);
    try {
      const ai = await generateAIMetadata({
        rawTitle: draft.name,
        rawDescription: draft.description,
        files: draft.project?.files?.map((f) => f.path) || [],
        headings: draft.features,
        category: draft.category,
      });

      setDraft((curr) => ({
        ...curr,
        name: ai.title,
        slug: ai.slug || projectSlug(ai.title || curr.slug),
        subtitle: ai.subtitle,
        description: ai.description,
        features: ai.features,
        category: ai.category,
        stack: Array.from(new Set([...curr.stack, ...ai.stack])),
        price: curr.price || ai.suggestedPrices?.price || curr.price,
        commercialPrice: curr.commercialPrice || ai.suggestedPrices?.commercialPrice || curr.commercialPrice,
        installationPrice: curr.installationPrice || ai.suggestedPrices?.installationPrice || curr.installationPrice,
      }));
      toast.success("Informasi produk berhasil dibuat & dipoles menggunakan AI.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menjalankan analisis AI.");
    } finally {
      setGeneratingAI(false);
    }
  }

  async function handlePreviewVideoUpload(file: File | undefined) {
    if (!file || generatingVideo) return;
    setGeneratingVideo(true);
    try {
      // Create the draft before storage upload so the recording has a stable product ID.
      const targetId = await ensurePersistedProduct();
      const url = await uploadPreviewVideo(file, targetId);
      setDraft((current) => ({ ...current, previewVideoUrl: url }));
      toast.success("Rekaman aplikasi siap diputar pada hover kartu katalog. Simpan produk untuk menerbitkannya.");
    } catch (error) {
      toast.error(error instanceof Error ? `Video gagal diunggah: ${error.message}` : "Video gagal diunggah.");
    } finally {
      setGeneratingVideo(false);
    }
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (step < 4) {
      if (step === 1 && (uploaderBusy || !draft.project?.uploadId || !draft.project?.projectId || draft.project.localStatus === "uploading" || draft.project.localStatus === "analyzing")) {
        toast.error("Unggah proyek terlebih dahulu hingga seluruh proses selesai.");
        return;
      }
      if (step === 0) {
        const cleanSlug = projectSlug(draft.slug || draft.name);
        const resolvedDesc = draft.description?.trim() || draft.subtitle?.trim() || '';
        const updatedDraft = {
          ...draft,
          slug: cleanSlug || draft.slug,
          description: resolvedDesc || draft.description,
        };

        if (updatedDraft.slug !== draft.slug || updatedDraft.description !== draft.description) {
          setDraft(updatedDraft);
        }

        if (!updatedDraft.name.trim()) {
          toast.error("Nama produk wajib diisi.");
          return;
        }
        if (!updatedDraft.description.trim()) {
          toast.error("Deskripsi produk wajib diisi.");
          return;
        }
        if (!cleanSlug || !canAdvanceFromProject(updatedDraft)) {
          toast.error("Format nama atau slug produk tidak valid. Gunakan huruf atau angka.");
          return;
        }
        setStep(stepOrder[stepOrder.indexOf(step as typeof stepOrder[number]) + 1] ?? 4);
        return;
      }
      if (step === 3 && (!draft.price || !draft.commercialPrice || !draft.installationPrice)) {
        toast.error("Lengkapi seluruh harga terlebih dahulu.");
        return;
      }
      setStep(stepOrder[stepOrder.indexOf(step as typeof stepOrder[number]) + 1] ?? 4);
      return;
    }

    if (!confirmed) {
      toast.error("Tinjau dan konfirmasi informasi produk terlebih dahulu.");
      return;
    }
    const cleanSlug = projectSlug(draft.slug || draft.name);
    const resolvedDesc = draft.description?.trim() || draft.subtitle?.trim() || '';
    const finalDraft = {
      ...draft,
      slug: cleanSlug || draft.slug,
      description: resolvedDesc || draft.description,
    };
    if (!canAdvanceFromProject(finalDraft)) {
      toast.error("Nama, slug, dan deskripsi harus diperiksa sebelum menyimpan produk.");
      setStep(0);
      return;
    }
    const readinessIssues = publishReadiness(draft);
    if (draft.status === "published" && readinessIssues.length) {
      toast.error(readinessIssues[0]);
      return;
    }
    if (store.products.some((product) => product.slug === draft.slug && product.id !== draft.id)) {
      toast.error("Slug ini sudah digunakan produk lain.");
      setStep(0);
      return;
    }
    const product = {
      ...finalDraft,
      id: draft.id || `p-${Date.now()}`,
      updated: new Date().toISOString().slice(0, 10),
      subtitle: finalDraft.subtitle || finalDraft.category,
    };
    setSaving(true);
    try {
      await store.saveProductAsync(product);
      toast.success(product.status === "published" ? "Produk berhasil diterbitkan." : "Produk tersimpan sebagai draf.");
      navigate({ to: "/admin/products" });
    } catch (error) {
      toast.error(error instanceof Error ? `Produk gagal disimpan: ${error.message}` : "Produk gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  if (id && !existing && store.hydrated) {
    return (
      <DashboardLayout owner title="Sunting produk">
        <div className="empty-state">
          <h2>Produk tidak ditemukan</h2>
          <Button asChild>
            <Link to="/admin/products">Kembali ke produk</Link>
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
    <DashboardLayout owner title={id ? "Sunting produk" : "Produk baru"}>
      <AdminHeading
        title={id ? `Sunting ${existing?.name || "produk"}.` : "Unggah proyek terlebih dahulu."}
        description="Nama, slug, deskripsi, teknologi, dan thumbnail akan diambil dari isi aplikasi setelah proyek dipilih; tinjau hasilnya sebelum terbit."
      />
      <div className="wizard-steps">
        {steps.map((label, index) => (
          <div key={label} className={`wizard-step ${stepOrder[index] === step ? "wizard-active" : ""}`}>
            <span>{index < stepOrder.indexOf(step as typeof stepOrder[number]) ? "✓" : `0${index + 1}`}</span>
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
          <h2>{steps[stepOrder.indexOf(step as typeof stepOrder[number])]}</h2>
          {step === 0 ? (
            <div className="form-stack">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md bg-secondary/30 border border-border">
                <div className="text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Analisis & Metadata AI
                  </span>
                  <p className="text-muted-foreground mt-0.5">
                    Metadata dianalisis otomatis dari aplikasi yang diunggah. Klik tombol di kanan jika ingin memoles ulang dengan AI.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generatingAI}
                  onClick={handleRegenerateAI}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary mr-1.5" />
                  {generatingAI ? "AI Sedang Menulis..." : "✨ Buat / Poles dengan AI"}
                </Button>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="product-name">Nama produk (otomatis, dapat disunting) *</label>
                  <input
                    id="product-name"
                    className="form-input"
                    value={draft.name}
                    placeholder="Your next great product"
                    onChange={(event) => {
                      const newName = event.target.value;
                      setDraft((current) => {
                        const shouldUpdateSlug = !id && (!current.slug || current.slug === projectSlug(current.name));
                        return {
                          ...current,
                          name: newName,
                          slug: shouldUpdateSlug ? projectSlug(newName) : current.slug,
                        };
                      });
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-slug">Slug URL (otomatis) *</label>
                  <input
                    id="product-slug"
                    className="form-input"
                    value={draft.slug}
                    onChange={(event) => {
                      const val = event.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                      update("slug", val);
                    }}
                    onBlur={() => {
                      const clean = projectSlug(draft.slug || draft.name);
                      if (clean) update("slug", clean);
                    }}
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
                <label htmlFor="product-description">Deskripsi hasil analisis *</label>
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
                productId={draft.id || ""}
                onBeforeUpload={ensurePersistedProduct}
                onBusyChange={setUploaderBusy}
                value={draft.project}
                onChange={updateProject}
                onVideoUploaded={(url) => setDraft((current) => ({ ...current, previewVideoUrl: url }))}
                onAutoExtracted={(extracted) => {
                  setDraft((curr) => applyExtractedMetadata(curr, {
                    ...extracted,
                    thumbnailUrl: extracted.thumbnail,
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
                <label htmlFor="demo-url">URL demo HTTPS eksternal (opsional)</label>
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
                      demoMode: demoUrl.trim() ? 'iframe' : (current.demoMode || 'iframe'),
                    }));
                  }}
                  placeholder="https://your-demo.example.com"
                />
              </div>
              <div className="field">
                <label htmlFor="demo-mode">Mode pratinjau</label>
                <select
                  id="demo-mode"
                  className="form-input"
                  value={draft.demoMode || "iframe"}
                  onChange={(event) => update("demoMode", event.target.value)}
                >
                  <option value="iframe">Situs aplikasi (memerlukan URL HTTPS)</option>
                </select>
              </div>
              <div>
                <p className="mb-3 text-xs text-muted-foreground">Perangkat yang didukung</p>
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
                Gunakan hanya akun uji publik. Jangan masukkan kata sandi pribadi atau akun produksi.
                Data yang disimpan di katalog dapat dibaca pengunjung.
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="demo-user">Nama pengguna akun uji publik</label>
                  <input
                    id="demo-user"
                    className="form-input"
                    value={draft.demoUser || ""}
                    onChange={(event) => update("demoUser", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="demo-pass">Kata sandi akun uji publik</label>
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
              <div className="panel p-4 border rounded-md bg-secondary/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Film className="h-4 w-4 text-primary" />
                      Rekaman Aplikasi untuk Hover Kartu Katalog
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Rekam tampilan aplikasi/demo yang diunggah, bukan halaman detail produk LABDITS. Video diputar saat pembeli hover kartu katalog. Jika demo sudah ter-deploy dan worker rekaman aktif, video dapat dibuat otomatis setelah produk diterbitkan.
                    </p>
                  </div>
                  <label htmlFor="hover-demo-recording" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-xs font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
                    <Upload className="h-4 w-4" />
                    {generatingVideo ? "Mengunggah rekaman…" : "Unggah rekaman aplikasi (MP4/WebM)"}
                    <input
                      id="hover-demo-recording"
                      aria-label="Unggah rekaman aplikasi"
                      className="sr-only"
                      type="file"
                      accept="video/mp4,video/webm,.mp4,.webm"
                      disabled={generatingVideo}
                      onChange={(event) => {
                        void handlePreviewVideoUpload(event.currentTarget.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {draft.previewVideoUrl ? (
                  <div className="space-y-2 pt-2">
                    <div className="relative aspect-video max-w-sm rounded-md overflow-hidden border border-border bg-black">
                      <video
                        src={draft.previewVideoUrl}
                        controls
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Video pratinjau aktif
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => update("previewVideoUrl", undefined)}
                      >
                        Hapus video
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Belum ada video tersimpan. Unggah rekaman asli aplikasi, atau terbitkan produk dengan demo yang sudah ter-deploy dan aktifkan worker perekam di server. Video simulasi tidak akan digunakan sebagai rekaman aplikasi.
                  </p>
                )}
              </div>
              <span className="status status-positive">
                {draft.project?.deployment?.verified || draft.demoUrl ? "Alamat pratinjau tersedia" : "Pratinjau belum tersedia"}
              </span>
            </div>
          ) : step === 3 ? (
            <div className="form-stack">
              <div className="form-grid">
                {(
                  [
                    ["price", "Harga lisensi personal"],
                    ["commercialPrice", "Harga lisensi komersial"],
                    ["installationPrice", "Instalasi dan kustomisasi"],
                    ["discountPrice", "Harga diskon (opsional)"],
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
                Demo aplikasi tersedia gratis
              </label>
              <div className="notice">
                <Info />
                Harga resmi produk dalam mata uang Rupiah (Rp). Terintegrasi dengan Pakasir.
              </div>
            </div>
          ) : (
            <div className="two-column">
              <div className="max-w-sm">
                <ProductCard
                  product={{
                    ...draft,
                    id: draft.id || "preview",
                    name: draft.name || "Produk baru",
                  }}
                />
              </div>
              <div className="form-stack">
                <div className="field">
                  <label htmlFor="publish-status">Status penerbitan</label>
                  <select
                    id="publish-status"
                    className="form-input"
                    value={draft.status}
                    onChange={(event) =>
                      update("status", event.target.value === "published" ? "published" : "draft")
                    }
                  >
                    <option value="draft">Draf — belum ditampilkan di katalog</option>
                    <option value="published" disabled={publishReadiness(draft).length > 0}>
                      Terbit — tampil di katalog
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
                  Tampilkan di beranda
                </label>
                <label className="filter-choice">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  Saya telah meninjau informasi produk dan berhak menerbitkan aplikasi ini.
                </label>
                <div className="notice">
                  <Info />Produk hanya dapat diterbitkan setelah deployment memiliki URL pratinjau HTTPS publik yang terverifikasi.
                </div>
              </div>
            </div>
          )}
        </motion.div>
        <div className="mt-6 flex max-w-4xl justify-between gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              const index = stepOrder.indexOf(step as typeof stepOrder[number]);
              if (index > 0) setStep(stepOrder[index - 1]!);
              else navigate({ to: "/admin/products" });
            }}
          >
            <ArrowLeft />
            {stepOrder.indexOf(step as typeof stepOrder[number]) > 0 ? "Kembali" : "Batal"}
          </Button>
          {id && step === 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Unggah proyek baru</Button>
          )}
          <Button type="submit" disabled={saving || (step === 1 && (isUploading || uploaderBusy || !draft.project?.projectId || !draft.project?.uploadId || draft.project.localStatus === "uploading" || draft.project.localStatus === "analyzing"))}>
            {saving ? "Menyimpan…" : step === 1 && isUploading
              ? `Memeriksa ${progress}%`
              : step === 4
                ? draft.status === "published"
                  ? "Terbitkan produk"
                  : "Simpan draf"
                : "Lanjutkan"}
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
