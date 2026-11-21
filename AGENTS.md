# RB Monitor — Документация

## Правила для агентов

### 🔴 НЕ ревертить без проверки

Перед `git checkout` / `git restore`:

1. `git diff --name-only HEAD` — посмотреть, что изменено
2. `git status --short` — новые/удалённые файлы
3. Если изменения значимые — **НЕ трогать**, уточнить у пользователя
4. Никогда не делать `git checkout -- .` или `git reset --hard` без явной команды

### ✅ После фичи — обнови документацию

1. **`PROGRESS.md`** — только фичи, не баг-фиксы
2. **`AGENTS.md`** — если изменилась архитектура или новые socket-события
3. **`DEVELOPMENT.md`** — если новые API или механики

### Разработка

| Правило | Детали |
|---|---|
| **Импорты** | Межмодульные импорты — через `@/` алиас. Локальные `./` внутри одной feature-папки допустимы. Подъёмы `../` запрещены |
| **Фронтенд** | Состояние — Pinia (`stores/`). API — через `services/` |
| **Бэкенд** | Prisma-синглтон (`services/prisma.ts`). Masking в `utils/bossMasking.ts`. Socket-маскировка в `utils/socket.ts` |
| **Компоненты** | Логика — в компосаблы `useXxx.ts`. Папки с префиксом группы |
| **Форматирование времени** | `formatDuration(ms)` из `@/frontend/utils/formatDuration` — единый формат ETA: `<60m`→минуты, `<48h`→`H:MM`, иначе→`Xd` |
| **WebSockets** | Подписки только в stores через `socketService` (`bossStore`, `authStore`, `eventLogStore`, `appStore`). Компоненты читают stores |
| **Env** | Фронтенд: `import.meta.env.VITE_*` · Бэкенд: `process.env.*` |
| **BASE_PATH** | Никогда не хардкодить `/api/` или `/assets/`. Бэкенд: `pathConfig` из `@/backend/config`. Фронтенд: `{ apiBase } = pathConfig` из `@/frontend/config` для axios-вызовов, `assetUrl()` из `@/frontend/utils/assetUrl` для путей к изображениям |
| **i18n** | UI-тексты хранить в `src/frontend/locales/*.json`; в Vue/components/stores использовать `useI18n().t()`. Новые ключи добавлять сразу в `en.json` и `ru.json` |
| **JWT_SECRET** | Без fallback. Сервер падает при старте без переменной |

### Правила Vue-компонентов

| Правило | Критерий |
|---|---|
| Один компонент — одна ответственность | > 120 строк → дели |
| Props + Emits | Всегда с типами, без «магии» |
| Без side-эффектов в шаблоне | Никаких функций в `{{ }}` или `v-bind` |
| `ref`/`reactive` — минимум | Только UI-состояние. Остальное — в Pinia или props |
| Именование | `PascalCase.vue` — компоненты, `camelCase.ts` — компосаблы |

## Обзор

**RB Monitor** — мониторинг возрождения рейд-боссов: интерактивная карта, таймеры респауна, RBAC, WebSockets.

**Стек**: Vue 3 + TypeScript + Pinia · Express + TypeScript + Socket.IO · Prisma (SQLite) · Vite 6 · Tailwind CSS 4 · Vitest · PM2

## Быстрый старт

```bash
pnpm install && cp .env.example .env
# Отредактируй .env: задай JWT_SECRET
pnpm exec prisma migrate deploy && pnpm exec prisma generate
pnpm exec tsx scripts/init-db.ts && pnpm exec tsx scripts/import-bosses.ts
pnpm dev                                                # → http://localhost:3000
```

**Логин**: `admin` · **Пароль**: генерируется при `init-db.ts`, выводится в консоль

