// Package notify implements outbound notification delivery to supported
// providers (currently just Gotify). This exists so the browser never has
// to make a cross-origin request directly to a user's self-hosted Gotify
// instance (which Gotify's CORS policy would block); the cithara server
// makes the request instead.
package notify

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/asano69/cithara/internal/errs"
)

const requestTimeout = 10 * time.Second

// Message is the notification content delivered to a provider.
type Message struct {
	Title string
	Body  string
}

// TestGotify sends a harmless test message to a Gotify server, verifying
// both the endpoint URL and the app token are correct.
func TestGotify(endpoint, token string) error {
	return SendGotify(endpoint, token, Message{
		Title: "Cithara",
		Body:  "Test notification from Cithara settings.",
	})
}

// SendGotify delivers msg to a Gotify server at endpoint using token.
func SendGotify(endpoint, token string, msg Message) error {
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
		"title":    msg.Title,
		"message":  msg.Body,
		"priority": 4,
	})
	if err != nil {
		return errs.Newf("build request: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, msgURL.String(), bytes.NewReader(body))
	if err != nil {
		return errs.Newf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: requestTimeout}
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
