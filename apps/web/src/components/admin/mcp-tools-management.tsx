import { useEffect, useState } from "react";
import {
  Wrench,
  Loader2,
  RefreshCw,
  Search,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
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
import { mcpToolService } from "@/services/admin-service";

export function MCPToolsManagement() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [toolToEdit, setToolToEdit] = useState<MCPTool | null>(null);

  // Form state
  const [formData, setFormData] = useState<UpdateMCPToolRequest>({
    description: "",
    category: "",
    is_active: true,
    disallowed_keywords: [],
  });
  const [keywordsInput, setKeywordsInput] = useState("");

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  useEffect(() => {
    loadTools();
  }, [pagination.page, selectedCategory]);

  async function loadTools() {
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
      const response = await mcpToolService.listMCPTools(params);
      setTools(response.data || []);
      setPagination((prev) => ({ ...prev, total: response.total || 0 }));
    } catch (err) {
      console.error("Failed to load tools:", err);
      setError("Failed to load MCP tools");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(tool: MCPTool) {
    try {
      await mcpToolService.updateMCPTool(tool.public_id, {
        is_active: !tool.is_active,
      });
      await loadTools();
    } catch (err) {
      console.error("Failed to toggle tool status:", err);
    }
  }

  async function handleUpdate() {
    if (!toolToEdit) return;
    try {
      await mcpToolService.updateMCPTool(toolToEdit.public_id, {
        description: formData.description,
        category: formData.category,
        is_active: formData.is_active,
        disallowed_keywords: formData.disallowed_keywords,
      });
      setEditDialogOpen(false);
      setToolToEdit(null);
      resetForm();
      await loadTools();
    } catch (err) {
      console.error("Failed to update tool:", err);
    }
  }

  function resetForm() {
    setFormData({
      description: "",
      category: "",
      is_active: true,
      disallowed_keywords: [],
    });
    setKeywordsInput("");
  }

  function openEditDialog(tool: MCPTool) {
    setToolToEdit(tool);
    setFormData({
      description: tool.description || "",
      category: tool.category || "",
      is_active: tool.is_active,
      disallowed_keywords: tool.disallowed_keywords || [],
    });
    setKeywordsInput((tool.disallowed_keywords || []).join(", "));
    setEditDialogOpen(true);
  }

  function handleKeywordsChange(value: string) {
    setKeywordsInput(value);
    const keywords = value
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    setFormData({ ...formData, disallowed_keywords: keywords });
  }

  const categories = [...new Set(tools.map((t) => t.category).filter(Boolean))].sort();

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tool_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (isLoading && tools.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading MCP tools...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={loadTools} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MCP Tools</h1>
        <p className="text-muted-foreground mt-2">
          Manage Model Context Protocol tools and their configurations
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
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

        <Button variant="outline" onClick={loadTools}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredTools.length} of {pagination.total} tools
      </div>

      <div className="space-y-3">
        {filteredTools.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {searchQuery ? "No tools match your search" : "No MCP tools found"}
          </div>
        ) : (
          filteredTools.map((tool) => (
            <div
              key={tool.id}
              className="bg-card rounded-lg border overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between">
                <div
                  className="flex items-start gap-3 flex-1 cursor-pointer"
                  onClick={() =>
                    setExpandedTool(expandedTool === tool.id ? null : tool.id)
                  }
                >
                  <div className="bg-cyan-100 dark:bg-cyan-900/20 p-2 rounded mt-1">
                    <Wrench className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{tool.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          tool.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {tool.is_active ? "Active" : "Inactive"}
                      </span>
                      {tool.disallowed_keywords && tool.disallowed_keywords.length > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Restricted
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Key: {tool.tool_key}
                      {tool.category && ` | Category: ${tool.category}`}
                    </div>
                    {tool.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {tool.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    {expandedTool === tool.id ? (
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
                      <DropDrawerItem onClick={() => openEditDialog(tool)}>
                        <div className="flex gap-2 items-center">
                          <Pencil className="w-4 h-4" />
                          <span>Edit</span>
                        </div>
                      </DropDrawerItem>
                      <DropDrawerItem onClick={() => handleToggleActive(tool)}>
                        <div className="flex gap-2 items-center">
                          {tool.is_active ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                          <span>{tool.is_active ? "Deactivate" : "Activate"}</span>
                        </div>
                      </DropDrawerItem>
                    </DropDrawerContent>
                  </DropDrawer>
                </div>
              </div>

              {expandedTool === tool.id && (
                <div className="border-t p-4 bg-muted/20">
                  <div className="space-y-4">
                    {tool.description && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                          Description
                        </div>
                        <p className="text-sm">{tool.description}</p>
                      </div>
                    )}

                    {tool.disallowed_keywords && tool.disallowed_keywords.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                          Disallowed Keywords
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tool.disallowed_keywords.map((keyword) => (
                            <span
                              key={keyword}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Tool execution will be blocked if input contains these keywords
                        </p>
                      </div>
                    )}

                    {tool.metadata && Object.keys(tool.metadata).length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                          Metadata
                        </div>
                        <pre className="text-sm bg-muted p-3 rounded-md overflow-x-auto">
                          {JSON.stringify(tool.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Created: </span>
                        {new Date(tool.created_at).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Updated: </span>
                        {new Date(tool.updated_at).toLocaleDateString()}
                      </div>
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

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogOpen(false);
            setToolToEdit(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit MCP Tool</DialogTitle>
            <DialogDescription>
              Update the tool configuration. Tool key and name cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tool Key</label>
              <Input value={toolToEdit?.tool_key || ""} disabled />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={toolToEdit?.name || ""} disabled />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Category</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="search, code, utility, etc."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the tool"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Disallowed Keywords</label>
              <Input
                value={keywordsInput}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                placeholder="keyword1, keyword2, keyword3"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of keywords that will block tool execution
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
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