| Команда | Описание |
|---|---|
| `pnpm dev` | Dev-сервер (Express + Vite HMR) |
| `pnpm build` | Сборка в `dist/` |
| `pnpm lint` / `lint:fix` | ESLint |
| `pnpm test` | Vitest |
| `pnpm exec tsx scripts/fetch-bosses.ts` | Скачать данные боссов (fetcher провайдера) |
| `pnpm exec tsx scripts/import-bosses.ts` | Импорт боссов в БД (loader провайдера) |

## Socket-события

| Событие | Payload | Кто слушает |
|---|---|---|
| `boss_update` | `{ bossId, state, acceptedAction? }`; расчётное действие: `{ type: 'ESTIMATE_KILL_AT_MINIMUM', revision, actor: { id, login, name } }` | bossStore, eventLogStore |
| `boss_created` | `{ boss: Boss }` | bossStore |
| `boss_data_changed` | `{ bossId, boss: Boss }` | bossStore |
| `boss_deleted` | `{ bossId }` | bossStore |
| `boss_alive_notification` | `{ bossId, triggeredByUserId }` | bossStore (звук) |
| `monitoring_update` | `{ bossId }` | bossStore, BossMonitoring.vue |
| `boss_monitoring_event` | `{ bossId, login, name?, action }` | EventLog.vue |
| `user_session_terminated` | `{ userId, login?, name? }` | authStore, eventLogStore |
| `user_presence` | `{ login, name?, status }` | eventLogStore |
| `app_reload` | `{ message }` | appStore (показывает UpdateBanner) |

## Бизнес-логика

### Статусы боссов

| Статус | Условие |
|---|---|
| **UNKNOWN** | Нет данных или наступил конец эффективного окна + `ALIVE_TIMEOUT_HOURS` |
| **DEAD** | < мин. респауна |
| **RESPAWNING** | Между мин. и макс. респауном |
| **ALIVE** | > макс. респауна или выставлен вручную |

Без `VIEW_TIMERS` всегда видят `ALIVE`.

### Роли и разрешения

| Роль | Права |
|---|---|
| **Admin** | Все |
| **Leader** | `MARK_STATUS`, `VIEW_TIMERS` |
| **Member** | `VIEW_TIMERS` |
| **Newbie** | Нет |

Суперадмин (`SUPERADMIN_LOGIN`, по умолчанию `admin`): все права, нельзя удалить/сменить роль.

### Мониторинг

Пользователи с `VIEW_TIMERS` мониторят босса → маркер на карте подсвечивается cyan. Сброс при переходе в `UNKNOWN`.

### Звук

Звук при переходе в ALIVE (Web Audio API, без файлов). Таймер истёк — слышат все. Кнопка нажата — слышат все, кроме нажавшего. Кнопка 🔊/🔇 в хедере, состояние в `localStorage`.

## Деплой

