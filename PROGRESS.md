# RB Monitor - Project Progress

## Phase 1: Foundation (Completed)

- [x] Initial project structure setup (Express + Vue 3 + Prisma)
- [x] Database schema design (Bosses, Users, Roles, Logs, DropItem, Monitoring)
- [x] Boss data import script (111 bosses)
- [x] Backend API routes (Bosses, Auth, Users, Monitoring)
- [x] Frontend Pinia store and interactive map
- [x] App metadata and linting setup

## Phase 2: DevOps (Completed)

- [x] Docker Compose (PostgreSQL)
- [x] Backup, restore, and migration scripts
- [x] Production deployment (PM2, ecosystem.config.cjs)

## Phase 3: Core Features (Completed)

- [x] Authentication (JWT, login/password, refresh tokens)
- [x] RBAC system (roles: Admin, Leader, Member, Newbie)
- [x] Socket.IO real-time updates (boss status, session events)
- [x] Boss status logic (UNKNOWN, DEAD, RESPAWNING, ALIVE)
- [x] "Mark as Killed" functionality
- [x] ALIVE decay timer (ALIVE_TIMEOUT_HOURS)

## Phase 4: UI & Features (Completed)

- [x] Login page and Auth UI
- [x] User management dashboard
- [x] Role management (create, edit, delete)
- [x] Boss respawn timer countdowns
- [x] Boss table with collapsible summary
- [x] Map filters (Epic only, Level range)
- [x] Session events window
- [x] Monitoring system (Join/Leave, visual indicator on map)
- [x] Map zoom, pan, and marker positioning (panzoom)
- [x] Boss details panel (hero image, info grid, timer info)
- [x] Boss drop table viewer (icon grid with tooltips)
- [x] Permission-based UI masking (VIEW_TIMERS)
- [x] Session termination via websockets
- [x] SessionExpiredBanner component
- [x] Selected marker animation (cyan pulsing shadow)
- [x] Map background image (local assets)
- [x] File-discovered theme dropdown with semantic CSS-variable color layer (no Tailwind palette colors)
- [x] Additional app themes: Synthwave 84, Ayu Dark, Zenburn Light, Gruvbox, Solarized Light, Tokyo Night, Github, Everforest
- [x] English/Russian UI localization with JSON locale files and persisted language selector
- [x] Estimated kill at the previous minimum: persisted full respawn window, atomic revision checks, author events, permission masking, and themed accessible table/details presentation
- [x] Collapsible boss respawn timeline with a kill marker, live current-position marker, and an additional estimated respawn segment; compact countdown and kill-time rows

## Phase 5: Sound Notifications & Boss CRUD API (Completed)

- [x] Sound notifications when boss becomes ALIVE (timer expiry or manual)
- [x] Toggle button 🔊/🔇 in header, persisted per user
- [x] Boss CRUD API (POST/PUT/DELETE /api/admin/bosses) with real-time socket updates
- [x] Instant sync on tab restore and WebSocket reconnect

## Phase 5b: Architectural Refactoring (Completed)

- [x] PrismaClient singleton (6 instances → 1)
- [x] Extracted `services/bossApi.ts` — all HTTP calls moved out of store
- [x] Extracted `utils/bossMasking.ts` — deduplicated permission masking
- [x] Extracted `utils/socket.ts` — deduplicated `getIo`/`emitBossEvent`
- [x] Legacy `.eslintrc.json` removed

## Phase 5c: Socket Security — Per-Client Masking (Completed)

- [x] `emitBossEvent()` — персональная маскировка для каждого socket-клиента (вместо `io.emit`)
- [x] Socket handshake сохраняет `permissions` из JWT в `socket.data`
- [x] SUPERADMIN check при handshake (аналог HTTP-middleware)
- [x] Admin routes: убрана маскировка относительно создателя — `emitBossEvent` маскирует per-recipient
- [x] `BossWithState` тип экспортирован из `bossMasking.ts` для reuse в `socket.ts`
- [x] Документация обновлена (AGENTS.md, DEVELOPMENT.md)

## Phase 6: Testing & Quality Assurance (Completed)

- [x] Frontend testing infrastructure (Vitest + @vue/test-utils)
- [x] All frontend stores covered (`bossStore`, `authStore`, `sessionStore`)
- [x] Backend router integration tests (`auth`, `bosses`, `users`, `monitoring`)
- [x] `EventLog.vue` and `BossTable.vue` component tests
- [x] Fixed `EventLog` baseline initialization bug
- [x] Monitoring logic fully covered (frontend actions + backend routes)

