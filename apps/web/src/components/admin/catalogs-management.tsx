import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@janhq/interfaces/button";
import { Input } from "@janhq/interfaces/input";
import { modelCatalogService } from "@/services/admin-service";

export function CatalogsManagement() {
  const [catalogs, setCatalogs] = useState<ModelCatalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCatalog, setExpandedCatalog] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  useEffect(() => {
    loadCatalogs();
  }, [pagination.page]);

  async function loadCatalogs() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await modelCatalogService.listModelCatalogs({
        page: pagination.page,
        limit: pagination.limit,
      });
      setCatalogs(response.data || []);
      setPagination((prev) => ({ ...prev, total: response.total || 0 }));
    } catch (err) {
      console.error("Failed to load catalogs:", err);
      setError("Failed to load model catalogs");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCatalogs = catalogs.filter(
    (c) =>
      c.model_display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.family?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const toggleExpand = (id: string) => {
    setExpandedCatalog(expandedCatalog === id ? null : id);
  };

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
          View model catalog entries and their capabilities
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search catalogs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={loadCatalogs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredCatalogs.length} of {pagination.total} catalog entries
      </div>

      <div className="space-y-3">
        {filteredCatalogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {searchQuery ? "No catalogs match your search" : "No catalog entries found"}
          </div>
        ) : (
          filteredCatalogs.map((catalog) => (
            <div
              key={catalog.id}
              className="bg-card rounded-lg border overflow-hidden"
            >
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                onClick={() => toggleExpand(catalog.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                    <Layers className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">{catalog.model_display_name || catalog.id}</div>
                    <div className="text-sm text-muted-foreground">
                      {catalog.family || "Unknown family"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {catalog.context_length && (
                    <span className="text-sm text-muted-foreground">
                      {(catalog.context_length / 1000).toFixed(0)}K context
                    </span>
                  )}
                  {expandedCatalog === catalog.id ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedCatalog === catalog.id && (
                <div className="border-t p-4 bg-muted/20">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {catalog.context_length && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">
                          Context Length
                        </div>
                        <div className="font-medium mt-1">
                          {catalog.context_length.toLocaleString()} tokens
                        </div>
                      </div>
                    )}
                    {catalog.max_output_tokens && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">
                          Max Output
                        </div>
                        <div className="font-medium mt-1">
                          {catalog.max_output_tokens.toLocaleString()} tokens
                        </div>
                      </div>
                    )}
                    {catalog.input_price !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">
                          Input Price
                        </div>
                        <div className="font-medium mt-1">
                          ${catalog.input_price.toFixed(4)}/1K tokens
                        </div>
                      </div>
                    )}
                    {catalog.output_price !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">
                          Output Price
                        </div>
                        <div className="font-medium mt-1">
                          ${catalog.output_price.toFixed(4)}/1K tokens
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Capabilities */}
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Capabilities
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {catalog.supports_images && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded">
                          Vision
                        </span>
                      )}
                      {catalog.supports_tools && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded">
                          Tools
                        </span>
                      )}
                      {catalog.supports_reasoning && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                          Reasoning
                        </span>
                      )}
                      {catalog.supports_audio && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 rounded">
                          Audio
                        </span>
                      )}
                      {catalog.supports_video && (
                        <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400 rounded">
                          Video
                        </span>
                      )}
                      {catalog.supports_embeddings && (
                        <span className="px-2 py-1 text-xs bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 rounded">
                          Embeddings
                        </span>
                      )}
                      {catalog.supports_browser && (
                        <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 rounded">
                          Browser
                        </span>
                      )}
                      {!catalog.supports_images &&
                        !catalog.supports_tools &&
                        !catalog.supports_reasoning &&
                        !catalog.supports_audio &&
                        !catalog.supports_video &&
                        !catalog.supports_embeddings &&
                        !catalog.supports_browser && (
                          <span className="text-sm text-muted-foreground">
                            No special capabilities
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Description */}
                  {catalog.description && (
                    <div className="mt-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Description
                      </div>
                      <p className="text-sm">{catalog.description}</p>
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
