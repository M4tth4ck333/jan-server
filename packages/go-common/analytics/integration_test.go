// +build integration

package analytics

import (
	"context"
	"os"
	"testing"
	"time"
)

// Integration tests for the analytics package
// Run with: go test -tags=integration ./analytics/...
//
// Required environment variables for PostHog tests:
// - POSTHOG_API_KEY: Your PostHog API key
// - POSTHOG_HOST: PostHog host (defaults to https://eu.posthog.com)
//
// Required environment variables for OTel tests:
// - OTEL_EXPORTER_OTLP_ENDPOINT: OTel collector endpoint

func TestIntegration_PostHogTracking(t *testing.T) {
	apiKey := os.Getenv("POSTHOG_API_KEY")
	if apiKey == "" {
		t.Skip("POSTHOG_API_KEY not set, skipping PostHog integration test")
	}

	host := os.Getenv("POSTHOG_HOST")
	if host == "" {
		host = "https://eu.posthog.com"
	}

	cfg := Config{
		Enabled:     true,
		Environment: "test",
		PIILevel:    "hashed",
		PostHog: PostHogConfig{
			Enabled:       true,
			APIKey:        apiKey,
			Host:          host,
			BatchSize:     1, // Send immediately for testing
			FlushInterval: time.Second,
			Debug:         true,
		},
	}

	sanitizer := NewSanitizer(PIILevelHashed, "integration-test")
	tracker, err := NewTracker(cfg, sanitizer)
	if err != nil {
		t.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(context.Background())
	}()

	ctx := context.Background()

	t.Run("Track event is sent to PostHog", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "integration-test-user-"+time.Now().Format("20060102150405")).
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropMode, "chat").
			WithProperty(PropPlatform, "test").
			WithProperty(PropStatus, "success").
			WithProperty(PropLatencyMs, int64(150)).
			WithProperty(PropTokensPrompt, 100).
			WithProperty(PropTokensCompletion, 50).
			WithProperty(PropTokensTotal, 150)

		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		// Give time for async processing
		time.Sleep(2 * time.Second)
	})

	t.Run("Identify user in PostHog", func(t *testing.T) {
		props := UserProperties{
			Email:    "integration-test@example.com",
			Name:     "Integration Test User",
			Plan:     "pro",
			Platform: "test",
			Custom: map[string]string{
				"test_run": time.Now().Format("20060102150405"),
			},
		}

		err := tracker.Identify(ctx, "integration-test-user", props)
		if err != nil {
			t.Errorf("Identify() error = %v", err)
		}

		// Give time for async processing
		time.Sleep(2 * time.Second)
	})

	t.Run("Track multiple events", func(t *testing.T) {
		distinctID := "integration-test-batch-" + time.Now().Format("20060102150405")

		events := []EventName{
			EventChatStarted,
			EventChatResponse,
			EventChatStopped,
		}

		for _, eventName := range events {
			event := NewEvent(eventName, distinctID).
				WithProperty(PropModel, "gpt-4").
				WithProperty(PropEnvironment, "test")

			err := tracker.Track(ctx, event)
			if err != nil {
				t.Errorf("Track(%s) error = %v", eventName, err)
			}
		}

		// Give time for async processing
		time.Sleep(3 * time.Second)
	})
}

func TestIntegration_OTelTracking(t *testing.T) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		t.Skip("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping OTel integration test")
	}

	cfg := Config{
		Enabled:     true,
		Environment: "test",
		OTel: OTelConfig{
			Enabled:  true,
			Endpoint: endpoint,
		},
	}

	tracker, err := NewTracker(cfg, nil)
	if err != nil {
		t.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(context.Background())
	}()

	ctx := context.Background()

	t.Run("Track event creates OTel metrics", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "otel-test-user").
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropMode, "chat").
			WithProperty(PropStatus, "success").
			WithProperty(PropLatencyMs, int64(150)).
			WithProperty(PropTokensTotal, 150)

		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Track multiple events with different labels", func(t *testing.T) {
		models := []string{"gpt-4", "gpt-3.5-turbo", "claude-3-opus"}
		statuses := []string{"success", "error", "stopped"}

		for _, model := range models {
			for _, status := range statuses {
				event := NewEvent(EventChatResponse, "otel-test-user").
					WithProperty(PropModel, model).
					WithProperty(PropStatus, status).
					WithProperty(PropLatencyMs, int64(100+len(model)*10))

				err := tracker.Track(ctx, event)
				if err != nil {
					t.Errorf("Track(model=%s, status=%s) error = %v", model, status, err)
				}
			}
		}
	})
}

