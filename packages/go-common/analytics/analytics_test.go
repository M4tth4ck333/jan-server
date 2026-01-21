package analytics

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestNoopTracker(t *testing.T) {
	tracker := NewNoopTracker()
	ctx := context.Background()

	t.Run("Track returns nil", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "user-123")
		err := tracker.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v, want nil", err)
		}
	})

	t.Run("Identify returns nil", func(t *testing.T) {
		err := tracker.Identify(ctx, "user-123", UserProperties{Email: "test@example.com"})
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
}

// MockTracker is a mock implementation for testing MultiTracker
type MockTracker struct {
	mu            sync.Mutex
	TrackedEvents []Event
	IdentifyCalls []struct {
		DistinctID string
		Props      UserProperties
	}
	FlushCalled    bool
	ShutdownCalled bool
	TrackError     error
	IdentifyError  error
	FlushError     error
	ShutdownError  error
}

func NewMockTracker() *MockTracker {
	return &MockTracker{
		TrackedEvents: make([]Event, 0),
	}
}

func (m *MockTracker) Track(ctx context.Context, event Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.TrackError != nil {
		return m.TrackError
	}
	m.TrackedEvents = append(m.TrackedEvents, event)
	return nil
}

func (m *MockTracker) Identify(ctx context.Context, distinctID string, props UserProperties) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.IdentifyError != nil {
		return m.IdentifyError
	}
	m.IdentifyCalls = append(m.IdentifyCalls, struct {
		DistinctID string
		Props      UserProperties
	}{distinctID, props})
	return nil
}

func (m *MockTracker) Flush(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.FlushCalled = true
	return m.FlushError
}

func (m *MockTracker) Shutdown(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ShutdownCalled = true
	return m.ShutdownError
}

func (m *MockTracker) GetTrackedEvents() []Event {
	m.mu.Lock()
	defer m.mu.Unlock()
	events := make([]Event, len(m.TrackedEvents))
	copy(events, m.TrackedEvents)
	return events
}

func TestMultiTracker(t *testing.T) {
	ctx := context.Background()

	t.Run("creates with no-op when analytics disabled", func(t *testing.T) {
		cfg := Config{Enabled: false}
		mt, err := NewMultiTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewMultiTracker() error = %v", err)
		}

		// Should work without error (no-op)
		event := NewEvent(EventChatResponse, "user-123")
		err = mt.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v, want nil", err)
		}
	})

	t.Run("registers and tracks to multiple backends", func(t *testing.T) {
		cfg := Config{Enabled: true, Environment: "test"}
		mt, err := NewMultiTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewMultiTracker() error = %v", err)
		}

		mock1 := NewMockTracker()
		mock2 := NewMockTracker()

		mt.RegisterBackend(mock1)
		mt.RegisterBackend(mock2)

		event := NewEvent(EventChatResponse, "user-123").
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropStatus, "success")

		err = mt.Track(ctx, event)
		if err != nil {
			t.Errorf("Track() error = %v", err)
		}

		// Both backends should have received the event
		if len(mock1.GetTrackedEvents()) != 1 {
			t.Errorf("mock1 got %d events, want 1", len(mock1.GetTrackedEvents()))
		}
		if len(mock2.GetTrackedEvents()) != 1 {
			t.Errorf("mock2 got %d events, want 1", len(mock2.GetTrackedEvents()))
		}

		// Check environment was enriched
		trackedEvent := mock1.GetTrackedEvents()[0]
		if trackedEvent.Properties[PropEnvironment] != "test" {
			t.Errorf("environment = %v, want 'test'", trackedEvent.Properties[PropEnvironment])
		}
	})

	t.Run("validates events", func(t *testing.T) {
		cfg := Config{Enabled: true}
		mt, err := NewMultiTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewMultiTracker() error = %v", err)
		}

		// Event without name
		event := Event{DistinctID: "user-123"}
		err = mt.Track(ctx, event)
		if err != ErrInvalidEvent {
			t.Errorf("Track() error = %v, want ErrInvalidEvent", err)
		}

		// Event without distinct ID
		event = Event{Name: EventChatResponse}
		err = mt.Track(ctx, event)
		if err != ErrMissingDistinctID {
			t.Errorf("Track() error = %v, want ErrMissingDistinctID", err)
		}
	})

	t.Run("flushes all backends", func(t *testing.T) {
		cfg := Config{Enabled: true}
		mt, err := NewMultiTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewMultiTracker() error = %v", err)
		}

		mock1 := NewMockTracker()
		mock2 := NewMockTracker()

		mt.RegisterBackend(mock1)
		mt.RegisterBackend(mock2)

		err = mt.Flush(ctx)
		if err != nil {
			t.Errorf("Flush() error = %v", err)
		}

		if !mock1.FlushCalled {
			t.Error("mock1.Flush was not called")
		}
		if !mock2.FlushCalled {
			t.Error("mock2.Flush was not called")
		}
	})

	t.Run("shuts down all backends", func(t *testing.T) {
		cfg := Config{Enabled: true}
		mt, err := NewMultiTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewMultiTracker() error = %v", err)
		}

		mock := NewMockTracker()
		mt.RegisterBackend(mock)

		err = mt.Shutdown(ctx)
		if err != nil {
			t.Errorf("Shutdown() error = %v", err)
		}

		if !mock.ShutdownCalled {
			t.Error("mock.Shutdown was not called")
		}
	})

	t.Run("identify requires distinct ID", func(t *testing.T) {
		cfg := Config{Enabled: true}
		mt, err := NewMultiTracker(cfg, nil)
		if err != nil {
			t.Fatalf("NewMultiTracker() error = %v", err)
		}

		err = mt.Identify(ctx, "", UserProperties{})
		if err != ErrMissingDistinctID {
			t.Errorf("Identify() error = %v, want ErrMissingDistinctID", err)
		}
	})
}

