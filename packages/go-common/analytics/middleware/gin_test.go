package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/janhq/jan-server/packages/go-common/analytics"
)

// MockTracker is a mock implementation for testing
type MockTracker struct {
	mu            sync.Mutex
	TrackedEvents []analytics.Event
	IdentifyCalls []struct {
		DistinctID string
		Props      analytics.UserProperties
	}
	FlushCalled    bool
	ShutdownCalled bool
}

func NewMockTracker() *MockTracker {
	return &MockTracker{
		TrackedEvents: make([]analytics.Event, 0),
	}
}

func (m *MockTracker) Track(ctx context.Context, event analytics.Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.TrackedEvents = append(m.TrackedEvents, event)
	return nil
}

func (m *MockTracker) Identify(ctx context.Context, distinctID string, props analytics.UserProperties) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.IdentifyCalls = append(m.IdentifyCalls, struct {
		DistinctID string
		Props      analytics.UserProperties
	}{distinctID, props})
	return nil
}

func (m *MockTracker) Flush(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.FlushCalled = true
	return nil
}

func (m *MockTracker) Shutdown(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ShutdownCalled = true
	return nil
}

func (m *MockTracker) GetTrackedEvents() []analytics.Event {
	m.mu.Lock()
	defer m.mu.Unlock()
	events := make([]analytics.Event, len(m.TrackedEvents))
	copy(events, m.TrackedEvents)
	return events
}

func init() {
	gin.SetMode(gin.TestMode)
}