## Phase 6b: Boss Table Redesign (Completed)

- [x] Boss table panel: collapse animation, 60vh height limit, "Boss List" title
- [x] Boss table and events collapse-to-icon with persisted state
- [x] Kill-time edit: datetime-local dark icon fix, OK button
- [x] ETA format unified: `<60m` → bare minutes, `≥60m <48h` → `H:MM`, `≥48h` → `Xd`
- [x] `formatDuration` extracted to `src/frontend/utils/formatDuration.ts` (used in store + table row)
- [x] Filters moved from MapFilters panel into Boss Table: level range + epic toggle + reset
- [x] `MapFilters.vue` deleted; filter state stays in `App.vue`
- [x] Extracted: `BossTableFiltersBar`, `BossTableLevelFilter`, `BossTableEpicFilter`
- [x] New tests: `BossTableLevelFilter.spec.ts`, `BossTableFiltersBar.spec.ts`, `BossTable.spec.ts` rewritten
- [x] Backend: `POST /bosses/:id/kill-time` tests (valid, null, future-clamp, 400, 404, socket emit)

## Phase 7: Future Enhancements (Planned)

- [x] Boss Data Providers — подключаемые источники боссов (`SavheadProvider`, `Mw2WikiProvider`)
- [x] WebP-конвертация картинок при скачивании (sharp)
- [x] Dry-run режим для проверки провайдеров без записи файлов/БД
- [ ] Telegram Bot integration
- [x] Auth via Telegram
- [x] User display names (`name`) with self-service profile editing, admin editing, and Telegram name import
- [x] Local password change in profile and admin password reset for login/password users
- [x] User session audit: hashed refresh sessions, login history, IP/User-Agent tracking, admin termination UI, bounded retention
- [ ] Push notifications for monitoring users
- [x] Detailed boss statistics and kill history
- [x] Admin UI for boss management (Create, Edit, Delete)
- [x] Boss table `killedby` column showing who last set DEAD status
- [x] Nullable short boss description in Admin API, public responses, and socket updates
- [x] Multi-language support

## Phase 7b: Non-Destructive Boss Import (Completed)

- [x] Non-destructive `import-bosses.ts` — no wipe of DB or assets
- [x] Pre-import backup of SQLite DB, `public/assets/bosses/`, and `map.webp` to `backups/import-<ts>/`
- [x] CLI arguments via `parseArgs`: `--provider`, `--dry-run`, `--purge-missing`, `--help`
- [x] Diff/upsert logic with per-field change detection for scalar fields, images (SHA-256 hash), and drops
- [x] Asset staging to `public/assets/.bosses-import-<ts>/` with atomic merge after DB transaction
- [x] Drop orphan cleanup (file deletion after transaction commit)
- [x] Map image copy with change detection
- [x] Detailed logging per boss (create/update/skip/hide/keep) with drop operation breakdown
- [x] Pure helper functions extracted to `scripts/import/diff.ts` (hashFile, filesEqual, prepareAssetChange, buildBossData, diffDrops)
- [x] Unit tests for `@scripts/import/diff.ts` helpers with real temp files
- [x] Lint and test suite green

## Phase 7c: URL-List Provider (Completed)

- [x] `url-list` provider — импорт боссов из списка URL mw2.wiki (один URL на строку в файле, `#` — комментарий)
- [x] Универсальный парсер EN+RU локализаций через множества ключей статов (respawn, p.atk, p.def)
- [x] Извлечение name + level из `.item_head` индивидуальной страницы босса
- [x] Сбор дропа со всех страниц пагинации (`?dropPage=N`)
- [x] CLI `--skip-existing` для `import-bosses.ts` — production-safe: существующие боссы не затрагиваются
- [x] CLI-парсинг `--provider` / `--dry-run` / `--limit` в `fetch-bosses.ts` (вместо хардкода)
- [x] `URL_LIST_FILE` env var — путь к файлу со списком URL
- [x] `url-list/cache/` добавлен в `.gitignore` (пользовательские данные, не shared-датасет)
- [x] Ручной режим `mw2wiki --browser` через отдельный видимый Playwright Chromium с очисткой ресурсов и проверкой страницы защиты
