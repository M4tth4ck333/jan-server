package e2b

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	sandboxdomain "jan-server/services/mcp-tools/internal/domain/sandbox"
)

// Client implements sandbox.Provider for E2B backend via e2b-service HTTP API
type Client struct {
	baseURL    string
	timeout    time.Duration
	enabled    bool
	httpClient *http.Client
	userID     string // Current user context (set per request)
	convID     string // Current conversation context (set per request)
}

// ClientConfig holds E2B client configuration
type ClientConfig struct {
	BaseURL string
	Timeout time.Duration
	Enabled bool
}

// NewClient creates a new E2B client
func NewClient(cfg ClientConfig) *Client {
	if !cfg.Enabled || cfg.BaseURL == "" {
		return &Client{enabled: false}
	}

	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 120 * time.Second
	}

	return &Client{
		baseURL:    cfg.BaseURL,
		timeout:    timeout,
		enabled:    true,
		httpClient: &http.Client{Timeout: timeout},
	}
}

// IsEnabled returns whether the client is configured and ready
func (c *Client) IsEnabled() bool {
	return c != nil && c.enabled
}

// Name returns the provider name
func (c *Client) Name() string {
	return "e2b"
}

// BaseURL returns the configured base URL
func (c *Client) BaseURL() string {
	if c == nil {
		return ""
	}
	return c.baseURL
}

// SetContext sets the user and conversation context for subsequent calls
func (c *Client) SetContext(userID, conversationID string) {
	if c != nil {
		c.userID = userID
		c.convID = conversationID
	}
}

// mcpRequest represents an MCP JSON-RPC request
type mcpRequest struct {
	Jsonrpc string         `json:"jsonrpc"`
	ID      int            `json:"id"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params,omitempty"`
}

// mcpResponse represents an MCP JSON-RPC response
type mcpResponse struct {
	Jsonrpc string         `json:"jsonrpc"`
	ID      int            `json:"id"`
	Result  map[string]any `json:"result,omitempty"`
	Error   *mcpError      `json:"error,omitempty"`
}