func TestDefaultConfig(t *testing.T) {
	tracker := NewMockTracker()
	cfg := DefaultConfig(tracker)

	if cfg.Tracker != tracker {
		t.Error("Tracker should be set")
	}
	if cfg.TrackHTTPRequests {
		t.Error("TrackHTTPRequests should be false by default")
	}
	if len(cfg.ExcludePaths) == 0 {
		t.Error("ExcludePaths should have default values")
	}

	// Check default exclude paths
	expectedPaths := []string{"/health", "/healthz", "/ready", "/readyz", "/metrics", "/favicon.ico"}
	for _, path := range expectedPaths {
		found := false
		for _, p := range cfg.ExcludePaths {
			if p == path {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("ExcludePaths should include %s", path)
		}
	}
}

func TestAnalyticsMiddleware_SetsContextValues(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker:           tracker,
		TrackHTTPRequests: false,
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	var capturedCtx context.Context
	router.GET("/test", func(c *gin.Context) {
		capturedCtx = c.Request.Context()
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set(HeaderDistinctID, "user-123")
	req.Header.Set(HeaderSessionID, "session-456")
	req.Header.Set(HeaderPlatform, "ios")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify context values
	if analytics.DistinctIDFromContext(capturedCtx) != "user-123" {
		t.Errorf("DistinctID = %s, want user-123", analytics.DistinctIDFromContext(capturedCtx))
	}
	if analytics.SessionIDFromContext(capturedCtx) != "session-456" {
		t.Errorf("SessionID = %s, want session-456", analytics.SessionIDFromContext(capturedCtx))
	}
	if analytics.PlatformFromContext(capturedCtx) != "ios" {
		t.Errorf("Platform = %s, want ios", analytics.PlatformFromContext(capturedCtx))
	}
	if analytics.UserStatusFromContext(capturedCtx) != "guest" {
		t.Errorf("UserStatus = %s, want guest", analytics.UserStatusFromContext(capturedCtx))
	}
}

func TestAnalyticsMiddleware_DefaultPlatform(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker: tracker,
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	var capturedPlatform string
	router.GET("/test", func(c *gin.Context) {
		capturedPlatform = analytics.PlatformFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	// No platform header set
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if capturedPlatform != "web" {
		t.Errorf("Platform = %s, want web (default)", capturedPlatform)
	}
}

func TestAnalyticsMiddleware_CustomUserStatusExtractor(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker: tracker,
		ExtractUserStatus: func(c *gin.Context) string {
			return "premium"
		},
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	var capturedUserStatus string
	router.GET("/test", func(c *gin.Context) {
		capturedUserStatus = analytics.UserStatusFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if capturedUserStatus != "premium" {
		t.Errorf("UserStatus = %s, want premium", capturedUserStatus)
	}
}

func TestAnalyticsMiddleware_TracksHTTPRequests(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker:           tracker,
		TrackHTTPRequests: true,
	}

	router := gin.New()
	router.Use(Analytics(cfg))
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set(HeaderDistinctID, "user-123")
	req.Header.Set(HeaderRequestID, "req-789")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Wait for async tracking
	time.Sleep(100 * time.Millisecond)

	events := tracker.GetTrackedEvents()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}

	event := events[0]
	if event.Name != analytics.EventHTTPRequest {
		t.Errorf("event name = %s, want %s", event.Name, analytics.EventHTTPRequest)
	}
	if event.DistinctID != "user-123" {
		t.Errorf("distinctID = %s, want user-123", event.DistinctID)
	}
	if event.Properties["method"] != "GET" {
		t.Errorf("method = %v, want GET", event.Properties["method"])
	}
	if event.Properties["path"] != "/test" {
		t.Errorf("path = %v, want /test", event.Properties["path"])
	}
	if event.Properties["status"] != 200 {
		t.Errorf("status = %v, want 200", event.Properties["status"])
	}
	if event.Properties[analytics.PropRequestID] != "req-789" {
		t.Errorf("request_id = %v, want req-789", event.Properties[analytics.PropRequestID])
	}
}

func TestAnalyticsMiddleware_SkipsExcludedPaths(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker:           tracker,
		TrackHTTPRequests: true,
		ExcludePaths:      []string{"/health", "/metrics"},
	}

	router := gin.New()
	router.Use(Analytics(cfg))
	router.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.GET("/metrics", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.GET("/api/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Request excluded paths
	for _, path := range []string{"/health", "/metrics"} {
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set(HeaderDistinctID, "user-123")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}

	// Wait for async tracking
	time.Sleep(100 * time.Millisecond)

	// No events should be tracked for excluded paths
	events := tracker.GetTrackedEvents()
	if len(events) != 0 {
		t.Errorf("got %d events for excluded paths, want 0", len(events))
	}

	// Request non-excluded path
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set(HeaderDistinctID, "user-123")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Wait for async tracking
	time.Sleep(100 * time.Millisecond)

	events = tracker.GetTrackedEvents()
	if len(events) != 1 {
		t.Errorf("got %d events, want 1 for non-excluded path", len(events))
	}
}

func TestAnalyticsMiddleware_SkipsWithoutDistinctID(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker:           tracker,
		TrackHTTPRequests: true,
	}

	router := gin.New()
	router.Use(Analytics(cfg))
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Request without distinct ID
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Wait for async tracking
	time.Sleep(100 * time.Millisecond)

	events := tracker.GetTrackedEvents()
	if len(events) != 0 {
		t.Errorf("got %d events, want 0 (no distinct ID)", len(events))
	}
}

func TestExtractDistinctID(t *testing.T) {
	t.Run("from custom extractor", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)

		extractor := func(c *gin.Context) string {
			return "custom-user-id"
		}

		id := extractDistinctID(c, extractor)
		if id != "custom-user-id" {
			t.Errorf("got %s, want custom-user-id", id)
		}
	})

	t.Run("from PostHog header", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set(HeaderDistinctID, "header-user-id")

		id := extractDistinctID(c, nil)
		if id != "header-user-id" {
			t.Errorf("got %s, want header-user-id", id)
		}
	})

	t.Run("from user_id in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Set("user_id", "context-user-id")

		id := extractDistinctID(c, nil)
		if id != "context-user-id" {
			t.Errorf("got %s, want context-user-id", id)
		}
	})

	t.Run("from subject in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Set("subject", "subject-user-id")

		id := extractDistinctID(c, nil)
		if id != "subject-user-id" {
			t.Errorf("got %s, want subject-user-id", id)
		}
	})

	t.Run("returns empty when nothing found", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)

		id := extractDistinctID(c, nil)
		if id != "" {
			t.Errorf("got %s, want empty string", id)
		}
	})

	t.Run("custom extractor fallback to header", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set(HeaderDistinctID, "header-user-id")

		// Custom extractor returns empty string
		extractor := func(c *gin.Context) string {
			return ""
		}

		id := extractDistinctID(c, extractor)
		if id != "header-user-id" {
			t.Errorf("got %s, want header-user-id (fallback)", id)
		}
	})

	t.Run("priority order: custom > header > user_id > subject", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set(HeaderDistinctID, "header-id")
		c.Set("user_id", "user-id")
		c.Set("subject", "subject-id")

		// Custom extractor has highest priority
		extractor := func(c *gin.Context) string {
			return "custom-id"
		}
		id := extractDistinctID(c, extractor)
		if id != "custom-id" {
			t.Errorf("custom extractor priority: got %s, want custom-id", id)
		}

		// Header is second priority
		id = extractDistinctID(c, nil)
		if id != "header-id" {
			t.Errorf("header priority: got %s, want header-id", id)
		}

		// Without header, user_id is next
		c2, _ := gin.CreateTestContext(httptest.NewRecorder())
		c2.Request = httptest.NewRequest("GET", "/test", nil)
		c2.Set("user_id", "user-id")
		c2.Set("subject", "subject-id")
		id = extractDistinctID(c2, nil)
		if id != "user-id" {
			t.Errorf("user_id priority: got %s, want user-id", id)
		}

		// Without user_id, subject is last
		c3, _ := gin.CreateTestContext(httptest.NewRecorder())
		c3.Request = httptest.NewRequest("GET", "/test", nil)
		c3.Set("subject", "subject-id")
		id = extractDistinctID(c3, nil)
		if id != "subject-id" {
			t.Errorf("subject priority: got %s, want subject-id", id)
		}
	})
}

