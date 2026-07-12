// Package serve implements the "serve" command, which runs a single HTTP server
// that hosts the index page and all drill sessions defined in the config file.
package serve

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"

	"github.com/asano69/kithara/internal/assets"
	"github.com/asano69/kithara/internal/config"
	"github.com/asano69/kithara/internal/db"
	"github.com/asano69/kithara/internal/notify"
	"github.com/asano69/kithara/internal/scheduler"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/sirupsen/logrus"
)

// testNotificationRequest is the body accepted by POST /api/notifications/test.
type testNotificationRequest struct {
	Endpoint string `json:"endpoint"`
	Token    string `json:"token"`
}

// Run opens the database and collection once, registers all drill routes, then
// starts listening. The database and collection are shared across all sessions.
func Run(app *pocketbase.PocketBase, cfg *config.Config) error {
	database, err := db.New(app)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	// The scheduler owns its own goroutine for the lifetime of the process;
	// it exits when the process does, so a background context is enough.
	sched := scheduler.New(database)
	go sched.Run(context.Background())

	// Any change to a note (new one, edited dtstart/rrule, deleted)
	// invalidates the in-memory schedule, so recompute it from scratch
	// rather than trying to patch it in place.
	reloadOnChange := func(e *core.RecordEvent) error {
		sched.Reload()
		return e.Next()
	}
	app.OnRecordAfterCreateSuccess("notes").BindFunc(reloadOnChange)
	app.OnRecordAfterUpdateSuccess("notes").BindFunc(reloadOnChange)
	app.OnRecordAfterDeleteSuccess("notes").BindFunc(reloadOnChange)

	// assetsFS exposes just the "assets/" subdirectory that Vite's default
	// (unprefixed) base writes hashed JS/CSS bundles into, so they're served
	// at the conventional /assets/... URL instead of /static/assets/....
	assetsFS, err := fs.Sub(assets.FS, "assets")
	if err != nil {
		return fmt.Errorf("sub assets fs: %w", err)
	}
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/assets/{path...}", apis.Static(assetsFS, false))

		serveShell := func(re *core.RequestEvent) error {
			re.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
			http.ServeFileFS(re.Response, re.Request, assets.FS, "index.html")
			return nil
		}
		e.Router.GET("/", serveShell)

		e.Router.GET("/favicon.svg", func(re *core.RequestEvent) error {
			re.Response.Header().Set("Content-Type", "image/svg+xml")
			http.ServeFileFS(re.Response, re.Request, assets.FS, "favicon.svg")
			return nil
		})

		e.Router.POST("/api/notifications/test", func(re *core.RequestEvent) error {
			var payload testNotificationRequest
			if err := re.BindBody(&payload); err != nil {
				return apis.NewBadRequestError("invalid request body", err)
			}
			if err := notify.TestGotify(payload.Endpoint, payload.Token); err != nil {
				return apis.NewBadRequestError(err.Error(), nil)
			}
			return re.JSON(http.StatusOK, map[string]bool{"ok": true})
		}).Bind(apis.RequireSuperuserAuth())

		e.Router.GET("/api/schedule/debug", func(re *core.RequestEvent) error {
			return re.JSON(http.StatusOK, sched.Snapshot())
		}).Bind(apis.RequireSuperuserAuth())

		return e.Next()
	})

	logrus.WithField("addr", addr).Info("listening")
	return apis.Serve(app, apis.ServeConfig{
		HttpAddr:        addr,
		ShowStartBanner: false,
	})
}
