package mcp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"jan-server/services/mcp-tools/internal/domain/sandbox"
	"jan-server/services/mcp-tools/internal/infrastructure/llmapi"
	"jan-server/services/mcp-tools/internal/infrastructure/metrics"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/rs/zerolog/log"
)

// SandboxMCP handles unified sandbox tools via the Provider interface
// Works with both AIO and E2B backends transparently
type SandboxMCP struct {
	provider  sandbox.Provider
	llmClient *llmapi.Client
}

// NewSandboxMCP creates a new Sandbox MCP handler
func NewSandboxMCP(provider sandbox.Provider) *SandboxMCP {
	if provider == nil || !provider.IsEnabled() {
		return nil
	}
	return &SandboxMCP{
		provider: provider,
	}
}

// SetLLMClient sets the LLM-API client for tool call tracking
func (s *SandboxMCP) SetLLMClient(client *llmapi.Client) {
	if s != nil {
		s.llmClient = client
	}
}

// ProviderName returns the name of the active provider
func (s *SandboxMCP) ProviderName() string {
	if s == nil || s.provider == nil {
		return ""
	}
	return s.provider.Name()
}

// RegisterTools registers sandbox tools with the MCP server
func (s *SandboxMCP) RegisterTools(server *mcpsdk.Server) {
	if s == nil || s.provider == nil || !s.provider.IsEnabled() {
		return
	}

	providerName := s.provider.Name()

	// Core tools (available for both AIO and E2B)
	s.registerShellExec(server)
	s.registerFileRead(server)
	s.registerFileWrite(server)
	s.registerFileList(server)
	s.registerCodeExecute(server)
	s.registerInstallPackages(server)
	s.registerMarkitdownConvert(server)

	// Conditional tools based on provider capabilities
	if providerName == "aio" {
		s.registerBrowserInfo(server)
	}
	if providerName == "e2b" {
		s.registerScreenshot(server)
		s.registerClick(server)
		s.registerType(server)
	}

	log.Info().
		Str("provider", providerName).
		Msg("Sandbox tools registered")
}

// --- Shell Tool ---

type SandboxShellExecArgs struct {
	Command        string `json:"command"`
	ToolCallID     string `json:"tool_call_id,omitempty"`
	RequestID      string `json:"request_id,omitempty"`
	ConversationID string `json:"conversation_id,omitempty"`
	UserID         string `json:"user_id,omitempty"`
}

func (s *SandboxMCP) registerShellExec(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_shell_exec",
		Description: "Execute shell commands in the sandbox. Returns stdout, stderr, and exit code. Use for file operations, system commands, and automation tasks.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxShellExecArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()
		callCtx := extractAllContext(req)

		log.Info().
			Str("tool", "sandbox_shell_exec").
			Str("command", truncateSandboxString(input.Command, 100)).
			Str("provider", providerName).
			Str("tool_call_id", callCtx["tool_call_id"]).
			Str("request_id", callCtx["request_id"]).
			Msg("Sandbox shell exec requested")

		result, err := s.provider.ShellExec(ctx, input.Command)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_shell_exec", providerName, status, duration.Seconds())

		if err != nil {
			log.Error().Err(err).Str("tool", "sandbox_shell_exec").Msg("Shell exec failed")
			return nil, nil, fmt.Errorf("shell exec failed: %w", err)
		}

		output := map[string]any{
			"stdout":      result.Stdout,
			"stderr":      result.Stderr,
			"exit_code":   result.ExitCode,
			"duration_ms": duration.Milliseconds(),
		}

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, output, nil
	})
}

// --- File Tools ---

type SandboxFileReadArgs struct {
	Path string `json:"path"`
}

func (s *SandboxMCP) registerFileRead(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_file_read",
		Description: "Read file contents from sandbox filesystem. Provide the path to the file.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxFileReadArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_file_read").
			Str("path", input.Path).
			Str("provider", providerName).
			Msg("Sandbox file read requested")

		content, err := s.provider.FileRead(ctx, input.Path)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_file_read", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("file read failed: %w", err)
		}

		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: content}},
		}, nil, nil
	})
}

type SandboxFileWriteArgs struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func (s *SandboxMCP) registerFileWrite(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_file_write",
		Description: "Write content to a file in sandbox filesystem. Creates parent directories if needed.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxFileWriteArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_file_write").
			Str("path", input.Path).
			Int("content_len", len(input.Content)).
			Str("provider", providerName).
			Msg("Sandbox file write requested")

		result, err := s.provider.FileWrite(ctx, input.Path, input.Content)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_file_write", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("file write failed: %w", err)
		}

		output := map[string]any{
			"success":       result.Success,
			"bytes_written": result.BytesWritten,
			"path":          result.Path,
		}

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, nil, nil
	})
}

type SandboxFileListArgs struct {
	Path string `json:"path"`
}

