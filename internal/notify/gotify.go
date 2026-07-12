// Package notify implements outbound test connections for supported
// notification providers (currently just Gotify). This exists so the
// browser never has to make a cross-origin request directly to a user's
// self-hosted Gotify instance (which Gotify's CORS policy would block);
// the kithara server makes the request instead and reports the result back.
package notify

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/asano69/kithara/internal/errs"
)

const testTimeout = 10 * time.Second

// TestGotify sends a real (but harmless) test message to a Gotify server,
// verifying both the endpoint URL and the app token are correct.
func TestGotify(endpoint, token string) error {
	if endpoint == "" || token == "" {
		return errs.New("endpoint and token are required")
	}

	base, err := url.Parse(endpoint)
	if err != nil {
		return errs.Newf("invalid endpoint: %v", err)
	}
	msgURL := base.ResolveReference(&url.URL{Path: "/message"})
	q := msgURL.Query()
	q.Set("token", token)
	msgURL.RawQuery = q.Encode()

	body, err := json.Marshal(map[string]any{
		"title":    "Kithara",
		"message":  "Test notification from Kithara settings.",
		"priority": 1,
	})
	if err != nil {
		return errs.Newf("build request: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, msgURL.String(), bytes.NewReader(body))
	if err != nil {
		return errs.Newf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: testTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return errs.Newf("could not reach the endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return errs.New("invalid app token")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errs.Newf("gotify responded with status %d", resp.StatusCode)
	}
	return nil
}
