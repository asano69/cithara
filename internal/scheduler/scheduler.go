// Package scheduler evaluates each note's recurrence rule (RFC 5545 RRULE)
// and fires a Gotify notification at the moment each occurrence is due.
//
// Instead of polling the database every minute, the scheduler computes the
// next occurrence for every note once, then sleeps until exactly that
// moment (a single timer for the earliest upcoming occurrence). Whenever
// the notes collection changes, call Reload to recompute everything from
// scratch — this is simpler and safer than patching the in-memory schedule
// incrementally, and the note count is small enough that a full reload is
// cheap.

package scheduler

import (
	"context"
	"fmt"
	"github.com/asano69/kithara/internal/db"
	"github.com/asano69/kithara/internal/errs"
	"github.com/asano69/kithara/internal/notify"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/teambition/rrule-go"
)

// entry is one note's parsed recurrence rule together with its next due
// occurrence.
type entry struct {
	note db.Note
	rule *rrule.RRule
	next time.Time
}

// ScheduleEntry is a read-only view of one note's next scheduled
// occurrence, exposed for debugging via Scheduler.Snapshot. It carries no
// behavior — only what a person troubleshooting a missed notification
// needs to see.
type ScheduleEntry struct {
	NoteID  string    `json:"noteId"`
	Label   string    `json:"label"`
	Dtstart string    `json:"dtstart"`
	RRule   string    `json:"rrule"`
	Next    time.Time `json:"next"`
}

// Scheduler waits for the next due note occurrence and sends a
// notification for it. Create one with New and start it with Run.
type Scheduler struct {
	db     *db.Database
	reload chan struct{}

	// mu guards snapshot, which Run() publishes every time it recomputes
	// or advances the schedule. This lets Snapshot() be called safely
	// from any goroutine (e.g. an HTTP handler) without touching Run()'s
	// internal state directly.
	mu       sync.RWMutex
	snapshot []ScheduleEntry
}

// New creates a Scheduler backed by database. Call Run to start it.
func New(database *db.Database) *Scheduler {
	return &Scheduler{
		db: database,
		// Buffered so Reload never blocks its caller (e.g. a PocketBase
		// record hook) waiting for the scheduler goroutine to catch up.
		reload: make(chan struct{}, 1),
	}
}

// Reload tells the scheduler to recompute every note's next occurrence
// from the database. Safe to call from any goroutine.
func (s *Scheduler) Reload() {
	select {
	case s.reload <- struct{}{}:
	default:
		// A reload is already pending; it will pick up whatever is
		// currently in the database, so this extra request is redundant.
	}
}

// Snapshot returns the scheduler's current in-memory view of each note's
// next occurrence. This is a debugging aid only — nothing here is
// persisted, and the result reflects whatever Run() last computed, which
// may be a moment out of date if a reload is in flight.
func (s *Scheduler) Snapshot() []ScheduleEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]ScheduleEntry, len(s.snapshot))
	copy(out, s.snapshot)
	return out
}

// setSnapshot replaces the exported snapshot to match entries. Called
// from Run() every time entries changes (after a reload and after firing
// due notifications), never concurrently, so no lock is needed on the
// entries side.
func (s *Scheduler) setSnapshot(entries []entry) {
	next := make([]ScheduleEntry, 0, len(entries))
	for _, e := range entries {
		next = append(next, ScheduleEntry{
			NoteID:  e.note.ID,
			Label:   e.note.Label,
			Dtstart: e.note.Dtstart,
			RRule:   e.note.RRule,
			Next:    e.next,
		})
	}

	s.mu.Lock()
	s.snapshot = next
	s.mu.Unlock()
}

// Run loads the schedule and waits for occurrences to become due, sending
// a notification for each, until ctx is cancelled. It blocks, so callers
// typically start it with `go sched.Run(ctx)`.
func (s *Scheduler) Run(ctx context.Context) {
	entries := s.mustLoad()
	s.setSnapshot(entries)

	for {
		timerC, timer := nextTimer(entries)

		select {
		case <-ctx.Done():
			stopTimer(timer)
			return

		case <-s.reload:
			stopTimer(timer)
			entries = s.mustLoad()
			s.setSnapshot(entries)

		case <-timerC:
			entries = s.fireDue(entries)
			s.setSnapshot(entries)
		}
	}
}