func TestTrackerFromGin(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker: tracker,
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	var retrievedTracker analytics.Tracker
	router.GET("/test", func(c *gin.Context) {
		retrievedTracker = TrackerFromGin(c)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if retrievedTracker == nil {
		t.Error("TrackerFromGin returned nil")
	}

	// The tracker should be usable
	err := retrievedTracker.Track(context.Background(), analytics.NewEvent(analytics.EventChatResponse, "user-123"))
	if err != nil {
		t.Errorf("Track error = %v", err)
	}
}

func TestTrackEvent(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker: tracker,
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	router.GET("/test", func(c *gin.Context) {
		err := TrackEvent(c, analytics.EventChatResponse, map[string]interface{}{
			analytics.PropModel:  "gpt-4",
			analytics.PropStatus: "success",
		})
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set(HeaderDistinctID, "user-123")
	req.Header.Set(HeaderSessionID, "session-456")
	req.Header.Set(HeaderPlatform, "android")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	events := tracker.GetTrackedEvents()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}

	event := events[0]
	if event.Name != analytics.EventChatResponse {
		t.Errorf("event name = %s, want %s", event.Name, analytics.EventChatResponse)
	}
	if event.DistinctID != "user-123" {
		t.Errorf("distinctID = %s, want user-123", event.DistinctID)
	}
	if event.Properties[analytics.PropModel] != "gpt-4" {
		t.Errorf("model = %v, want gpt-4", event.Properties[analytics.PropModel])
	}
	if event.Properties[analytics.PropStatus] != "success" {
		t.Errorf("status = %v, want success", event.Properties[analytics.PropStatus])
	}

	// Check that context values were enriched
	if event.Properties[analytics.PropSessionID] != "session-456" {
		t.Errorf("session_id = %v, want session-456", event.Properties[analytics.PropSessionID])
	}
	if event.Properties[analytics.PropPlatform] != "android" {
		t.Errorf("platform = %v, want android", event.Properties[analytics.PropPlatform])
	}
	if event.Properties[analytics.PropUserStatus] != "guest" {
		t.Errorf("user_status = %v, want guest", event.Properties[analytics.PropUserStatus])
	}
}

func TestTrackEvent_WithoutDistinctID(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker: tracker,
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	router.GET("/test", func(c *gin.Context) {
		// This should still work, but with empty distinct ID
		err := TrackEvent(c, analytics.EventChatResponse, map[string]interface{}{
			analytics.PropModel: "gpt-4",
		})
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// The tracking should still happen (validation is at tracker level)
	events := tracker.GetTrackedEvents()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}

	if events[0].DistinctID != "" {
		t.Errorf("distinctID = %s, want empty", events[0].DistinctID)
	}
}

func TestAnalyticsMiddleware_TrackerInContext(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker: tracker,
	}

	router := gin.New()
	router.Use(Analytics(cfg))

	router.GET("/test", func(c *gin.Context) {
		// Get tracker from context and use it directly
		ctx := c.Request.Context()
		t := analytics.TrackerFromContext(ctx)

		event := analytics.NewEvent(analytics.EventChatResponse, "user-123").
			WithProperty(analytics.PropModel, "gpt-4")
		_ = t.Track(ctx, event)

		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	events := tracker.GetTrackedEvents()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}
}

func TestAnalyticsMiddleware_CustomDistinctIDExtractor(t *testing.T) {
	tracker := NewMockTracker()
	cfg := Config{
		Tracker:           tracker,
		TrackHTTPRequests: true,
		ExtractDistinctID: func(c *gin.Context) string {
			// Extract from custom header
			return c.GetHeader("X-Custom-User-ID")
		},
	}

	router := gin.New()
	router.Use(Analytics(cfg))
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Custom-User-ID", "custom-extracted-user")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Wait for async tracking
	time.Sleep(100 * time.Millisecond)

	events := tracker.GetTrackedEvents()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}

	if events[0].DistinctID != "custom-extracted-user" {
		t.Errorf("distinctID = %s, want custom-extracted-user", events[0].DistinctID)
	}
}

// Verify MockTracker implements Tracker interface
var _ analytics.Tracker = (*MockTracker)(nil)