type mcpError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// callMCP makes an MCP call to the e2b-service
func (c *Client) callMCP(ctx context.Context, method string, params map[string]any) (*mcpResponse, error) {
	if !c.IsEnabled() {
		return nil, fmt.Errorf("e2b client not enabled")
	}

	if c.userID == "" {
		return nil, fmt.Errorf("user_id not set - call SetContext first")
	}

	req := mcpRequest{
		Jsonrpc: "2.0",
		ID:      1,
		Method:  method,
		Params:  params,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/users/%s/sandbox/mcp", c.baseURL, c.userID)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("http status %d: %s", resp.StatusCode, string(respBody))
	}

	var mcpResp mcpResponse
	if err := json.Unmarshal(respBody, &mcpResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if mcpResp.Error != nil {
		return nil, fmt.Errorf("mcp error %d: %s", mcpResp.Error.Code, mcpResp.Error.Message)
	}

	return &mcpResp, nil
}

// callTool is a helper to call a specific tool via MCP
func (c *Client) callTool(ctx context.Context, toolName string, arguments map[string]any) (map[string]any, error) {
	resp, err := c.callMCP(ctx, "tools/call", map[string]any{
		"name":      toolName,
		"arguments": arguments,
	})
	if err != nil {
		return nil, err
	}
	return resp.Result, nil
}

// extractTextFromResult extracts text content from MCP tool result
func extractTextFromResult(result map[string]any) (string, error) {
	content, ok := result["content"].([]any)
	if !ok || len(content) == 0 {
		return "", fmt.Errorf("no content in result")
	}

	for _, item := range content {
		itemMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if itemMap["type"] == "text" {
			if text, ok := itemMap["text"].(string); ok {
				return text, nil
			}
		}
	}

	return "", fmt.Errorf("no text content found")
}

// extractImageFromResult extracts base64 image data from MCP tool result
func extractImageFromResult(result map[string]any) (string, error) {
	content, ok := result["content"].([]any)
	if !ok || len(content) == 0 {
		return "", fmt.Errorf("no content in result")
	}

	for _, item := range content {
		itemMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if itemMap["type"] == "image" {
			if data, ok := itemMap["data"].(string); ok {
				return data, nil
			}
		}
	}

	return "", fmt.Errorf("no image content found")
}

// --- SandboxProvider Interface Implementation ---

// ShellExec executes a command in the sandbox shell
func (c *Client) ShellExec(ctx context.Context, command string) (*sandboxdomain.ShellResult, error) {
	if c.convID == "" {
		return nil, fmt.Errorf("conversation_id not set - call SetContext first")
	}

	startTime := time.Now()
	result, err := c.callTool(ctx, "e2b_desktop_shell", map[string]any{
		"conversation_id": c.convID,
		"command":         command,
	})
	if err != nil {
		return nil, fmt.Errorf("shell exec failed: %w", err)
	}

	text, err := extractTextFromResult(result)
	if err != nil {
		return nil, err
	}

	// Parse the result text (format: "stdout: ...\nstderr: ...\nexit_code: ...")
	// For simplicity, we return the full text as stdout
	return &sandboxdomain.ShellResult{
		Stdout:     text,
		DurationMs: time.Since(startTime).Milliseconds(),
	}, nil
}

// FileRead reads file contents from the sandbox filesystem
func (c *Client) FileRead(ctx context.Context, path string) (string, error) {
	if c.convID == "" {
		return "", fmt.Errorf("conversation_id not set - call SetContext first")
	}

	result, err := c.callTool(ctx, "e2b_desktop_file_read", map[string]any{
		"conversation_id": c.convID,
		"path":            path,
	})
	if err != nil {
		return "", fmt.Errorf("file read failed: %w", err)
	}

	return extractTextFromResult(result)
}

// FileWrite writes content to a file in the sandbox filesystem
func (c *Client) FileWrite(ctx context.Context, path, content string) (*sandboxdomain.FileWriteResult, error) {
	if c.convID == "" {
		return nil, fmt.Errorf("conversation_id not set - call SetContext first")
	}

	result, err := c.callTool(ctx, "e2b_desktop_file_write", map[string]any{
		"conversation_id": c.convID,
		"path":            path,
		"content":         content,
	})
	if err != nil {
		return nil, fmt.Errorf("file write failed: %w", err)
	}

	text, err := extractTextFromResult(result)
	if err != nil {
		return nil, err
	}

	return &sandboxdomain.FileWriteResult{
		Success:      true,
		Path:         path,
		BytesWritten: len(text), // Approximate
	}, nil
}

// FileList lists files and directories at the given path
func (c *Client) FileList(ctx context.Context, path string) ([]sandboxdomain.FileInfo, error) {
	if c.convID == "" {
		return nil, fmt.Errorf("conversation_id not set - call SetContext first")
	}

	result, err := c.callTool(ctx, "e2b_desktop_file_list", map[string]any{
		"conversation_id": c.convID,
		"path":            path,
	})
	if err != nil {
		return nil, fmt.Errorf("file list failed: %w", err)
	}

	text, err := extractTextFromResult(result)
	if err != nil {
		return nil, err
	}

	// Parse the text result into FileInfo list
	// The format is: "[DIR] name (size bytes)" per line
	files := make([]sandboxdomain.FileInfo, 0)
	for _, line := range splitLines(text) {
		if line == "" || line == "Empty directory" {
			continue
		}
		isDir := false
		if len(line) > 6 && line[:6] == "[DIR] " {
			isDir = true
			line = line[6:]
		}
		// Extract name (before parenthesis)
		name := line
		if idx := findLastParen(line); idx > 0 {
			name = line[:idx-1]
		}
		files = append(files, sandboxdomain.FileInfo{
			Name:  name,
			IsDir: isDir,
		})
	}

	return files, nil
}

// CodeExecute executes code in the specified language
func (c *Client) CodeExecute(ctx context.Context, code, language string) (*sandboxdomain.CodeResult, error) {
	if c.convID == "" {
		return nil, fmt.Errorf("conversation_id not set - call SetContext first")
	}

	startTime := time.Now()
	result, err := c.callTool(ctx, "e2b_desktop_code_execute", map[string]any{
		"conversation_id": c.convID,
		"code":            code,
		"language":        language,
	})
	if err != nil {
		return nil, fmt.Errorf("code execute failed: %w", err)
	}

	text, err := extractTextFromResult(result)
	if err != nil {
		return nil, err
	}

	// Parse the JSON result
	var codeResult struct {
		Status     string `json:"status"`
		Success    bool   `json:"success"`
		Stdout     string `json:"stdout"`
		Stderr     string `json:"stderr"`
		ExitCode   int    `json:"exit_code"`
		DurationMs int64  `json:"duration_ms"`
		Error      string `json:"error,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &codeResult); err != nil {
		// If parsing fails, return raw text as stdout
		return &sandboxdomain.CodeResult{
			Status:     "ok",
			Success:    true,
			Stdout:     text,
			DurationMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	return &sandboxdomain.CodeResult{
		Status:     codeResult.Status,
		Success:    codeResult.Success,
		Stdout:     codeResult.Stdout,
		Stderr:     codeResult.Stderr,
		ExitCode:   codeResult.ExitCode,
		DurationMs: time.Since(startTime).Milliseconds(),
	}, nil
}

// InstallPackages installs packages using the specified package manager
func (c *Client) InstallPackages(ctx context.Context, packages []string, manager string) (*sandboxdomain.InstallResult, error) {
	startTime := time.Now()

	if manager == "" {
		manager = "pip"
	}

	result, err := c.callTool(ctx, "e2b_desktop_packages", map[string]any{
		"packages":        packages,
		"package_manager": manager,
	})
	if err != nil {
		return &sandboxdomain.InstallResult{
			Status:     "error",
			Success:    false,
			Packages:   packages,
			DurationMs: time.Since(startTime).Milliseconds(),
			Error:      err.Error(),
		}, nil
	}

	text, err := extractTextFromResult(result)
	if err != nil {
		return &sandboxdomain.InstallResult{
			Status:     "error",
			Success:    false,
			Packages:   packages,
			DurationMs: time.Since(startTime).Milliseconds(),
			Error:      err.Error(),
		}, nil
	}

	// Parse the JSON result
	var installResult struct {
		Status     string   `json:"status"`
		Success    bool     `json:"success"`
		Packages   []string `json:"packages_installed"`
		Output     string   `json:"output"`
		ExitCode   int      `json:"exit_code"`
		DurationMs int64    `json:"duration_ms"`
		Error      string   `json:"error,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &installResult); err != nil {
		return &sandboxdomain.InstallResult{
			Status:     "success",
			Success:    true,
			Packages:   packages,
			Output:     text,
			DurationMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	return &sandboxdomain.InstallResult{
		Status:     installResult.Status,
		Success:    installResult.Success,
		Packages:   installResult.Packages,
		Output:     installResult.Output,
		ExitCode:   installResult.ExitCode,
		DurationMs: time.Since(startTime).Milliseconds(),
		Error:      installResult.Error,
	}, nil
}

// BrowserInfo is not supported by E2B - returns error
func (c *Client) BrowserInfo(ctx context.Context) (*sandboxdomain.BrowserInfo, error) {
	return nil, sandboxdomain.NewNotSupportedError("e2b", "browser_info")
}

// Screenshot takes a desktop screenshot
func (c *Client) Screenshot(ctx context.Context) (string, error) {
	result, err := c.callTool(ctx, "e2b_desktop_screenshot", map[string]any{})
	if err != nil {
		return "", fmt.Errorf("screenshot failed: %w", err)
	}

	return extractImageFromResult(result)
}

// Click performs a mouse click at the specified coordinates
func (c *Client) Click(ctx context.Context, x, y int, button string) error {
	if button == "" {
		button = "left"
	}

	_, err := c.callTool(ctx, "e2b_desktop_click", map[string]any{
		"x":      x,
		"y":      y,
		"button": button,
	})
	if err != nil {
		return fmt.Errorf("click failed: %w", err)
	}

	return nil
}

// Type types text on the desktop
func (c *Client) Type(ctx context.Context, text string) error {
	_, err := c.callTool(ctx, "e2b_desktop_type", map[string]any{
		"text": text,
	})
	if err != nil {
		return fmt.Errorf("type failed: %w", err)
	}

	return nil
}

// MarkitdownConvert is not directly supported by E2B
// We could implement it via shell command if needed
func (c *Client) MarkitdownConvert(ctx context.Context, url string) (string, error) {
	// E2B doesn't have a built-in markitdown tool
	// We can try running it via shell if available
	result, err := c.ShellExec(ctx, fmt.Sprintf("markitdown '%s' 2>/dev/null || curl -s '%s' | html2text 2>/dev/null || echo 'markitdown not available'", url, url))
	if err != nil {
		return "", fmt.Errorf("markitdown convert failed: %w", err)
	}
	return result.Stdout, nil
}

// EnsureSandboxRunning ensures the sandbox is running for the given user
func (c *Client) EnsureSandboxRunning(ctx context.Context, userID string) error {
	if !c.IsEnabled() {
		return fmt.Errorf("e2b client not enabled")
	}

	// POST to /api/v1/users/{user_id}/sandbox to start sandbox
	url := fmt.Sprintf("%s/api/v1/users/%s/sandbox", c.baseURL, userID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("start sandbox failed with status %d: %s", resp.StatusCode, string(body))
	}

	c.userID = userID
	return nil
}

// helper functions

func splitLines(s string) []string {
	var lines []string
	var current []byte
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, string(current))
			current = nil
		} else {
			current = append(current, s[i])
		}
	}
	if len(current) > 0 {
		lines = append(lines, string(current))
	}
	return lines
}

func findLastParen(s string) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '(' {
			return i
		}
	}
	return -1
}

// Verify that Client implements Provider interface
var _ sandboxdomain.Provider = (*Client)(nil)