```bash
pnpm install --frozen-lockfile && pnpm build
pnpm exec prisma migrate deploy && pnpm exec prisma generate
pnpm exec tsx scripts/init-db.ts && pnpm exec tsx scripts/import-bosses.ts
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Обновление: `bash scripts/deploy.sh`

## Инфраструктура

| Область | Ключевые детали |
|---|---|
| **Backend** | Prisma-синглтон, `utils/bossMasking.ts`, `utils/socket.ts`; `application/estimateBossKill.ts` владеет use case/port, `services/prismaBossKillEstimateRepository.ts` — атомарным сохранением |
| **Admin routes** | `POST/PUT/DELETE /api/admin/bosses`, требует `MANAGE_USERS`, socket-события при изменениях |
| **Admin system** | `POST /api/admin/reload` принимает `Bearer <JWT_SECRET>` только с loopback IP; показывает `app_reload` баннер |
| **Auth audit** | `services/sessionAudit.ts`: `UserSession` хранит hash refresh-token + IP/User-Agent/lastSeen; access JWT содержит `sessionId`; `LoginEvent` хранит историю входов; cleanup хранит активные сессии, историю сессий 90д/50 на пользователя, входы 180д/300 на пользователя |
| **User routes** | `POST /api/users` принимает optional `name`; `PATCH /api/users/:id/name`; `GET /api/users/:id/security`; `POST /api/users/:id/sessions.../revoke`, требует `MANAGE_USERS` |
| **Frontend** | Pinia, `services/bossApi.ts`, axios-интерцептор и socket auth recovery через единый refresh-flow, socket-подписки в stores, `usePanzoom`, `useSoundNotification` |
| **bossStore** | Реактивное состояние, глобальный таймер (1 setInterval), расчёт статусов, countdown, сортировка, socket-обработчики |
| **DevOps** | `scripts/db.sh` — бэкап/восстановление SQLite. Socket-маскировка — per-client в `emitBossEvent()` |
| **Провайдеры** | `scripts/providers/` — система подключаемых источников боссов: `BaseProvider` (общие утилиты), `SavheadProvider`, `Mw2WikiProvider`, `UrlListProvider` (импорт из списка URL mw2.wiki через `--url-list <file>`, универсальный парсер EN+RU). Импорты через `@scripts/*` алиас. Скрипты: `fetch-bosses.ts` (скачать, CLI `--provider`/`--dry-run`/`--limit`/`--url-list`), `import-bosses.ts` (импорт в БД, `--skip-existing` для production-safe импорта). Dry-run: `--dry-run` флаг. |

## Переменные окружения

| Переменная | Обяз. | Описание | По умолчанию |
|---|---|---|---|
| `DATABASE_URL` | ✅ | SQLite путь (например `file:./dev.db`) | — |
| `JWT_SECRET` | ✅ | Ключ JWT | — |
| `PORT` | ❌ | Порт | `3000` |
| `NODE_ENV` | ❌ | Режим | `development` |
| `SUPERADMIN_LOGIN` | ❌ | Логин суперадмина | `admin` |
| `ALIVE_TIMEOUT_HOURS` | ❌ | Бэкенд: часы до ALIVE → UNKNOWN | `4` |
| `VITE_ALIVE_TIMEOUT_HOURS` | ❌ | Фронтенд: часы до ALIVE → UNKNOWN. Должен совпадать с `ALIVE_TIMEOUT_HOURS` | `4` |
| `TRUST_PROXY` | ❌ | Express `trust proxy` для корректного `req.ip` за reverse-proxy | `loopback` |
| `BASE_PATH` | ❌ | Серверный префикс пути (`/rb`). Должен совпадать с `VITE_BASE_PATH` | `''` |
| `VITE_BASE_PATH` | ❌ | Клиентский префикс пути, задаётся до `npm run build` | `''` |

## Схема БД

| Модель | Описание |
|---|---|
| **Role** | Роли с JSON-массивом разрешений |
| **User** | Пользователи с привязкой к роли; `name` — optional display name, `login` остаётся уникальным идентификатором |
| **UserSession** | Refresh-сессии: hash токена, IP/User-Agent, created/lastSeen/expires/revoked |
| **LoginEvent** | История успешных и неуспешных входов с IP/User-Agent и причиной |
| **Boss** | Боссы: координаты (`xPct`/`yPct`), характеристики, капля |
| **BossState** | Время убийства, автор отметки (`monitorUser`), `revision`; nullable `estimatedWindowStartAt`/`estimatedWindowEndAt` обозначают принятую расчётную отметку |
| **Monitoring** | Связь «пользователь ↔ босс» |
| **DropItem** | Предметы из босса |
| **Log** | Журнал действий |

Все времена в БД — **UTC**. Фронтенд конвертирует в локальную зону.

Расчётные таймеры и действие «Убит по минимуму»: формула, endpoint и конфликт версий описаны в `DEVELOPMENT.md`, раздел «Расчётное убийство по минимуму». При изменении временных потребителей используйте `getEffectiveRespawnWindow()` из `shared/bossStatus.ts`: он учитывает актуальные min/max, сохраняя время убийства при коррекции настроек. Ручные writers очищают обе границы и атомарно увеличивают `revision`. Без `VIEW_TIMERS` payload `boss_update` содержит только `bossId` и `state: null`.
