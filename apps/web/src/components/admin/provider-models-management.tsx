import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Box,
  Loader2,
  RefreshCw,
  Search,
  MoreHorizontal,
  Power,
  PowerOff,
  Filter,
} from "lucide-react";
import { Button } from "@janhq/interfaces/button";
import { Input } from "@janhq/interfaces/input";
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerItem,
  DropDrawerTrigger,
} from "@janhq/interfaces/dropdrawer";
import {
  providerModelService,
  providerManagementService,
} from "@/services/admin-service";

export function ProviderModelsManagement() {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    loadModels();
  }, [pagination.page, selectedProvider, activeFilter]);

  async function loadProviders() {
    try {
      const response = await providerManagementService.listProviders();
      setProviders(response.data || []);
    } catch (err) {
      console.error("Failed to load providers:", err);
    }
  }

  async function loadModels() {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (selectedProvider) {
        params.provider_id = selectedProvider;
      }
      if (activeFilter !== "all") {
        params.active = activeFilter === "active";
      }
      const response = await providerModelService.listProviderModels(params);
      setModels(response.data || []);
      setPagination((prev) => ({ ...prev, total: response.total || 0 }));
    } catch (err) {
      console.error("Failed to load models:", err);
      setError("Failed to load provider models");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(model: ProviderModel) {
    try {
      await providerModelService.updateProviderModel(model.id, {
        active: !model.active,
      });
      await loadModels();
    } catch (err) {
      console.error("Failed to toggle model status:", err);
    }
  }

  const filteredModels = models.filter(
    (m) =>
      m.model_display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider_vendor?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (isLoading && models.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={loadModels} variant="outline" className="mt-4">
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
        <h1 className="text-3xl font-bold tracking-tight">Provider Models</h1>
        <p className="text-muted-foreground mt-2">
          Browse and manage individual models from all providers
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 border rounded-md p-1">
          <Button
            variant={activeFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveFilter("all");
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            All
          </Button>
          <Button
            variant={activeFilter === "active" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveFilter("active");
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            Active
          </Button>
          <Button
            variant={activeFilter === "inactive" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveFilter("inactive");
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            Inactive
          </Button>
        </div>

        <Button variant="outline" onClick={loadModels}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredModels.length} of {pagination.total} models
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Model ID</th>
              <th className="text-left p-4 font-medium">Provider</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Context</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredModels.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "No models match your search" : "No models found"}
                </td>
              </tr>
            ) : (
              filteredModels.map((model) => (
                <tr key={model.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded">
                        <Box className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">{model.model_public_id}</div>
                        {model.model_display_name && model.model_display_name !== model.model_public_id && (
                          <div className="text-sm text-muted-foreground">
                            {model.model_display_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {model.provider_vendor || "Unknown"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        model.active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {model.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {model.token_limits?.context_length
                      ? `${(model.token_limits.context_length / 1000).toFixed(0)}K`
                      : "-"}
                  </td>
                  <td className="p-4 text-right">
                    <DropDrawer>
                      <DropDrawerTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropDrawerTrigger>
                      <DropDrawerContent className="w-48">
                        <DropDrawerItem onClick={() => handleToggleActive(model)}>
                          <div className="flex gap-2 items-center">
                            {model.active ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                            <span>{model.active ? "Deactivate" : "Activate"}</span>
                          </div>
                        </DropDrawerItem>
                      </DropDrawerContent>
                    </DropDrawer>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </div>
  );
}