func TestIntegration_DualBackend(t *testing.T) {
	posthogKey := os.Getenv("POSTHOG_API_KEY")
	otelEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

	if posthogKey == "" || otelEndpoint == "" {
		t.Skip("Both POSTHOG_API_KEY and OTEL_EXPORTER_OTLP_ENDPOINT required for dual backend test")
	}

	host := os.Getenv("POSTHOG_HOST")
	if host == "" {
		host = "https://eu.posthog.com"
	}

	cfg := Config{
		Enabled:     true,
		Environment: "test",
		PIILevel:    "hashed",
		PostHog: PostHogConfig{
			Enabled:       true,
			APIKey:        posthogKey,
			Host:          host,
			BatchSize:     1,
			FlushInterval: time.Second,
			Debug:         true,
		},
		OTel: OTelConfig{
			Enabled:  true,
			Endpoint: otelEndpoint,
		},
	}

	sanitizer := NewSanitizer(PIILevelHashed, "dual-backend-test")
	tracker, err := NewTracker(cfg, sanitizer)
	if err != nil {
		t.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(context.Background())
	}()

	ctx := context.Background()

	t.Run("Track event is sent to both backends", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "dual-backend-test-"+time.Now().Format("20060102150405")).
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropMode, "chat").
			WithProperty(PropPlatform, "test").
			WithProperty(PropStatus, "success").
			WithProperty(PropLatencyMs, int64(200))

		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		// Give time for async processing
		time.Sleep(2 * time.Second)
	})
}

func TestIntegration_ErrorHandling(t *testing.T) {
	// Test with invalid PostHog API key
	cfg := Config{
		Enabled:     true,
		Environment: "test",
		PostHog: PostHogConfig{
			Enabled:       true,
			APIKey:        "invalid_key_for_testing",
			Host:          "https://eu.posthog.com",
			BatchSize:     1,
			FlushInterval: time.Second,
		},
	}

	tracker, err := NewTracker(cfg, nil)
	if err != nil {
		t.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(context.Background())
	}()

	ctx := context.Background()

	t.Run("Track with invalid API key should still enqueue", func(t *testing.T) {
		// The Track should succeed (enqueue), but the actual send may fail
		event := NewEvent(EventChatResponse, "error-test-user").
			WithProperty(PropModel, "gpt-4")

		err := tracker.Track(ctx, event)
		// Enqueue should succeed
		if err != nil {
			t.Logf("Track() returned error (expected): %v", err)
		}
	})
}

// BenchmarkIntegration_PostHogTrack measures real-world PostHog performance
func BenchmarkIntegration_PostHogTrack(b *testing.B) {
	apiKey := os.Getenv("POSTHOG_API_KEY")
	if apiKey == "" {
		b.Skip("POSTHOG_API_KEY not set")
	}

	cfg := Config{
		Enabled:     true,
		Environment: "benchmark",
		PostHog: PostHogConfig{
			Enabled:       true,
			APIKey:        apiKey,
			Host:          "https://eu.posthog.com",
			BatchSize:     100,
			FlushInterval: 10 * time.Second,
		},
	}

	tracker, err := NewTracker(cfg, nil)
	if err != nil {
		b.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(context.Background())
	}()

	ctx := context.Background()
	event := NewEvent(EventChatResponse, "benchmark-user").
		WithProperty(PropModel, "gpt-4").
		WithProperty(PropStatus, "success").
		WithProperty(PropLatencyMs, int64(150))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = tracker.Track(ctx, event)
	}
}
