import { useEffect, useState } from "react";
import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Power,
  PowerOff,
  ChevronDown,
  ChevronRight,
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
import { promptTemplateService } from "@/services/admin-service";

export function PromptTemplatesManagement() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<PromptTemplate | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<PromptTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreatePromptTemplateRequest>({
    name: "",
    description: "",
    category: "general",
    template_key: "",
    content: "",
    variables: [],
    is_active: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  useEffect(() => {
    loadTemplates();
  }, [pagination.page, selectedCategory]);

  async function loadTemplates() {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (selectedCategory) {
        params.category = selectedCategory;
      }
      const response = await promptTemplateService.listPromptTemplates(params);
      setTemplates(response.data || []);
      setPagination((prev) => ({ ...prev, total: response.total || 0 }));
    } catch (err) {
      console.error("Failed to load templates:", err);
      setError("Failed to load prompt templates");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(template: PromptTemplate) {
    try {
      await promptTemplateService.updatePromptTemplate(template.public_id, {
        is_active: !template.is_active,
      });
      await loadTemplates();
    } catch (err) {
      console.error("Failed to toggle template status:", err);
    }
  }

  async function handleDelete() {
    if (!templateToDelete) return;
    try {
      await promptTemplateService.deletePromptTemplate(templateToDelete.public_id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      await loadTemplates();
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }

  async function handleDuplicate(template: PromptTemplate) {
    try {
      await promptTemplateService.duplicatePromptTemplate(template.public_id, {
        new_name: `${template.name} (Copy)`,
      });
      await loadTemplates();
    } catch (err) {
      console.error("Failed to duplicate template:", err);
    }
  }

  async function handleCreate() {
    try {
      await promptTemplateService.createPromptTemplate(formData);
      setCreateDialogOpen(false);
      resetForm();
      await loadTemplates();
    } catch (err) {
      console.error("Failed to create template:", err);
    }
  }

  async function handleUpdate() {
    if (!templateToEdit) return;
    try {
      await promptTemplateService.updatePromptTemplate(templateToEdit.public_id, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        content: formData.content,
        variables: formData.variables,
        is_active: formData.is_active,
      });
      setEditDialogOpen(false);
      setTemplateToEdit(null);
      resetForm();
      await loadTemplates();
    } catch (err) {
      console.error("Failed to update template:", err);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      category: "general",
      template_key: "",
      content: "",
      variables: [],
      is_active: true,
    });
  }

  function openEditDialog(template: PromptTemplate) {
    setTemplateToEdit(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category,
      template_key: template.template_key,
      content: template.content,
      variables: template.variables || [],
      is_active: template.is_active,
    });
    setEditDialogOpen(true);
  }

  const categories = [...new Set(templates.map((t) => t.category))].sort();

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.template_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (isLoading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={loadTemplates} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompt Templates</h1>
          <p className="text-muted-foreground mt-2">
            Manage system and custom prompt templates
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <Button variant="outline" onClick={loadTemplates}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredTemplates.length} of {pagination.total} templates
      </div>

      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {searchQuery ? "No templates match your search" : "No templates found"}
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-card rounded-lg border overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between">
                <div
                  className="flex items-start gap-3 flex-1 cursor-pointer"
                  onClick={() =>
                    setExpandedTemplate(
                      expandedTemplate === template.id ? null : template.id
                    )
                  }
                >
                  <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded mt-1">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.is_system && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          System
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          template.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {template.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Key: {template.template_key} | Category: {template.category}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    {expandedTemplate === template.id ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
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
                    <DropDrawerContent className="w-48">
                      <DropDrawerItem onClick={() => openEditDialog(template)}>
                        <div className="flex gap-2 items-center">
                          <Pencil className="w-4 h-4" />
                          <span>Edit</span>
                        </div>
                      </DropDrawerItem>
                      <DropDrawerItem onClick={() => handleDuplicate(template)}>
                        <div className="flex gap-2 items-center">
                          <Copy className="w-4 h-4" />
                          <span>Duplicate</span>
                        </div>
                      </DropDrawerItem>
                      <DropDrawerItem onClick={() => handleToggleActive(template)}>
                        <div className="flex gap-2 items-center">
                          {template.is_active ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                          <span>{template.is_active ? "Deactivate" : "Activate"}</span>
                        </div>
                      </DropDrawerItem>
                      {!template.is_system && (
                        <DropDrawerItem
                          variant="destructive"
                          onClick={() => {
                            setTemplateToDelete(template);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <div className="flex gap-2 items-center">
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </div>
                        </DropDrawerItem>
                      )}
                    </DropDrawerContent>
                  </DropDrawer>
                </div>
              </div>

              {expandedTemplate === template.id && (
                <div className="border-t p-4 bg-muted/20">
                  <div className="space-y-4">
                    {template.variables && template.variables.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                          Variables
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {template.variables.map((v) => (
                            <span
                              key={v}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded font-mono"
                            >
                              {"{{"}{v}{"}}"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Content
                      </div>
                      <pre className="text-sm bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {template.content}
                      </pre>
                    </div>
                  </div>
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
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
            setTemplateToEdit(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen
                ? "Update the prompt template configuration."
                : "Create a new prompt template for your system."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Template name"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Template Key</label>
              <Input
                value={formData.template_key}
                onChange={(e) =>
                  setFormData({ ...formData, template_key: e.target.value })
                }
                placeholder="template_key"
                disabled={editDialogOpen}
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier for the template (snake_case)
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Category</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="general"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the template"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter the prompt template content..."
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variable}}"} syntax for dynamic variables
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={editDialogOpen ? handleUpdate : handleCreate}
              disabled={!formData.name || !formData.template_key || !formData.content}
            >
              {editDialogOpen ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{templateToDelete?.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
