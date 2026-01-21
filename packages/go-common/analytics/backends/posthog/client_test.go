package posthog

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
	if cfg.Host != "https://eu.posthog.com" {
		t.Errorf("Host = %s, want https://eu.posthog.com", cfg.Host)
	}
	if cfg.BatchSize != 100 {
		t.Errorf("BatchSize = %d, want 100", cfg.BatchSize)
	}
	if cfg.FlushInterval != 10*time.Second {
		t.Errorf("FlushInterval = %v, want 10s", cfg.FlushInterval)
	}
}

func TestNew(t *testing.T) {
	t.Run("returns error when API key is missing", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			APIKey:  "",
			Host:    "https://eu.posthog.com",
		}
		_, err := New(cfg)
		if err != ErrMissingAPIKey {
			t.Errorf("New() error = %v, want ErrMissingAPIKey", err)
		}
	})

	t.Run("creates client with valid config", func(t *testing.T) {
		cfg := Config{
			Enabled:       true,
			APIKey:        "phc_test_key",
			Host:          "https://eu.posthog.com",
			BatchSize:     50,
			FlushInterval: 5 * time.Second,
			Debug:         true,
		}
		client, err := New(cfg)
		if err != nil {
			t.Fatalf("New() error = %v", err)
		}
		if client == nil {
			t.Fatal("New() returned nil client")
		}
		if client.config.APIKey != cfg.APIKey {
			t.Errorf("APIKey = %s, want %s", client.config.APIKey, cfg.APIKey)
		}

		// Clean up
		_ = client.Shutdown(context.Background())
	})
}

func TestEvent(t *testing.T) {
	t.Run("Event struct holds data", func(t *testing.T) {
		now := time.Now()
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  now,
			Properties: map[string]interface{}{
				"model":  "gpt-4",
				"status": "success",
			},
		}

		if event.Name != "test_event" {
			t.Errorf("Name = %s, want test_event", event.Name)
		}
		if event.DistinctID != "user-123" {
			t.Errorf("DistinctID = %s, want user-123", event.DistinctID)
		}
		if event.Timestamp != now {
			t.Errorf("Timestamp mismatch")
		}
		if event.Properties["model"] != "gpt-4" {
			t.Errorf("Properties[model] = %v, want gpt-4", event.Properties["model"])
		}
	})
}

func TestUserProperties(t *testing.T) {
	t.Run("UserProperties struct holds data", func(t *testing.T) {
		now := time.Now()
		props := UserProperties{
			Email:     "test@example.com",
			Name:      "Test User",
			CreatedAt: now,
			Plan:      "pro",
			Platform:  "web",
			Custom: map[string]string{
				"org":  "acme",
				"role": "admin",
			},
		}

		if props.Email != "test@example.com" {
			t.Errorf("Email = %s, want test@example.com", props.Email)
		}
		if props.Name != "Test User" {
			t.Errorf("Name = %s, want Test User", props.Name)
		}
		if props.Plan != "pro" {
			t.Errorf("Plan = %s, want pro", props.Plan)
		}
		if props.Platform != "web" {
			t.Errorf("Platform = %s, want web", props.Platform)
		}
		if props.Custom["org"] != "acme" {
			t.Errorf("Custom[org] = %s, want acme", props.Custom["org"])
		}
	})
}

// TestClientMethods tests the client methods with a real (but fake) API key
// Note: These tests won't actually send data to PostHog since the API key is fake
// For proper integration tests, you'd need a test PostHog instance
func TestClientMethods(t *testing.T) {
	cfg := Config{
		Enabled:       true,
		APIKey:        "phc_test_key_for_testing_only",
		Host:          "https://eu.posthog.com",
		BatchSize:     1, // Small batch for testing
		FlushInterval: 100 * time.Millisecond,
		Debug:         false,
	}

	client, err := New(cfg)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	defer func() {
		_ = client.Shutdown(context.Background())
	}()

	ctx := context.Background()

	t.Run("Track enqueues event", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{
				"model":  "gpt-4",
				"status": "success",
			},
		}

		// This will enqueue but may fail on actual send (fake API key)
		// The method should still return nil since enqueue succeeds
		err := client.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Identify enqueues identification", func(t *testing.T) {
		props := UserProperties{
			Email:    "test@example.com",
			Name:     "Test User",
			Plan:     "pro",
			Platform: "web",
		}

		err := client.Identify(ctx, "user-123", props)
		if err != nil {
			t.Errorf("Identify() error = %v", err)
		}
	})

	t.Run("Alias enqueues alias", func(t *testing.T) {
		err := client.Alias(ctx, "user-123", "alias-456")
		if err != nil {
			t.Errorf("Alias() error = %v", err)
		}
	})

	t.Run("GroupIdentify enqueues group identification", func(t *testing.T) {
		err := client.GroupIdentify(ctx, "company", "acme-corp", map[string]interface{}{
			"name":      "Acme Corporation",
			"plan":      "enterprise",
			"employees": 500,
		})
		if err != nil {
			t.Errorf("GroupIdentify() error = %v", err)
		}
	})

	t.Run("Flush returns nil", func(t *testing.T) {
		err := client.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v", err)
		}
	})
}

func TestClientWithEmptyProperties(t *testing.T) {
	cfg := Config{
		Enabled:       true,
		APIKey:        "phc_test_key",
		Host:          "https://eu.posthog.com",
		BatchSize:     100,
		FlushInterval: 10 * time.Second,
	}

	client, err := New(cfg)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	defer func() {
		_ = client.Shutdown(context.Background())
	}()

	ctx := context.Background()

	t.Run("Track with nil properties", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: nil,
		}

		err := client.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Track with empty properties", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{},
		}

		err := client.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Identify with empty properties", func(t *testing.T) {
		err := client.Identify(ctx, "user-123", UserProperties{})
		if err != nil {
			t.Errorf("Identify() error = %v", err)
		}
	})
}

func TestVersion(t *testing.T) {
	if Version == "" {
		t.Error("Version should not be empty")
	}
}

// BenchmarkClientTrack measures the overhead of tracking events
func BenchmarkClientTrack(b *testing.B) {
	cfg := Config{
		Enabled:       true,
		APIKey:        "phc_benchmark_key",
		Host:          "https://eu.posthog.com",
		BatchSize:     1000,
		FlushInterval: time.Hour, // Long interval to avoid flushing during benchmark
		Debug:         false,
	}

	client, err := New(cfg)
	if err != nil {
		b.Fatalf("New() error = %v", err)
	}
	defer func() {
		_ = client.Shutdown(context.Background())
	}()

	ctx := context.Background()
	event := Event{
		Name:       "benchmark_event",
		DistinctID: "user-123",
		Timestamp:  time.Now(),
		Properties: map[string]interface{}{
			"model":        "gpt-4",
			"status":       "success",
			"latency_ms":   150,
			"tokens_total": 1000,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.Track(ctx, event)
	}
}
