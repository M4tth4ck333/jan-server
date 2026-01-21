package otel

import (
	"context"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Enabled {
		t.Error("Enabled should default to false")
	}
	if cfg.MetricsPort != 8080 {
		t.Errorf("MetricsPort = %d, want 8080", cfg.MetricsPort)
	}
}

func TestMetricsBackend(t *testing.T) {
	ctx := context.Background()

	t.Run("New creates backend successfully", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}
		if backend == nil {
			t.Fatal("New() returned nil backend")
		}
		if backend.meter == nil {
			t.Error("meter should not be nil")
		}
		if backend.eventCounts == nil {
			t.Error("eventCounts should not be nil")
		}
		if backend.durations == nil {
			t.Error("durations should not be nil")
		}
		if backend.tokens == nil {
			t.Error("tokens should not be nil")
		}
		if backend.ttfr == nil {
			t.Error("ttfr should not be nil")
		}
	})

	t.Run("Track records event count", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}

		event := Event{
			Name:       "chat_response",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{
				"model":   "gpt-4",
				"mode":    "chat",
				"status":  "success",
				"latency_ms": int64(150),
			},
		}

		err = backend.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Track with all metrics properties", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}

		event := Event{
			Name:       "chat_response",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{
				"model":        "gpt-4",
				"mode":         "chat",
				"platform":     "web",
				"environment":  "production",
				"user_status":  "authenticated",
				"status":       "success",
				"provider":     "openai",
				"tool_name":    "search",
				"agent_type":   "response",
				"latency_ms":   int64(150),
				"duration_ms":  int64(200),
				"ttfr_ms":      int64(50),
				"tokens_total": 1000,
			},
		}

		err = backend.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Track with different numeric types", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}

		tests := []struct {
			name  string
			props map[string]interface{}
		}{
			{
				name: "int",
				props: map[string]interface{}{
					"latency_ms":   100,
					"tokens_total": 500,
				},
			},
			{
				name: "int32",
				props: map[string]interface{}{
					"latency_ms":   int32(100),
					"tokens_total": int32(500),
				},
			},
			{
				name: "int64",
				props: map[string]interface{}{
					"latency_ms":   int64(100),
					"tokens_total": int64(500),
				},
			},
			{
				name: "float64",
				props: map[string]interface{}{
					"latency_ms":   float64(100.5),
					"tokens_total": float64(500.0),
				},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				event := Event{
					Name:       "test_event",
					DistinctID: "user-123",
					Timestamp:  time.Now(),
					Properties: tt.props,
				}
				err := backend.Track(ctx, event)
				if err != nil {
					t.Errorf("Track() error = %v", err)
				}
			})
		}
	})

	t.Run("Identify is no-op", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}

		err = backend.Identify(ctx, "user-123", UserProperties{
			Email: "test@example.com",
			Name:  "Test User",
		})
		if err != nil {
			t.Errorf("Identify() error = %v, want nil", err)
		}
	})

	t.Run("Flush is no-op", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}

		err = backend.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v, want nil", err)
		}
	})

	t.Run("Shutdown is no-op", func(t *testing.T) {
		cfg := Config{Enabled: true}
		backend, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}

		err = backend.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v, want nil", err)
		}
	})
}

func TestGetString(t *testing.T) {
	tests := []struct {
		name     string
		props    map[string]interface{}
		key      string
		wantVal  string
		wantOK   bool
	}{
		{
			name:    "existing string",
			props:   map[string]interface{}{"key": "value"},
			key:     "key",
			wantVal: "value",
			wantOK:  true,
		},
		{
			name:    "missing key",
			props:   map[string]interface{}{"other": "value"},
			key:     "key",
			wantVal: "",
			wantOK:  false,
		},
		{
			name:    "non-string value",
			props:   map[string]interface{}{"key": 123},
			key:     "key",
			wantVal: "",
			wantOK:  false,
		},
		{
			name:    "nil props",
			props:   nil,
			key:     "key",
			wantVal: "",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, ok := getString(tt.props, tt.key)
			if val != tt.wantVal {
				t.Errorf("getString() val = %v, want %v", val, tt.wantVal)
			}
			if ok != tt.wantOK {
				t.Errorf("getString() ok = %v, want %v", ok, tt.wantOK)
			}
		})
	}
}