func TestEvent(t *testing.T) {
	t.Run("NewEvent creates event with timestamp", func(t *testing.T) {
		before := time.Now().UTC()
		event := NewEvent(EventChatResponse, "user-123")
		after := time.Now().UTC()

		if event.Name != EventChatResponse {
			t.Errorf("Name = %v, want %v", event.Name, EventChatResponse)
		}
		if event.DistinctID != "user-123" {
			t.Errorf("DistinctID = %v, want user-123", event.DistinctID)
		}
		if event.Timestamp.Before(before) || event.Timestamp.After(after) {
			t.Errorf("Timestamp = %v, not in expected range", event.Timestamp)
		}
		if event.Properties == nil {
			t.Error("Properties should not be nil")
		}
	})

	t.Run("WithProperty adds property", func(t *testing.T) {
		event := NewEvent(EventChatResponse, "user-123").
			WithProperty(PropModel, "gpt-4").
			WithProperty(PropStatus, "success")

		if event.Properties[PropModel] != "gpt-4" {
			t.Errorf("Properties[model] = %v, want gpt-4", event.Properties[PropModel])
		}
		if event.Properties[PropStatus] != "success" {
			t.Errorf("Properties[status] = %v, want success", event.Properties[PropStatus])
		}
	})

	t.Run("WithProperties adds multiple properties", func(t *testing.T) {
		props := map[string]interface{}{
			PropModel:  "gpt-4",
			PropStatus: "success",
			PropMode:   "chat",
		}
		event := NewEvent(EventChatResponse, "user-123").WithProperties(props)

		for k, v := range props {
			if event.Properties[k] != v {
				t.Errorf("Properties[%s] = %v, want %v", k, event.Properties[k], v)
			}
		}
	})

	t.Run("Validate checks required fields", func(t *testing.T) {
		tests := []struct {
			name    string
			event   Event
			wantErr error
		}{
			{
				name:    "missing name",
				event:   Event{DistinctID: "user-123"},
				wantErr: ErrInvalidEvent,
			},
			{
				name:    "missing distinct ID",
				event:   Event{Name: EventChatResponse},
				wantErr: ErrMissingDistinctID,
			},
			{
				name:    "valid event",
				event:   Event{Name: EventChatResponse, DistinctID: "user-123"},
				wantErr: nil,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.event.Validate()
				if err != tt.wantErr {
					t.Errorf("Validate() error = %v, want %v", err, tt.wantErr)
				}
			})
		}
	})
}

func TestUserProperties(t *testing.T) {
	t.Run("ToMap converts properties", func(t *testing.T) {
		props := UserProperties{
			Email:     "test@example.com",
			Name:      "Test User",
			Plan:      "pro",
			Platform:  "web",
			CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			Custom: map[string]string{
				"org": "acme",
			},
		}

		m := props.ToMap()

		if m["email"] != "test@example.com" {
			t.Errorf("email = %v, want test@example.com", m["email"])
		}
		if m["name"] != "Test User" {
			t.Errorf("name = %v, want Test User", m["name"])
		}
		if m["plan"] != "pro" {
			t.Errorf("plan = %v, want pro", m["plan"])
		}
		if m["platform"] != "web" {
			t.Errorf("platform = %v, want web", m["platform"])
		}
		if m["org"] != "acme" {
			t.Errorf("org = %v, want acme", m["org"])
		}
	})

	t.Run("ToMap excludes empty fields", func(t *testing.T) {
		props := UserProperties{
			Email: "test@example.com",
		}

		m := props.ToMap()

		if _, ok := m["name"]; ok {
			t.Error("empty name should not be in map")
		}
		if _, ok := m["plan"]; ok {
			t.Error("empty plan should not be in map")
		}
	})
}

