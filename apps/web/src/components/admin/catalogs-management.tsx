import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Info,
  Settings,
  Cpu,
  Sliders,
  X,
} from "lucide-react";
import { Button } from "@janhq/interfaces/button";
import { Input } from "@janhq/interfaces/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@janhq/interfaces/dialog";
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerItem,
  DropDrawerTrigger,
} from "@janhq/interfaces/dropdrawer";
import {
  modelCatalogService,
  promptTemplateService,
} from "@/services/admin-service";
import { cn } from "@/lib/utils";

type EditTabType = "basic" | "architecture" | "parameters" | "capabilities";

// Instruct types from platform
const INSTRUCT_TYPES = [
  "none",
  "airoboros",
  "alpaca",
  "alpaca-modif",
  "chatml",
  "claude",
  "code-llama",
  "gemma",
  "llama2",
  "llama3",
  "mistral",
  "nemotron",
  "neural",
  "openchat",
  "phi3",
  "rwkv",
  "vicuna",
  "zephyr",
  "deepseek-r1",
  "deepseek-v3.1",
  "qwq",
  "qwen3",
];

// Tokenizers from platform
const TOKENIZERS = [
  "Router",
  "Media",
  "Other",
  "GPT",
  "Claude",
  "Gemini",
  "Grok",
  "Cohere",
  "Nova",
  "Qwen",
  "Yi",
  "DeepSeek",
  "Mistral",
  "Llama2",
  "Llama3",
  "Llama4",
  "PaLM",
  "RWKV",
  "Qwen3",
];

// Supported parameter names
const PARAMETER_NAMES = [
  "temperature",
  "top_p",
  "top_k",
  "presence_penalty",
  "repetition_penalty",
  "frequency_penalty",
  "max_tokens",
  "logit_bias",
  "logprobs",
  "top_logprobs",
  "seed",
  "response_format",
  "structured_outputs",
  "stop",
  "tools",
  "tool_choice",
  "parallel_tool_calls",
  "include_reasoning",
  "reasoning",
  "web_search_options",
  "verbosity",
];

interface CatalogFormData {
  model_display_name: string;
  description: string;
  family: string;
  status: string;
  is_moderated: boolean;
  experimental: boolean;
  requires_feature_flag: string;
  context_length: number | undefined;
  tags: string;
  notes: string;
  supports_images: boolean;
  supports_audio: boolean;
  supports_video: boolean;
  supports_reasoning: boolean;
  supports_embeddings: boolean;
  supports_tools: boolean;
  supports_browser: boolean;
  supports_instruct: boolean;
  // Architecture fields
  instruct_type: string;
  tokenizer: string;
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  // Supported parameters
  param_names: string[];
  default_temperature: string;
  default_top_p: string;
  default_top_k: string;
  default_presence_penalty: string;
  default_repetition_penalty: string;
  default_frequency_penalty: string;
}

const defaultFormData: CatalogFormData = {
  model_display_name: "",
  description: "",
  family: "",
  status: "",
  is_moderated: false,
  experimental: false,
  requires_feature_flag: "",
  context_length: undefined,
  tags: "",
  notes: "",
  supports_images: false,
  supports_audio: false,
  supports_video: false,
  supports_reasoning: false,
  supports_embeddings: false,
  supports_tools: false,
  supports_browser: false,
  supports_instruct: false,
  // Architecture fields
  instruct_type: "",
  tokenizer: "",
  modality: "",
  input_modalities: [],
  output_modalities: [],
  // Supported parameters
  param_names: [],
  default_temperature: "",
  default_top_p: "",
  default_top_k: "",
  default_presence_penalty: "",
  default_repetition_penalty: "",
  default_frequency_penalty: "",
};