// mustLoad loads the schedule, logging (rather than failing) any error so
// a transient database problem doesn't kill the scheduler goroutine.
func (s *Scheduler) mustLoad() []entry {
	entries, err := s.load()
	if err != nil {
		logrus.WithError(err).Error("scheduler: load failed")
		return nil
	}
	return entries
}

// load reads every note, parses its recurrence rule, and computes its
// next occurrence after now. Notes with an invalid rule or no remaining
// occurrences are skipped.
func (s *Scheduler) load() ([]entry, error) {
	notes, err := s.db.ListNotes()
	if err != nil {
		return nil, errs.Newf("load notes: %v", err)
	}

	now := time.Now().UTC()
	entries := make([]entry, 0, len(notes))
	for _, note := range notes {
		rule, err := parseRule(note)
		if err != nil {
			logrus.WithError(err).WithField("note", note.ID).
				Warn("scheduler: skipping note with invalid rule")
			continue
		}

		next := rule.After(now, false)
		if next.IsZero() {
			continue // no more occurrences
		}

		entries = append(entries, entry{note: note, rule: rule, next: next})
	}
	return entries, nil
}

// parseRule builds an *rrule.RRule from a note's stored dtstart/rrule
// fields. Both are floating (timezone-less) per CLAUDE.md: dtstart is
// parsed as a plain UTC-labelled wall-clock time, matching how the
// frontend serializes it (see NoteForm.jsx's toDtstartString).
func parseRule(note db.Note) (*rrule.RRule, error) {
	option, err := rrule.StrToROption(note.RRule)
	if err != nil {
		return nil, errs.Newf("parse rrule: %v", err)
	}

	dtstart, err := rrule.StrToDtStart(note.Dtstart, time.UTC)
	if err != nil {
		return nil, errs.Newf("parse dtstart: %v", err)
	}
	option.Dtstart = dtstart

	rule, err := rrule.NewRRule(*option)
	if err != nil {
		return nil, errs.Newf("build rrule: %v", err)
	}
	return rule, nil
}

// fireDue sends a notification for every entry whose next occurrence is
// now due, then advances those entries to their following occurrence.
// Entries with no further occurrences are dropped.
func (s *Scheduler) fireDue(entries []entry) []entry {
	now := time.Now().UTC()

	targets, err := s.db.ListNotificationTargets()
	if err != nil {
		logrus.WithError(err).Error("scheduler: loading notification targets failed")
	}

	next := make([]entry, 0, len(entries))
	for _, e := range entries {
		if e.next.After(now) {
			next = append(next, e)
			continue
		}

		s.notify(e.note, targets)

		e.next = e.rule.After(e.next, false)
		if !e.next.IsZero() {
			next = append(next, e)
		}
	}
	return next
}

// buildMessageBody joins the note's label and description as
// "label: description". If description is empty, only the label is
// used, since a trailing ": " with nothing after it looks broken and
// Gotify may reject an effectively-empty message.
func buildMessageBody(note db.Note) string {
	if note.Description == "" {
		return note.Label
	}
	return fmt.Sprintf("%s: %s", note.Label, note.Description)
}

// notify sends note's message to every configured Gotify target, logging
// (rather than failing) any delivery error so one broken connection
// doesn't stop the others from receiving it.
func (s *Scheduler) notify(note db.Note, targets []db.NotificationTarget) {
	msg := notify.Message{Title: "Kithara", Body: buildMessageBody(note)}

	for _, t := range targets {
		if t.Provider != "gotify" {
			continue
		}
		if err := notify.SendGotify(t.Endpoint, t.Token, msg); err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"note":   note.ID,
				"target": t.ID,
			}).Error("scheduler: notification delivery failed")
		}
	}
}

// nextTimer returns a channel that fires at the earliest entries[i].next,
// or a nil channel if entries is empty. A nil channel blocks forever in a
// select, which is exactly "no timer needed yet".
func nextTimer(entries []entry) (<-chan time.Time, *time.Timer) {
	if len(entries) == 0 {
		return nil, nil
	}

	earliest := entries[0].next
	for _, e := range entries[1:] {
		if e.next.Before(earliest) {
			earliest = e.next
		}
	}

	d := time.Until(earliest)
	if d < 0 {
		d = 0
	}
	timer := time.NewTimer(d)
	return timer.C, timer
}

func stopTimer(timer *time.Timer) {
	if timer != nil {
		timer.Stop()
	}
}
