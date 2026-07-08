BINARY := kithara

.PHONY: frontend-deps
frontend-deps:
	cd frontend && pnpm install

.PHONY: build-frontend
build-frontend: frontend-deps
	cd frontend && pnpm run build

.PHONY: build
build: build-frontend
	go build -o $(BINARY) ./cmd/$(BINARY)

.PHONY: kill-ports
kill-ports:
	@lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:3001 | xargs -r kill -9 2>/dev/null || true


.PHONY: server
server: kill-ports build
	#./kithara migrate up --dir=pb_data
	./$(BINARY) superuser upsert admin@mail.internal password --dir=pb_data
	./$(BINARY) serve

# --------------
.PHONY: clean
	rm -fr ./tmp/ # air

# port: 3001
.PHONY: dev-front
dev-front: clean kill-ports
	npx concurrently -n "frontend,backend" -c "blue,green" "cd frontend && pnpm dev" "air"

# port: 3000
.PHONY: dev-back
dev-back: clean kill-ports
	npx concurrently -n "frontend,backend" -c "blue,green" "cd frontend && pnpm watch" "air"


.PHONY: test
test:
	go test ./...


migrate-collections:
	go run ./cmd/kithara migrate collections