func (s *SandboxMCP) registerFileList(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_file_list",
		Description: "List files and directories in sandbox filesystem. Returns file names, sizes, and types.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxFileListArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_file_list").
			Str("path", input.Path).
			Str("provider", providerName).
			Msg("Sandbox file list requested")

		files, err := s.provider.FileList(ctx, input.Path)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_file_list", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("file list failed: %w", err)
		}

		outputJSON, _ := json.Marshal(files)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, nil, nil
	})
}

// --- Code Execution Tool ---

type SandboxCodeExecuteArgs struct {
	Code     string `json:"code"`
	Language string `json:"language"` // "python" or "nodejs"
}

func (s *SandboxMCP) registerCodeExecute(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_code_execute",
		Description: "Execute Python or Node.js code in sandbox. Set language to 'python' or 'nodejs'. Returns stdout, stderr, and execution results.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxCodeExecuteArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()
		callCtx := extractAllContext(req)

		log.Info().
			Str("tool", "sandbox_code_execute").
			Str("language", input.Language).
			Int("code_len", len(input.Code)).
			Str("code_hash", hashSandboxString(input.Code)).
			Str("provider", providerName).
			Str("tool_call_id", callCtx["tool_call_id"]).
			Str("request_id", callCtx["request_id"]).
			Msg("Sandbox code execute requested")

		// Default to python if not specified
		lang := input.Language
		if lang == "" {
			lang = "python"
		}

		result, err := s.provider.CodeExecute(ctx, input.Code, lang)

		duration := time.Since(startTime)
		metricsStatus := "success"
		if err != nil {
			metricsStatus = "error"
		}
		metrics.RecordToolCall("sandbox_code_execute", providerName, metricsStatus, duration.Seconds())

		if err != nil {
			log.Error().
				Err(err).
				Str("tool", "sandbox_code_execute").
				Str("language", lang).
				Str("provider", providerName).
				Msg("Code execution failed")
			return nil, nil, fmt.Errorf("code execution failed: %w", err)
		}

		// Check for execution errors
		if !result.Success {
			errMsg := fmt.Sprintf("code execution status: %s", result.Status)
			if result.Stderr != "" {
				stderr := result.Stderr
				if len(stderr) > 500 {
					stderr = stderr[:500] + "..."
				}
				errMsg = fmt.Sprintf("%s\nstderr: %s", errMsg, stderr)
			}
			if result.ExitCode != 0 {
				errMsg = fmt.Sprintf("%s (exit code: %d)", errMsg, result.ExitCode)
			}
			log.Error().
				Str("tool", "sandbox_code_execute").
				Str("language", lang).
				Str("status", result.Status).
				Int("exit_code", result.ExitCode).
				Str("provider", providerName).
				Msg("Code execution failed")
			return nil, nil, fmt.Errorf("%s", errMsg)
		}

		output := map[string]any{
			"status":      result.Status,
			"success":     result.Success,
			"stdout":      result.Stdout,
			"stderr":      result.Stderr,
			"exit_code":   result.ExitCode,
			"duration_ms": duration.Milliseconds(),
		}

		log.Info().
			Str("tool", "sandbox_code_execute").
			Str("language", lang).
			Str("status", result.Status).
			Int("exit_code", result.ExitCode).
			Int64("duration_ms", duration.Milliseconds()).
			Str("provider", providerName).
			Msg("Sandbox code execute completed")

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, nil, nil
	})
}

// --- Package Installation Tool ---

type SandboxInstallPackagesArgs struct {
	Packages []string `json:"packages"`
	Manager  string   `json:"manager,omitempty"` // "pip" or "npm", defaults to "pip"
}

func (s *SandboxMCP) registerInstallPackages(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_install_packages",
		Description: "Install packages using pip (Python) or npm (Node.js) in the sandbox. Use this before running code that requires external libraries.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxInstallPackagesArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()
		callCtx := extractAllContext(req)

		if len(input.Packages) == 0 {
			return nil, nil, fmt.Errorf("no packages specified")
		}

		manager := input.Manager
		if manager == "" {
			manager = "pip"
		}

		log.Info().
			Str("tool", "sandbox_install_packages").
			Strs("packages", input.Packages).
			Str("manager", manager).
			Str("provider", providerName).
			Str("tool_call_id", callCtx["tool_call_id"]).
			Str("request_id", callCtx["request_id"]).
			Msg("Sandbox install packages requested")

		result, err := s.provider.InstallPackages(ctx, input.Packages, manager)

		duration := time.Since(startTime)
		status := "success"
		if err != nil || (result != nil && !result.Success) {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_install_packages", providerName, status, duration.Seconds())

		if err != nil {
			log.Error().Err(err).
				Strs("packages", input.Packages).
				Str("tool", "sandbox_install_packages").
				Str("provider", providerName).
				Msg("Package installation failed")

			output := map[string]any{
				"status":             "error",
				"success":            false,
				"packages_requested": input.Packages,
				"duration_ms":        duration.Milliseconds(),
				"error":              err.Error(),
			}
			outputJSON, _ := json.Marshal(output)
			return &mcpsdk.CallToolResult{
				Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
				IsError: true,
			}, output, nil
		}

		if !result.Success {
			log.Error().
				Strs("packages", input.Packages).
				Str("tool", "sandbox_install_packages").
				Str("error", result.Error).
				Str("provider", providerName).
				Msg("Package installation failed")

			output := map[string]any{
				"status":             result.Status,
				"success":            result.Success,
				"packages_requested": input.Packages,
				"output":             result.Output,
				"exit_code":          result.ExitCode,
				"duration_ms":        duration.Milliseconds(),
				"error":              result.Error,
			}
			outputJSON, _ := json.Marshal(output)
			return &mcpsdk.CallToolResult{
				Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
				IsError: true,
			}, output, nil
		}

		log.Info().
			Strs("packages", input.Packages).
			Int64("duration_ms", duration.Milliseconds()).
			Str("provider", providerName).
			Msg("Packages installed successfully")

		output := map[string]any{
			"status":             result.Status,
			"success":            result.Success,
			"packages_installed": result.Packages,
			"output":             result.Output,
			"exit_code":          result.ExitCode,
			"duration_ms":        duration.Milliseconds(),
		}

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, output, nil
	})
}

