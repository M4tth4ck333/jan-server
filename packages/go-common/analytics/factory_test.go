package analytics

import (
	"context"
	"testing"
	"time"
)

func TestNewTracker(t *testing.T) {
	ctx := context.Background()

	t.Run("creates no-op when analytics disabled", func(t *testing.T) {
		cfg := Config{
			Enabled: false,
		}
		tracker, err := NewTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewTracker() error = %v", err)
		}

		// Should work without error
		event := NewEvent(EventChatResponse, "user-123")
		err = tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		err = tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}
	})

	t.Run("creates no-op when no backends enabled", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			PostHog: PostHogConfig{
				Enabled: false,
			},
			OTel: OTelConfig{
				Enabled: false,
			},
		}
		tracker, err := NewTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewTracker() error = %v", err)
		}

		// Should work without error (no-op)
		event := NewEvent(EventChatResponse, "user-123")
		err = tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		err = tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}
	})

	t.Run("creates PostHog backend when enabled", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			PostHog: PostHogConfig{
				Enabled:       true,
				APIKey:        "phc_test_key",
				Host:          "https://eu.posthog.com",
				BatchSize:     100,
				FlushInterval: 10 * time.Second,
			},
		}
		tracker, err := NewTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewTracker() error = %v", err)
		}

		// Clean up
		err = tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}
	})

	t.Run("returns error when PostHog enabled without API key", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			PostHog: PostHogConfig{
				Enabled: true,
				APIKey:  "",
			},
		}
		_, err := NewTracker(cfg, nil)
		if err == nil {
			t.Error("NewTracker() should return error when PostHog enabled without API key")
		}
	})

	t.Run("creates OTel backend when enabled", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			OTel: OTelConfig{
				Enabled:     true,
				Endpoint:    "http://localhost:4318",
				MetricsPort: 8080,
			},
		}
		tracker, err := NewTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewTracker() error = %v", err)
		}

		// Track an event
		event := NewEvent(EventChatResponse, "user-123").
			WithProperty(PropModel, "gpt-4")
		err = tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		err = tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}
	})

	t.Run("creates both backends when both enabled", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			PostHog: PostHogConfig{
				Enabled:       true,
				APIKey:        "phc_test_key",
				Host:          "https://eu.posthog.com",
				BatchSize:     100,
				FlushInterval: 10 * time.Second,
			},
			OTel: OTelConfig{
				Enabled:  true,
				Endpoint: "http://localhost:4318",
			},
		}
		tracker, err := NewTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewTracker() error = %v", err)
		}

		// Track an event - should go to both backends
		event := NewEvent(EventChatResponse, "user-123").
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropStatus, "success")
		err = tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		err = tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}
	})

	t.Run("validates config - PostHog requires API key", func(t *testing.T) {
		cfg := Config{
			Enabled: true,
			PostHog: PostHogConfig{
				Enabled: true,
				APIKey:  "", // Missing API key
			},
		}
		_, err := NewTracker(cfg, nil)
		if err == nil {
			t.Error("NewTracker() should return error when PostHog enabled without API key")
		}
	})
}

func TestMustNewTracker(t *testing.T) {
	t.Run("returns tracker on success", func(t *testing.T) {
		cfg := Config{Enabled: false}
		tracker := MustNewTracker(cfg, nil)
		if tracker == nil {
			t.Error("MustNewTracker() returned nil")
		}
	})

	t.Run("panics on error", func(t *testing.T) {
		defer func() {
			if r := recover(); r == nil {
				t.Error("MustNewTracker() should panic on error")
			}
		}()

		cfg := Config{
			Enabled: true,
			PostHog: PostHogConfig{
				Enabled: true,
				APIKey:  "", // Missing API key should cause error
			},
		}
		_ = MustNewTracker(cfg, nil)
	})
}

func TestPosthogAdapter(t *testing.T) {
	// This tests the adapter functionality
	// Note: Actual PostHog client behavior is tested in the posthog package
	ctx := context.Background()

	cfg := Config{
		Enabled: true,
		PostHog: PostHogConfig{
			Enabled:       true,
			APIKey:        "phc_test_key",
			Host:          "https://eu.posthog.com",
			BatchSize:     100,
			FlushInterval: 10 * time.Second,
		},
	}

	tracker, err := NewTracker(cfg, nil)
	if err != nil {
		t.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(ctx)
	}()

	t.Run("Track adapts event", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "user-123").
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropStatus, "success")

		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Identify adapts properties", func(t *testing.T) {
		props := UserProperties{
			Email:    "test@example.com",
			Name:     "Test User",
			Plan:     "pro",
			Platform: "web",
			Custom: map[string]string{
				"org": "acme",
			},
		}

		err := tracker.Identify(ctx, "user-123", props)
		if err != nil {
			t.Errorf("Identify() error = %v", err)
		}
	})

	t.Run("Flush works", func(t *testing.T) {
		err := tracker.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v", err)
		}
	})
}

func TestOtelAdapter(t *testing.T) {
	ctx := context.Background()

	cfg := Config{
		Enabled: true,
		OTel: OTelConfig{
			Enabled:  true,
			Endpoint: "http://localhost:4318",
		},
	}

	tracker, err := NewTracker(cfg, nil)
	if err != nil {
		t.Fatalf("NewTracker() error = %v", err)
	}
	defer func() {
		_ = tracker.Shutdown(ctx)
	}()

	t.Run("Track adapts event", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "user-123").
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropStatus, "success").
			WithProperty(PropLatencyMs, int64(150))

		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}
	})

	t.Run("Identify is no-op but works", func(t *testing.T) {
		props := UserProperties{
			Email: "test@example.com",
			Name:  "Test User",
		}

		err := tracker.Identify(ctx, "user-123", props)
		if err != nil {
			t.Errorf("Identify() error = %v", err)
		}
	})

	t.Run("Flush works", func(t *testing.T) {
		err := tracker.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v", err)
		}
	})
}

// BenchmarkNewTracker measures tracker creation overhead
func BenchmarkNewTracker(b *testing.B) {
	cfg := Config{Enabled: false}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tracker, _ := NewTracker(cfg, nil)
		_ = tracker.Shutdown(context.Background())
	}
}