func TestGetInt64(t *testing.T) {
	tests := []struct {
		name    string
		props   map[string]interface{}
		key     string
		wantVal int64
		wantOK  bool
	}{
		{
			name:    "int64 value",
			props:   map[string]interface{}{"key": int64(100)},
			key:     "key",
			wantVal: 100,
			wantOK:  true,
		},
		{
			name:    "int value",
			props:   map[string]interface{}{"key": 100},
			key:     "key",
			wantVal: 100,
			wantOK:  true,
		},
		{
			name:    "int32 value",
			props:   map[string]interface{}{"key": int32(100)},
			key:     "key",
			wantVal: 100,
			wantOK:  true,
		},
		{
			name:    "float64 value",
			props:   map[string]interface{}{"key": float64(100.7)},
			key:     "key",
			wantVal: 100,
			wantOK:  true,
		},
		{
			name:    "missing key",
			props:   map[string]interface{}{"other": 100},
			key:     "key",
			wantVal: 0,
			wantOK:  false,
		},
		{
			name:    "string value",
			props:   map[string]interface{}{"key": "100"},
			key:     "key",
			wantVal: 0,
			wantOK:  false,
		},
		{
			name:    "nil props",
			props:   nil,
			key:     "key",
			wantVal: 0,
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, ok := getInt64(tt.props, tt.key)
			if val != tt.wantVal {
				t.Errorf("getInt64() val = %v, want %v", val, tt.wantVal)
			}
			if ok != tt.wantOK {
				t.Errorf("getInt64() ok = %v, want %v", ok, tt.wantOK)
			}
		})
	}
}

func TestExtractAttributes(t *testing.T) {
	cfg := Config{Enabled: true}
	backend, err := New(cfg)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	t.Run("extracts all supported attributes", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{
				"model":       "gpt-4",
				"mode":        "chat",
				"platform":    "web",
				"environment": "production",
				"user_status": "authenticated",
				"status":      "success",
				"provider":    "openai",
				"tool_name":   "search",
				"agent_type":  "response",
			},
		}

		attrs := backend.extractAttributes(event)

		// Should have event name + all 9 properties
		expectedCount := 10
		if len(attrs) != expectedCount {
			t.Errorf("got %d attributes, want %d", len(attrs), expectedCount)
		}

		// Verify event name is always present
		found := false
		for _, attr := range attrs {
			if string(attr.Key) == "event" && attr.Value.AsString() == "test_event" {
				found = true
				break
			}
		}
		if !found {
			t.Error("event attribute not found")
		}
	})

	t.Run("handles missing properties", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{},
		}

		attrs := backend.extractAttributes(event)

		// Should only have event name
		if len(attrs) != 1 {
			t.Errorf("got %d attributes, want 1", len(attrs))
		}
	})

	t.Run("handles nil properties", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: nil,
		}

		attrs := backend.extractAttributes(event)

		// Should only have event name
		if len(attrs) != 1 {
			t.Errorf("got %d attributes, want 1", len(attrs))
		}
	})
}

// BenchmarkMetricsBackendTrack measures the performance of tracking events
func BenchmarkMetricsBackendTrack(b *testing.B) {
	cfg := Config{Enabled: true}
	backend, err := New(cfg)
	if err != nil {
		b.Fatalf("New() error = %v", err)
	}

	ctx := context.Background()
	event := Event{
		Name:       "chat_response",
		DistinctID: "user-123",
		Timestamp:  time.Now(),
		Properties: map[string]interface{}{
			"model":        "gpt-4",
			"mode":         "chat",
			"status":       "success",
			"latency_ms":   int64(150),
			"tokens_total": 1000,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = backend.Track(ctx, event)
	}
}
