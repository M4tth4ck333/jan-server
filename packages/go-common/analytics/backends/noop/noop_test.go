package noop

import (
	"context"
	"testing"
	"time"
)

func TestNoopTracker(t *testing.T) {
	tracker := New()
	ctx := context.Background()

	t.Run("Track returns nil", func(t *testing.T) {
		event := Event{
			Name:       "test_event",
			DistinctID: "user-123",
			Timestamp:  time.Now(),
			Properties: map[string]interface{}{"key": "value"},
		}
		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v, want nil", err)
		}
	})

	t.Run("Track with empty event returns nil", func(t *testing.T) {
		err := tracker.Track(ctx, Event{})
		if err != nil {
			t.Errorf("Track() error = %v, want nil", err)
		}
	})

	t.Run("Identify returns nil", func(t *testing.T) {
		props := UserProperties{
			Email:     "test@example.com",
			Name:      "Test User",
			CreatedAt: time.Now(),
			Plan:      "pro",
			Platform:  "web",
			Custom:    map[string]string{"org": "acme"},
		}
		err := tracker.Identify(ctx, "user-123", props)
		if err != nil {
			t.Errorf("Identify() error = %v, want nil", err)
		}
	})

	t.Run("Identify with empty ID returns nil", func(t *testing.T) {
		err := tracker.Identify(ctx, "", UserProperties{})
		if err != nil {
			t.Errorf("Identify() error = %v, want nil", err)
		}
	})

	t.Run("Flush returns nil", func(t *testing.T) {
		err := tracker.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v, want nil", err)
		}
	})

	t.Run("Shutdown returns nil", func(t *testing.T) {
		err := tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v, want nil", err)
		}
	})

	t.Run("Multiple operations are safe", func(t *testing.T) {
		// Test that multiple operations don't cause any issues
		for i := 0; i < 100; i++ {
			event := Event{
				Name:       "test_event",
				DistinctID: "user-123",
				Timestamp:  time.Now(),
			}
			if err := tracker.Track(ctx, event); err != nil {
				t.Errorf("Track() iteration %d error = %v", i, err)
			}
		}

		if err := tracker.Flush(ctx); err != nil {
			t.Errorf("Flush() error = %v", err)
		}

		if err := tracker.Shutdown(ctx); err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}
	})
}

func TestTrackerWithCancelledContext(t *testing.T) {
	tracker := New()
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	t.Run("Track with cancelled context returns nil", func(t *testing.T) {
		err := tracker.Track(ctx, Event{Name: "test"})
		if err != nil {
			t.Errorf("Track() error = %v, want nil", err)
		}
	})

	t.Run("Identify with cancelled context returns nil", func(t *testing.T) {
		err := tracker.Identify(ctx, "user-123", UserProperties{})
		if err != nil {
			t.Errorf("Identify() error = %v, want nil", err)
		}
	})

	t.Run("Flush with cancelled context returns nil", func(t *testing.T) {
		err := tracker.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v, want nil", err)
		}
	})

	t.Run("Shutdown with cancelled context returns nil", func(t *testing.T) {
		err := tracker.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v, want nil", err)
		}
	})
}

// BenchmarkNoopTracker ensures the noop tracker has minimal overhead
func BenchmarkNoopTracker(b *testing.B) {
	tracker := New()
	ctx := context.Background()
	event := Event{
		Name:       "benchmark_event",
		DistinctID: "user-123",
		Timestamp:  time.Now(),
		Properties: map[string]interface{}{
			"model":   "gpt-4",
			"status":  "success",
			"latency": 100,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = tracker.Track(ctx, event)
	}
}