// --- Utility Tools ---

type SandboxMarkitdownConvertArgs struct {
	URL string `json:"url,omitempty"`
}

func (s *SandboxMCP) registerMarkitdownConvert(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_markitdown_convert",
		Description: "Convert a URL or document to Markdown format. Useful for extracting readable text from web pages.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxMarkitdownConvertArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_markitdown_convert").
			Str("url", input.URL).
			Str("provider", providerName).
			Msg("Sandbox markitdown convert requested")

		result, err := s.provider.MarkitdownConvert(ctx, input.URL)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_markitdown_convert", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("markitdown convert failed: %w", err)
		}

		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: result}},
		}, nil, nil
	})
}

// --- AIO-specific Tools ---

func (s *SandboxMCP) registerBrowserInfo(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_browser_info",
		Description: "Get browser information from sandbox including CDP URL for automation.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input struct{}) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_browser_info").
			Str("provider", providerName).
			Msg("Sandbox browser info requested")

		result, err := s.provider.BrowserInfo(ctx)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_browser_info", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("browser info failed: %w", err)
		}

		output := map[string]any{
			"cdp_url": result.CdpURL,
			"vnc_url": result.VncURL,
		}

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, nil, nil
	})
}

// --- E2B-specific Tools ---

func (s *SandboxMCP) registerScreenshot(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_screenshot",
		Description: "Take a screenshot of the sandbox desktop. Returns base64-encoded PNG image.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input struct{}) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_screenshot").
			Str("provider", providerName).
			Msg("Sandbox screenshot requested")

		result, err := s.provider.Screenshot(ctx)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_screenshot", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("screenshot failed: %w", err)
		}

		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.ImageContent{
				Data:     result,
				MIMEType: "image/png",
			}},
		}, nil, nil
	})
}

type SandboxClickArgs struct {
	X      int    `json:"x"`
	Y      int    `json:"y"`
	Button string `json:"button,omitempty"` // "left", "right", "middle"
}

func (s *SandboxMCP) registerClick(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_click",
		Description: "Perform a mouse click at coordinates in the sandbox.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxClickArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_click").
			Int("x", input.X).
			Int("y", input.Y).
			Str("button", input.Button).
			Str("provider", providerName).
			Msg("Sandbox click requested")

		button := input.Button
		if button == "" {
			button = "left"
		}

		err := s.provider.Click(ctx, input.X, input.Y, button)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_click", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("click failed: %w", err)
		}

		output := map[string]any{
			"x":      input.X,
			"y":      input.Y,
			"button": button,
		}

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, nil, nil
	})
}

type SandboxTypeArgs struct {
	Text string `json:"text"`
}

func (s *SandboxMCP) registerType(server *mcpsdk.Server) {
	providerName := s.provider.Name()
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "sandbox_type",
		Description: "Type text in the sandbox.",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, input SandboxTypeArgs) (*mcpsdk.CallToolResult, map[string]any, error) {
		startTime := time.Now()

		log.Debug().
			Str("tool", "sandbox_type").
			Int("text_len", len(input.Text)).
			Str("provider", providerName).
			Msg("Sandbox type requested")

		err := s.provider.Type(ctx, input.Text)

		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordToolCall("sandbox_type", providerName, status, duration.Seconds())

		if err != nil {
			return nil, nil, fmt.Errorf("type failed: %w", err)
		}

		output := map[string]any{
			"text_length": len(input.Text),
		}

		outputJSON, _ := json.Marshal(output)
		return &mcpsdk.CallToolResult{
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(outputJSON)}},
		}, nil, nil
	})
}

// Helper functions (namespaced to avoid conflicts with aio_mcp.go)

func truncateSandboxString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func hashSandboxString(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