export function CatalogsManagement() {
  const [catalogs, setCatalogs] = useState<ModelCatalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [expandedCatalog, setExpandedCatalog] = useState<string | null>(null);

  // Capability filters
  const [capabilityFilters, setCapabilityFilters] = useState({
    supports_images: false,
    supports_audio: false,
    supports_video: false,
    supports_reasoning: false,
    supports_embeddings: false,
    supports_tools: false,
    supports_browser: false,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [catalogToEdit, setCatalogToEdit] = useState<ModelCatalog | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<EditTabType>("basic");

  // Form state
  const [formData, setFormData] = useState<CatalogFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Templates state
  const [modelTemplates, setModelTemplates] = useState<ModelPromptTemplate[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<PromptTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [assignTemplateKey, setAssignTemplateKey] = useState("");
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [assignPriority, setAssignPriority] = useState(1);

  useEffect(() => {
    loadCatalogs();
  }, [pagination.page, familyFilter, statusFilter, capabilityFilters]);

  async function loadCatalogs() {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (familyFilter) {
        params.family = familyFilter;
      }
      if (statusFilter !== "all") {
        params.active = statusFilter === "active";
      }
      // Apply capability filters
      Object.entries(capabilityFilters).forEach(([key, value]) => {
        if (value) {
          params[key] = true;
        }
      });

      const response = await modelCatalogService.listModelCatalogs(params);
      setCatalogs(response.data || []);
      setPagination((prev) => ({ ...prev, total: response.total || 0 }));
    } catch (err) {
      console.error("Failed to load catalogs:", err);
      setError("Failed to load model catalogs");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!catalogToEdit) return;

    try {
      setIsSubmitting(true);

      // Build default parameters object
      const defaultParams: Record<string, number> = {};
      if (formData.default_temperature) {
        const val = parseFloat(formData.default_temperature);
        if (!isNaN(val)) defaultParams.temperature = val;
      }
      if (formData.default_top_p) {
        const val = parseFloat(formData.default_top_p);
        if (!isNaN(val)) defaultParams.top_p = val;
      }
      if (formData.default_top_k) {
        const val = parseInt(formData.default_top_k);
        if (!isNaN(val)) defaultParams.top_k = val;
      }
      if (formData.default_presence_penalty) {
        const val = parseFloat(formData.default_presence_penalty);
        if (!isNaN(val)) defaultParams.presence_penalty = val;
      }
      if (formData.default_repetition_penalty) {
        const val = parseFloat(formData.default_repetition_penalty);
        if (!isNaN(val)) defaultParams.repetition_penalty = val;
      }
      if (formData.default_frequency_penalty) {
        const val = parseFloat(formData.default_frequency_penalty);
        if (!isNaN(val)) defaultParams.frequency_penalty = val;
      }

      const updateData: Record<string, unknown> = {
        model_display_name: formData.model_display_name,
        description: formData.description,
        family: formData.family,
        status: formData.status,
        is_moderated: formData.is_moderated,
        experimental: formData.experimental,
        requires_feature_flag: formData.requires_feature_flag || null,
        context_length: formData.context_length,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        notes: formData.notes,
        supports_images: formData.supports_images,
        supports_audio: formData.supports_audio,
        supports_video: formData.supports_video,
        supports_reasoning: formData.supports_reasoning,
        supports_embeddings: formData.supports_embeddings,
        supports_tools: formData.supports_tools,
        supports_browser: formData.supports_browser,
        supports_instruct: formData.supports_instruct,
        // Architecture
        architecture: {
          instruct_type: formData.instruct_type || undefined,
          tokenizer: formData.tokenizer || undefined,
          modality: formData.modality || undefined,
          input_modalities: formData.input_modalities.length > 0 ? formData.input_modalities : undefined,
          output_modalities: formData.output_modalities.length > 0 ? formData.output_modalities : undefined,
        },
        // Supported parameters
        supported_parameters: {
          names: formData.param_names,
          default: Object.keys(defaultParams).length > 0 ? defaultParams : undefined,
        },
      };

      await modelCatalogService.updateModelCatalog(catalogToEdit.public_id, updateData);
      setEditDialogOpen(false);
      setCatalogToEdit(null);
      resetForm();
      await loadCatalogs();
    } catch (err) {
      console.error("Failed to update catalog:", err);
      alert("Failed to update catalog");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadTemplatesForModel(catalog: ModelCatalog) {
    if (!catalog.public_id) return;

    try {
      setIsLoadingTemplates(true);
      const [templatesResponse, availableResponse] = await Promise.all([
        modelCatalogService.listModelPromptTemplates(catalog.public_id),
        promptTemplateService.listPromptTemplates({ is_active: true }),
      ]);
      setModelTemplates(templatesResponse.data || []);
      setAvailableTemplates(availableResponse.data || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  async function handleAssignTemplate() {
    if (!catalogToEdit || !assignTemplateKey || !assignTemplateId) return;

    try {
      await modelCatalogService.assignPromptTemplate(catalogToEdit.public_id, {
        template_key: assignTemplateKey,
        prompt_template_id: assignTemplateId,
        priority: assignPriority,
        is_active: true,
      });
      await loadTemplatesForModel(catalogToEdit);
      setAssignTemplateKey("");
      setAssignTemplateId("");
      setAssignPriority(1);
    } catch (err) {
      console.error("Failed to assign template:", err);
      alert("Failed to assign template");
    }
  }

  async function handleUnassignTemplate(templateKey: string) {
    if (!catalogToEdit) return;

    if (!confirm("Are you sure you want to unassign this template?")) return;

    try {
      await modelCatalogService.unassignPromptTemplate(catalogToEdit.public_id, templateKey);
      await loadTemplatesForModel(catalogToEdit);
    } catch (err) {
      console.error("Failed to unassign template:", err);
      alert("Failed to unassign template");
    }
  }

  async function handleToggleTemplateActive(templateKey: string, isActive: boolean) {
    if (!catalogToEdit) return;

    try {
      await modelCatalogService.updatePromptTemplateAssignment(
        catalogToEdit.public_id,
        templateKey,
        { is_active: !isActive }
      );
      await loadTemplatesForModel(catalogToEdit);
    } catch (err) {
      console.error("Failed to toggle template:", err);
      alert("Failed to update template");
    }
  }

  function resetForm() {
    setFormData(defaultFormData);
    setActiveEditTab("basic");
  }

  function openEditDialog(catalog: ModelCatalog) {
    setCatalogToEdit(catalog);

    // Parse architecture
    const arch = typeof catalog.architecture === "object" ? catalog.architecture : {};
    const archAny = arch as Record<string, unknown>;

    // Parse supported parameters
    const supportedParams = catalog.supported_parameters as Record<string, unknown> | undefined;
    const paramNames = Array.isArray((supportedParams as any)?.names)
      ? (supportedParams as any).names
      : [];
    const defaultParamValues = (supportedParams as any)?.default || {};

    setFormData({
      model_display_name: catalog.model_display_name || "",
      description: catalog.description || "",
      family: catalog.family || "",
      status: catalog.status || "",
      is_moderated: catalog.is_moderated || false,
      experimental: catalog.experimental || false,
      requires_feature_flag: catalog.requires_feature_flag || "",
      context_length: catalog.context_length,
      tags: catalog.tags?.join(", ") || "",
      notes: catalog.notes || "",
      supports_images: catalog.supports_images || false,
      supports_audio: catalog.supports_audio || false,
      supports_video: catalog.supports_video || false,
      supports_reasoning: catalog.supports_reasoning || false,
      supports_embeddings: catalog.supports_embeddings || false,
      supports_tools: catalog.supports_tools || false,
      supports_browser: catalog.supports_browser || false,
      supports_instruct: catalog.supports_instruct || false,
      // Architecture
      instruct_type: (archAny.instruct_type as string) || "",
      tokenizer: (archAny.tokenizer as string) || "",
      modality: (archAny.modality as string) || "",
      input_modalities: Array.isArray(archAny.input_modalities) ? archAny.input_modalities : [],
      output_modalities: Array.isArray(archAny.output_modalities) ? archAny.output_modalities : [],
      // Supported parameters
      param_names: paramNames,
      default_temperature: defaultParamValues.temperature?.toString() || "",
      default_top_p: defaultParamValues.top_p?.toString() || "",
      default_top_k: defaultParamValues.top_k?.toString() || "",
      default_presence_penalty: defaultParamValues.presence_penalty?.toString() || "",
      default_repetition_penalty: defaultParamValues.repetition_penalty?.toString() || "",
      default_frequency_penalty: defaultParamValues.frequency_penalty?.toString() || "",
    });
    setActiveEditTab("basic");
    setEditDialogOpen(true);
  }

  function openTemplatesDialog(catalog: ModelCatalog) {
    setCatalogToEdit(catalog);
    loadTemplatesForModel(catalog);
    setTemplatesDialogOpen(true);
  }

  function toggleInputModality(modality: string) {
    const current = formData.input_modalities;
    if (current.includes(modality)) {
      setFormData({ ...formData, input_modalities: current.filter((m) => m !== modality) });
    } else {
      setFormData({ ...formData, input_modalities: [...current, modality] });
    }
  }

  function toggleOutputModality(modality: string) {
    const current = formData.output_modalities;
    if (current.includes(modality)) {
      setFormData({ ...formData, output_modalities: current.filter((m) => m !== modality) });
    } else {
      setFormData({ ...formData, output_modalities: [...current, modality] });
    }
  }

  function toggleParamName(param: string) {
    const current = formData.param_names;
    if (current.includes(param)) {
      setFormData({ ...formData, param_names: current.filter((p) => p !== param) });
    } else {
      setFormData({ ...formData, param_names: [...current, param] });
    }
  }

  // Get unique families for filter
  const families = [...new Set(catalogs.map((c) => c.family).filter(Boolean))].sort();

  const filteredCatalogs = catalogs.filter(
    (c) =>
      c.model_display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.public_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const hasCapabilityFilters = Object.values(capabilityFilters).some(Boolean);

  const editTabs: { id: EditTabType; label: string; icon: React.ElementType }[] = [
    { id: "basic", label: "Basic", icon: Info },
    { id: "architecture", label: "Architecture", icon: Cpu },
    { id: "parameters", label: "Parameters", icon: Sliders },
    { id: "capabilities", label: "Capabilities", icon: Settings },
  ];

  if (isLoading && catalogs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading catalogs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={loadCatalogs} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/models">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Models
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Model Catalogs</h1>
        <p className="text-muted-foreground mt-2">
          Manage model metadata, capabilities, and prompt template assignments
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search catalogs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={familyFilter}
            onChange={(e) => {
              setFamilyFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Families</option>
            {families.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 border rounded-md p-1">
            <Button
              variant={statusFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "active" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setStatusFilter("active");
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Active
            </Button>
            <Button
              variant={statusFilter === "inactive" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setStatusFilter("inactive");
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Inactive
            </Button>
          </div>

          <Button variant="outline" onClick={loadCatalogs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Capability Filters */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium text-muted-foreground">Capabilities:</span>
          {[
            { key: "supports_images", label: "Vision" },
            { key: "supports_audio", label: "Audio" },
            { key: "supports_video", label: "Video" },
            { key: "supports_reasoning", label: "Reasoning" },
            { key: "supports_embeddings", label: "Embeddings" },
            { key: "supports_tools", label: "Tools" },
            { key: "supports_browser", label: "Browser" },
          ].map(({ key, label }) => (
            <label
              key={key}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                capabilityFilters[key as keyof typeof capabilityFilters]
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={capabilityFilters[key as keyof typeof capabilityFilters]}
                onChange={(e) => {
                  setCapabilityFilters((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="sr-only"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
          {hasCapabilityFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCapabilityFilters({
                  supports_images: false,
                  supports_audio: false,
                  supports_video: false,
                  supports_reasoning: false,
                  supports_embeddings: false,
                  supports_tools: false,
                  supports_browser: false,
                });
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredCatalogs.length} of {pagination.total} catalogs
      </div>

      {/* Catalogs List */}
      <div className="space-y-3">
        {filteredCatalogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {searchQuery || familyFilter || statusFilter !== "all" || hasCapabilityFilters
              ? "No catalogs match your filters"
              : "No catalogs found"}
          </div>
        ) : (
          filteredCatalogs.map((catalog) => (
            <div
              key={catalog.id}
              className="bg-card rounded-lg border overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between">
                <div
                  className="flex items-start gap-3 flex-1 cursor-pointer"
                  onClick={() =>
                    setExpandedCatalog(expandedCatalog === catalog.id ? null : catalog.id)
                  }
                >
                  <div className="bg-indigo-100 dark:bg-indigo-900/20 p-2 rounded mt-1">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">
                        {catalog.model_display_name || catalog.public_id}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          catalog.active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {catalog.active ? "Active" : "Inactive"}
                      </span>
                      {catalog.experimental && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                          Experimental
                        </span>
                      )}
                      {catalog.requires_feature_flag && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                          {catalog.requires_feature_flag}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {catalog.family && `Family: ${catalog.family} | `}
                      ID: {catalog.public_id}
                    </div>
                    {catalog.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {catalog.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {catalog.supports_images && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          Vision
                        </span>
                      )}
                      {catalog.supports_audio && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          Audio
                        </span>
                      )}
                      {catalog.supports_video && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          Video
                        </span>
                      )}
                      {catalog.supports_reasoning && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          Reasoning
                        </span>
                      )}
                      {catalog.supports_tools && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          Tools
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {expandedCatalog === catalog.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  <DropDrawer>
                    <DropDrawerTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropDrawerTrigger>
                    <DropDrawerContent className="w-56">
                      <DropDrawerItem onClick={() => openEditDialog(catalog)}>
                        <div className="flex gap-2 items-center">
                          <Pencil className="w-4 h-4" />
                          <span>Edit Catalog</span>
                        </div>
                      </DropDrawerItem>
                      <DropDrawerItem onClick={() => openTemplatesDialog(catalog)}>
                        <div className="flex gap-2 items-center">
                          <FileText className="w-4 h-4" />
                          <span>Manage Templates</span>
                        </div>
                      </DropDrawerItem>
                    </DropDrawerContent>
                  </DropDrawer>
                </div>
              </div>

              {expandedCatalog === catalog.id && (
                <div className="border-t p-4 bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        {catalog.status && (
                          <div>
                            <span className="text-muted-foreground">Status: </span>
                            {catalog.status}
                          </div>
                        )}
                        {catalog.context_length && (
                          <div>
                            <span className="text-muted-foreground">Context: </span>
                            {(catalog.context_length / 1000).toFixed(0)}K tokens
                          </div>
                        )}
                        {catalog.is_moderated !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Moderated: </span>
                            {catalog.is_moderated ? "Yes" : "No"}
                          </div>
                        )}
                        {catalog.tags && catalog.tags.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Tags: </span>
                            {catalog.tags.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Architecture
                      </h4>
                      {catalog.architecture && typeof catalog.architecture === "object" ? (
                        <div className="space-y-2 text-sm">
                          {(catalog.architecture as any).instruct_type && (
                            <div>
                              <span className="text-muted-foreground">Instruct: </span>
                              {(catalog.architecture as any).instruct_type}
                            </div>
                          )}
                          {(catalog.architecture as any).tokenizer && (
                            <div>
                              <span className="text-muted-foreground">Tokenizer: </span>
                              {(catalog.architecture as any).tokenizer}
                            </div>
                          )}
                          {(catalog.architecture as any).input_modalities?.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Input: </span>
                              {(catalog.architecture as any).input_modalities.join(", ")}
                            </div>
                          )}
                          {(catalog.architecture as any).output_modalities?.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Output: </span>
                              {(catalog.architecture as any).output_modalities.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No architecture info</p>
                      )}
                    </div>
                  </div>
                  {catalog.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Notes
                      </h4>
                      <p className="text-sm text-muted-foreground">{catalog.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Catalog Dialog with Tabs */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogOpen(false);
            setCatalogToEdit(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Catalog</DialogTitle>
            <DialogDescription>
              Update the catalog metadata for{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded">
                {catalogToEdit?.public_id}
              </code>
            </DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="border-b">
            <nav className="flex space-x-4 px-1" aria-label="Tabs">
              {editTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveEditTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 py-2 px-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeEditTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Basic Tab */}
            {activeEditTab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Display Name *</label>
                    <Input
                      value={formData.model_display_name}
                      onChange={(e) =>
                        setFormData({ ...formData, model_display_name: e.target.value })
                      }
                      placeholder="e.g., GPT-4 Turbo"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Family</label>
                    <Input
                      value={formData.family}
                      onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                      placeholder="e.g., gpt-4, claude, gemini"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the model..."
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select status</option>
                      <option value="filled">Filled</option>
                      <option value="updated">Updated</option>
                      <option value="pending">Pending</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Context Length (tokens)</label>
                    <Input
                      type="number"
                      value={formData.context_length ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          context_length: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="e.g., 128000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Requires Feature Flag</label>
                    <Input
                      value={formData.requires_feature_flag}
                      onChange={(e) =>
                        setFormData({ ...formData, requires_feature_flag: e.target.value })
                      }
                      placeholder="feature_flag_key or leave empty"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Tags (comma-separated)</label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="vision, reasoning, multimodal"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.experimental}
                      onChange={(e) =>
                        setFormData({ ...formData, experimental: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Experimental Model</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_moderated}
                      onChange={(e) =>
                        setFormData({ ...formData, is_moderated: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Is Moderated</span>
                  </label>
                </div>
                <div className="grid gap-2 pt-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any notes about this catalog..."
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Architecture Tab */}
            {activeEditTab === "architecture" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Instruct Type</label>
                    <select
                      value={formData.instruct_type}
                      onChange={(e) => setFormData({ ...formData, instruct_type: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select instruct type</option>
                      {INSTRUCT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Tokenizer</label>
                    <select
                      value={formData.tokenizer}
                      onChange={(e) => setFormData({ ...formData, tokenizer: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select tokenizer</option>
                      {TOKENIZERS.map((tok) => (
                        <option key={tok} value={tok}>
                          {tok}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Modality</label>
                  <Input
                    value={formData.modality}
                    onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                    placeholder="e.g., text-to-text, multimodal"
                  />
                </div>

                {/* Input Modalities */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Input Modalities</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["text", "image", "file", "audio", "video"].map((mod) => (
                      <label key={mod} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.input_modalities.includes(mod)}
                          onChange={() => toggleInputModality(mod)}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{mod}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Output Modalities */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output Modalities</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["text", "image", "embedding"].map((mod) => (
                      <label key={mod} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.output_modalities.includes(mod)}
                          onChange={() => toggleOutputModality(mod)}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{mod}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Parameters Tab */}
            {activeEditTab === "parameters" && (
              <div className="space-y-6">
                {/* Available Parameters */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Available Parameters</label>
                  <p className="text-xs text-muted-foreground">
                    Select which parameters this model supports
                  </p>
                  <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                    {PARAMETER_NAMES.map((param) => (
                      <label key={param} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.param_names.includes(param)}
                          onChange={() => toggleParamName(param)}
                          className="rounded"
                        />
                        <span className="text-xs">{param.replace(/_/g, " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Default Parameter Values */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Default Parameter Values</label>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use system defaults. Clear button removes the value.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Temperature</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="2"
                          value={formData.default_temperature}
                          onChange={(e) =>
                            setFormData({ ...formData, default_temperature: e.target.value })
                          }
                          placeholder="e.g., 0.7"
                          className="text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, default_temperature: "" })}
                          className="px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Top P</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={formData.default_top_p}
                          onChange={(e) =>
                            setFormData({ ...formData, default_top_p: e.target.value })
                          }
                          placeholder="e.g., 0.9"
                          className="text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, default_top_p: "" })}
                          className="px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Top K</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={formData.default_top_k}
                          onChange={(e) =>
                            setFormData({ ...formData, default_top_k: e.target.value })
                          }
                          placeholder="e.g., 40"
                          className="text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, default_top_k: "" })}
                          className="px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Presence Penalty</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="-2"
                          max="2"
                          value={formData.default_presence_penalty}
                          onChange={(e) =>
                            setFormData({ ...formData, default_presence_penalty: e.target.value })
                          }
                          placeholder="e.g., 0.0"
                          className="text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, default_presence_penalty: "" })}
                          className="px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Repetition Penalty</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.default_repetition_penalty}
                          onChange={(e) =>
                            setFormData({ ...formData, default_repetition_penalty: e.target.value })
                          }
                          placeholder="e.g., 1.0"
                          className="text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, default_repetition_penalty: "" })}
                          className="px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Frequency Penalty</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="-2"
                          max="2"
                          value={formData.default_frequency_penalty}
                          onChange={(e) =>
                            setFormData({ ...formData, default_frequency_penalty: e.target.value })
                          }
                          placeholder="e.g., 0"
                          className="text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, default_frequency_penalty: "" })}
                          className="px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Capabilities Tab */}
            {activeEditTab === "capabilities" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select the capabilities this model supports
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: "supports_images", label: "Vision Support", desc: "Can process images" },
                    { key: "supports_audio", label: "Audio Support", desc: "Can process audio" },
                    { key: "supports_video", label: "Video Support", desc: "Can process video" },
                    { key: "supports_reasoning", label: "Reasoning Support", desc: "Has reasoning capabilities" },
                    { key: "supports_embeddings", label: "Embeddings Support", desc: "Can generate embeddings" },
                    { key: "supports_tools", label: "Tool/Function Calling", desc: "Can use tools and functions" },
                    { key: "supports_browser", label: "Browser Support", desc: "Can browse the web" },
                    { key: "supports_instruct", label: "Instruct Backup", desc: "Supports instruct mode" },
                  ].map(({ key, label, desc }) => (
                    <label
                      key={key}
                      className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData[key as keyof CatalogFormData] as boolean}
                        onChange={(e) =>
                          setFormData({ ...formData, [key]: e.target.checked })
                        }
                        className="rounded mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Update Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog
        open={templatesDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTemplatesDialogOpen(false);
            setCatalogToEdit(null);
            setModelTemplates([]);
            setAssignTemplateKey("");
            setAssignTemplateId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prompt Template Assignments</DialogTitle>
            <DialogDescription>
              Manage prompt templates for{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded">
                {catalogToEdit?.model_display_name || catalogToEdit?.public_id}
              </code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Assign New Template */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Assign Template
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Template Key</label>
                  <Input
                    value={assignTemplateKey}
                    onChange={(e) => setAssignTemplateKey(e.target.value)}
                    placeholder="e.g., system_prompt"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Template</label>
                  <select
                    value={assignTemplateId}
                    onChange={(e) => setAssignTemplateId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select template...</option>
                    {availableTemplates.map((t) => (
                      <option key={t.public_id} value={t.public_id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Priority</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={assignPriority}
                      onChange={(e) => setAssignPriority(parseInt(e.target.value) || 1)}
                      min={1}
                    />
                    <Button
                      onClick={handleAssignTemplate}
                      disabled={!assignTemplateKey || !assignTemplateId}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Assignments */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Current Assignments
              </h3>
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : modelTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                  No templates assigned to this model
                </div>
              ) : (
                <div className="space-y-2">
                  {modelTemplates.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                            {assignment.template_key}
                          </code>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              assignment.is_active
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {assignment.is_active ? "Active" : "Inactive"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Priority: {assignment.priority}
                          </span>
                        </div>
                        {assignment.prompt_template && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {assignment.prompt_template.name} ({assignment.prompt_template.category})
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleTemplateActive(assignment.template_key, assignment.is_active)
                          }
                        >
                          {assignment.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassignTemplate(assignment.template_key)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTemplatesDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
