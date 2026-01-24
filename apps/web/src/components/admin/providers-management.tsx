import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
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
import { providerManagementService } from "@/services/admin-service";

export function ProvidersManagement() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Form state for create
  const [newProvider, setNewProvider] = useState({
    name: "",
    api_base: "",
    api_key: "",
    type: "openai",
  });

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await providerManagementService.listProviders();
      setProviders(response.data || []);
    } catch (err) {
      console.error("Failed to load providers:", err);
      setError("Failed to load providers");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync(providerId: string) {
    try {
      setSyncingProvider(providerId);
      await providerManagementService.syncProvider(providerId);
      await loadProviders();
    } catch (err) {
      console.error("Failed to sync provider:", err);
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleToggleActive(provider: Provider) {
    try {
      await providerManagementService.updateProvider(provider.id, {
        active: !provider.active,
      });
      await loadProviders();
    } catch (err) {
      console.error("Failed to toggle provider status:", err);
    }
  }

  async function handleDelete() {
    if (!providerToDelete) return;
    try {
      await providerManagementService.deleteProvider(providerToDelete.id);
      setDeleteDialogOpen(false);
      setProviderToDelete(null);
      await loadProviders();
    } catch (err) {
      console.error("Failed to delete provider:", err);
    }
  }

  async function handleCreate() {
    try {
      await providerManagementService.createProvider(newProvider);
      setCreateDialogOpen(false);
      setNewProvider({ name: "", api_base: "", api_key: "", type: "openai" });
      await loadProviders();
    } catch (err) {
      console.error("Failed to create provider:", err);
    }
  }

  const filteredProviders = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading providers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={loadProviders} variant="outline" className="mt-4">
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Model Providers</h1>
          <p className="text-muted-foreground mt-2">
            Manage model providers and their configurations
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Provider
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={loadProviders}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No providers match your search" : "No providers configured"}
          </div>
        ) : (
          filteredProviders.map((provider) => (
            <div
              key={provider.id}
              className="bg-card rounded-lg border p-6 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                    <Database className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{provider.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          provider.active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {provider.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Type: {provider.type}
                    </p>
                    {provider.api_base && (
                      <p className="text-sm text-muted-foreground">
                        API Base: {provider.api_base}
                      </p>
                    )}
                    {provider.models_count !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Models: {provider.models_count}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(provider.id)}
                    disabled={syncingProvider === provider.id}
                  >
                    {syncingProvider === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="ml-2">Sync</span>
                  </Button>
                  <DropDrawer>
                    <DropDrawerTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropDrawerTrigger>
                    <DropDrawerContent className="w-48">
                      <DropDrawerItem onClick={() => handleToggleActive(provider)}>
                        <div className="flex gap-2 items-center">
                          {provider.active ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                          <span>{provider.active ? "Deactivate" : "Activate"}</span>
                        </div>
                      </DropDrawerItem>
                      <DropDrawerItem
                        variant="destructive"
                        onClick={() => {
                          setProviderToDelete(provider);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <div className="flex gap-2 items-center">
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </div>
                      </DropDrawerItem>
                    </DropDrawerContent>
                  </DropDrawer>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Provider Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Provider</DialogTitle>
            <DialogDescription>
              Add a new model provider to your configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newProvider.name}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, name: e.target.value })
                }
                placeholder="My Provider"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Type</label>
              <select
                value={newProvider.type}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, type: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="azure">Azure</option>
                <option value="ollama">Ollama</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">API Base URL</label>
              <Input
                value={newProvider.api_base}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, api_base: e.target.value })
                }
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                value={newProvider.api_key}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, api_key: e.target.value })
                }
                placeholder="sk-..."
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={!newProvider.name}>
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{providerToDelete?.name}</span>?
              This will also remove all associated models.
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
