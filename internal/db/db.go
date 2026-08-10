// Package db wraps the embedded PocketBase datastore that persists card performance and
// review history. All persistence is issued through this package; no other package
// touches the datastore directly.
package db

import (
	"github.com/asano69/cithara/internal/errs"
	_ "github.com/asano69/cithara/migrations"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	"os"
)

type Database struct{ app *pocketbase.PocketBase }

// OpenScratch creates a Database backed by a fresh, disposable PocketBase
// instance in its own temporary directory. Each call returns an
// independent, empty database with no effect on any other Database.
// PocketBase always needs a directory on disk, so this is cithara'
// equivalent of SQLite's ":memory:" mode.
func OpenScratch() (*Database, error) {
	dir, err := os.MkdirTemp("", "cithara-pocketbase-*")
	if err != nil {
		return nil, errs.Newf("create temporary PocketBase data directory: %v", err)
	}
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: dir, HideStartBanner: true})
	if err := app.Bootstrap(); err != nil {
		return nil, errs.Newf("bootstrap PocketBase: %v", err)
	}
	return newDatabase(app)
}

// New wraps an already-bootstrapped PocketBase app and ensures the
// cithara schema exists in it. app is expected to be the single instance
// shared by the whole CLI (see cmd/cithara/main.go); its data directory is
// controlled by PocketBase's standard "--dir" flag, not by cithara itself.
func New(app *pocketbase.PocketBase) (*Database, error) {
	return newDatabase(app)
}

// newDatabase wraps app in a Database and applies any pending app-level
// schema migrations (see internal/migrations). System migrations
// (_collections, _params, ...) already ran inside app.Bootstrap(), so only
// the user-defined AppMigrations need to be applied here. Calling this on
// every startup (including in tests, via OpenScratch) is safe and
// idempotent — RunAppMigrations skips migrations already recorded in the
// _migrations table.
func newDatabase(app *pocketbase.PocketBase) (*Database, error) {
	if err := app.RunAppMigrations(); err != nil {
		return nil, errs.Newf("run migrations: %v", err)
	}

	db := &Database{app: app}

	return db, nil
}

// defaultGotifyPriority is used for notes that predate the "priority"
// field (or otherwise leave it unset), so the notification priority for
// old data stays the same as it always was.
const defaultGotifyPriority = 4

// Note is a snapshot of a "notes" record's scheduling-relevant fields.
// Dtstart and RRule are stored exactly as the frontend writes them: a
// floating (timezone-less) "YYYYMMDDTHHMMSS" string and a bare RRULE value
// with no "RRULE:" prefix (see NoteForm.jsx).
type Note struct {
	ID          string
	Label       string
	Description string
	Dtstart     string
	RRule       string
	Priority    int
}

// ListNotes returns every note in the "notes" collection.
func (d *Database) ListNotes() ([]Note, error) {
	records, err := d.app.FindAllRecords("notes")
	if err != nil {
		return nil, errs.Newf("list notes: %v", err)
	}

	notes := make([]Note, 0, len(records))
	for _, r := range records {
		notes = append(notes, Note{
			ID:          r.Id,
			Label:       r.GetString("label"),
			Description: r.GetString("description"),
			Dtstart:     r.GetString("dtstart"),
			RRule:       r.GetString("rrule"),
			Priority:    priorityOrDefault(r.GetInt("priority")),
		})
	}
	return notes, nil
}

// priorityOrDefault treats an unset (zero-value) priority as
// defaultGotifyPriority, so notes saved before the "priority" field
// existed keep their historical behavior.
func priorityOrDefault(priority int) int {
	if priority == 0 {
		return defaultGotifyPriority
	}
	return priority
}

// NotificationTarget is a snapshot of a "notifications" record's
// connection info for a single notification provider (currently only
// "gotify").
type NotificationTarget struct {
	ID       string
	Provider string
	Endpoint string
	Token    string
	Channel  string
}

// ListNotificationTargets returns every configured notification connection.
func (d *Database) ListNotificationTargets() ([]NotificationTarget, error) {
	records, err := d.app.FindAllRecords("notifications")
	if err != nil {
		return nil, errs.Newf("list notification targets: %v", err)
	}

	targets := make([]NotificationTarget, 0, len(records))
	for _, r := range records {
		targets = append(targets, NotificationTarget{
			ID:       r.Id,
			Provider: r.GetString("provider"),
			Endpoint: r.GetString("endpoint"),
			Token:    r.GetString("token"),
			Channel:  r.GetString("channel"),
		})
	}
	return targets, nil
}

// NotificationLogEntry is one persisted delivery attempt, used to render
// the notification timeline. NoteID/Label are stored as a snapshot rather
// than a relation, so history survives the note being edited or deleted.
type NotificationLogEntry struct {
	ID       string `json:"id"`
	NoteID   string `json:"noteId"`
	Label    string `json:"label"`
	Body     string `json:"body"`
	Provider string `json:"provider"`
	Success  bool   `json:"success"`
	Error    string `json:"error"`
	Created  string `json:"created"`
}

// RecordNotification appends one delivery attempt to the
// notification_history collection.
func (d *Database) RecordNotification(entry NotificationLogEntry) error {
	collection, err := d.app.FindCollectionByNameOrId("notification_history")
	if err != nil {
		return errs.Newf("find notification_history collection: %v", err)
	}

	record := core.NewRecord(collection)
	record.Set("noteId", entry.NoteID)
	record.Set("label", entry.Label)
	record.Set("body", entry.Body)
	record.Set("provider", entry.Provider)
	record.Set("success", entry.Success)
	record.Set("error", entry.Error)

	if err := d.app.Save(record); err != nil {
		return errs.Newf("save notification history: %v", err)
	}
	return nil
}

// ListNotificationHistory returns the most recent delivery attempts,
// newest first, for the timeline view.
func (d *Database) ListNotificationHistory(limit int) ([]NotificationLogEntry, error) {
	records, err := d.app.FindRecordsByFilter("notification_history", "", "-created", limit, 0)
	if err != nil {
		return nil, errs.Newf("list notification history: %v", err)
	}

	entries := make([]NotificationLogEntry, 0, len(records))
	for _, r := range records {
		entries = append(entries, NotificationLogEntry{
			ID:       r.Id,
			NoteID:   r.GetString("noteId"),
			Label:    r.GetString("label"),
			Body:     r.GetString("body"),
			Provider: r.GetString("provider"),
			Success:  r.GetBool("success"),
			Error:    r.GetString("error"),
			Created:  r.GetString("created"),
		})
	}
	return entries, nil
}