func TestSanitization(t *testing.T) {
	t.Run("sanitizes PII-sensitive keys with email content", func(t *testing.T) {
		sanitizer := NewSanitizer(PIILevelHashed, "test-service")
		cfg := Config{Enabled: true, Environment: "test"}
		mt, _ := NewMultiTracker(cfg, sanitizer)

		mock := NewMockTracker()
		mt.RegisterBackend(mock)

		// Use content that contains actual PII patterns (email)
		event := NewEvent(EventChatResponse, "user-123").
			WithProperty("email", "test@example.com").
			WithProperty("prompt", "Contact me at user@domain.com please").
			WithProperty(PropModel, "gpt-4")

		ctx := context.Background()
		_ = mt.Track(ctx, event)

		tracked := mock.GetTrackedEvents()[0]

		// model should remain unchanged (not a PII-sensitive key)
		if tracked.Properties[PropModel] != "gpt-4" {
			t.Errorf("model should not be sanitized, got %v", tracked.Properties[PropModel])
		}

		// Email field should be sanitized (hashed pattern)
		emailVal, ok := tracked.Properties["email"].(string)
		if !ok || emailVal == "test@example.com" {
			t.Error("email should be sanitized")
		}

		// Prompt containing email should be sanitized
		promptVal, ok := tracked.Properties["prompt"].(string)
		if !ok || promptVal == "Contact me at user@domain.com please" {
			t.Error("prompt with email should be sanitized")
		}
	})

	t.Run("redacts all with PIILevelNone", func(t *testing.T) {
		sanitizer := NewSanitizer(PIILevelNone, "test-service")
		cfg := Config{Enabled: true, Environment: "test"}
		mt, _ := NewMultiTracker(cfg, sanitizer)

		mock := NewMockTracker()
		mt.RegisterBackend(mock)

		event := NewEvent(EventChatResponse, "user-123").
			WithProperty("email", "test@example.com").
			WithProperty("prompt", "any content")

		ctx := context.Background()
		_ = mt.Track(ctx, event)

		tracked := mock.GetTrackedEvents()[0]

		// All PII-sensitive fields should be [REDACTED]
		if tracked.Properties["email"] != "[REDACTED]" {
			t.Errorf("email should be [REDACTED], got %v", tracked.Properties["email"])
		}
		if tracked.Properties["prompt"] != "[REDACTED]" {
			t.Errorf("prompt should be [REDACTED], got %v", tracked.Properties["prompt"])
		}
	})

	t.Run("preserves all with PIILevelFull", func(t *testing.T) {
		sanitizer := NewSanitizer(PIILevelFull, "test-service")
		cfg := Config{Enabled: true, Environment: "test"}
		mt, _ := NewMultiTracker(cfg, sanitizer)

		mock := NewMockTracker()
		mt.RegisterBackend(mock)

		event := NewEvent(EventChatResponse, "user-123").
			WithProperty("email", "test@example.com").
			WithProperty("prompt", "my secret prompt")

		ctx := context.Background()
		_ = mt.Track(ctx, event)

		tracked := mock.GetTrackedEvents()[0]

		// Nothing should be sanitized
		if tracked.Properties["email"] != "test@example.com" {
			t.Errorf("email should be preserved, got %v", tracked.Properties["email"])
		}
		if tracked.Properties["prompt"] != "my secret prompt" {
			t.Errorf("prompt should be preserved, got %v", tracked.Properties["prompt"])
		}
	})
}

func TestIsPIISensitiveKey(t *testing.T) {
	tests := []struct {
		key      string
		expected bool
	}{
		{"email", true},
		{"name", true},
		{"user_name", true},
		{"phone", true},
		{"address", true},
		{"ip", true},
		{"ip_address", true},
		{"content", true},
		{"message", true},
		{"prompt", true},
		{"response", true},
		{"error_message", true},
		{"model", false},
		{"status", false},
		{"platform", false},
		{"tokens_total", false},
	}

	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			result := isPIISensitiveKey(tt.key)
			if result != tt.expected {
				t.Errorf("isPIISensitiveKey(%q) = %v, want %v", tt.key, result, tt.expected)
			}
		})
	}
}

// Ensure interfaces are satisfied
var _ Tracker = (*NoopTracker)(nil)
var _ Tracker = (*MultiTracker)(nil)
var _ Tracker = (*MockTracker)(nil)
