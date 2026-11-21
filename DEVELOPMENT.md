# DEVELOPMENT & DEVOPS DOCUMENTATION

## Архитектура

**Full-Stack Vite + Express**: Приложение запускается через `server.ts`, который:

- В **development** — монтирует Express API и Vite dev-server (с HMR) как middleware.
- В **production** — монтирует Express API и раздаёт собранные статические файлы из `dist/`.

Бэкенд запускается через `tsx` (TypeScript executor) как в dev, так и в prod, поскольку код использует path-алиасы `@/`, которые не разрешаются нативным `node`.

## Быстрый старт (Разработка)

### 1. Требования

- **Node.js** 20
- **pnpm**
- **sqlite3**

### 2. Установка

```bash
# Клонирование
git clone <repository-url>
cd rb-monitor

# Зависимости
pnpm i

# Настройка окружения
cp .env.example .env
# Отредактируйте .env — обязательно задайте JWT_SECRET и DATABASE_URL

# Nginx (если требуется)
см. nginx.conf.example
```

### 3. База данных

```bash
# Применить миграции (создаст prisma/dev.db)
pnpm exec prisma migrate dev --name init

# Сидирование (роли + суперадмин)
pnpm exec tsx scripts/init-db.ts

# Импорт боссов
pnpm exec tsx scripts/import-bosses.ts
```

### 4. Запуск (dev)

```bash
pnpm dev
```

Сервер запустится на `http://localhost:3000` (или порт из `PORT` в `.env`).

### Дефолтные учетные данные

- **Login**: `admin` (или значение из `SUPERADMIN_LOGIN`)
- **Password**: генерируется при запуске `init-db.ts`, выводится в консоль

---

## Деплой на продакшн (PM2)

### 1. Подготовка сервера

```bash
# Установка Node.js 20 (если нет)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3

# Установка pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Установка PM2 глобально
pnpm env use --global 20 && pnpm add -g pm2
```

> **Альтернатива: pnpm как менеджер Node.js** (без системной ноды)
>
> Если хочется полностью убрать системный Node.js и управлять версией через pnpm:
> ```bash
> sudo apt-get remove -y nodejs
> curl -fsSL https://get.pnpm.io/install.sh | sh -
> source ~/.bashrc
> pnpm env use --global 20        # скачает Node 20 и сделает его глобальным
> pnpm add -g pm2                 # установит PM2 через pnpm
> ```
> `.npmrc` проекта содержит `use-node-version=20.20.2` — pnpm автоматически использует нужную версию внутри проекта.

### 2. Деплой приложения

```bash
# Клонирование и установка
git clone <repository-url>
cd rb-monitor
pnpm install

# Настройка окружения
cp .env.example .env
# Обязательно задайте:
#   DATABASE_URL="file:./dev.db"   — путь к SQLite
#   JWT_SECRET                     — надёжный секретный ключ
#   PORT                           — порт (по умолчанию 3000)
см. nginx.conf.example
```

### 3. Инициализация базы данных

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec tsx scripts/init-db.ts
pnpm exec tsx scripts/import-bosses.ts
```

### 4. Сборка фронтенда

```bash
pnpm build
```

Скомпилированные файлы появятся в `dist/`. В production-режиме Express раздаёт их как статику.

### 5. Запуск через PM2

```bash
# Запуск
pm2 start ecosystem.config.cjs

# Полезные команды
pm2 status              # Статус процессов
pm2 logs rb-monitor     # Логи в реальном времени
pm2 restart rb-monitor  # Перезапуск
pm2 stop rb-monitor     # Остановка
pm2 delete rb-monitor   # Удаление из PM2

# Автозапуск при перезагрузке сервера
pm2 startup
pm2 save
```

### 6. Обновление на проде

```bash
cd rb-monitor
bash scripts/deploy.sh
```

> **Альтернатива PM2**: Можно запустить напрямую через `pnpm start`, который выполняет `cross-env NODE_ENV=production tsx server.ts`.

---

## Переменные окружения

| Переменная            | Обязательна | Описание                             | По умолчанию  |
| --------------------- | ----------- | ------------------------------------ | ------------- |
| `DATABASE_URL`        | ✅          | SQLite путь (`file:./dev.db`)        | —             |
| `JWT_SECRET`          | ✅          | Секретный ключ для JWT-токенов       | —             |
| `PORT`                | ❌          | Порт сервера                         | `3000`        |
| `NODE_ENV`            | ❌          | Режим (`development` / `production`) | `development` |
| `SUPERADMIN_LOGIN`    | ❌          | Логин суперадмина                    | `admin`       |
| `ALIVE_TIMEOUT_HOURS` | ❌          | Бэкенд: через сколько часов ALIVE → UNKNOWN  | `4`           |
| `VITE_ALIVE_TIMEOUT_HOURS` | ❌     | Фронтенд: через сколько часов ALIVE → UNKNOWN. Должен совпадать с `ALIVE_TIMEOUT_HOURS` | `4` |
| `TRUST_PROXY` | ❌                | Express `trust proxy` для корректного `req.ip` за reverse-proxy | `loopback` |

---

## pnpm-скрипты

| Команда           | Описание                                                       |
| ----------------- | -------------------------------------------------------------- |
| `pnpm dev`        | Запуск в dev-режиме (Express + Vite HMR)                       |
| `pnpm build`      | Сборка фронтенда в `dist/`                                     |
| `pnpm start`      | Запуск в production-режиме (нужен `pnpm build` перед этим)     |
| `pnpm lint`       | Проверка кода ESLint                                           |
| `pnpm lint:fix`   | Автоисправление ESLint                                         |
| `pnpm clean`      | Удаление `dist/`                                               |
| `pnpm exec tsx scripts/fetch-bosses.ts` | Скачать данные боссов через провайдер (`fetch`)    |
| `pnpm exec tsx scripts/import-bosses.ts [options]` | Импорт боссов в БД через провайдер (`load`) — см. ниже |

### Получение данных mw2wiki через браузер

Обычный запуск `fetch-bosses.ts` использует HTTP. Если mw2wiki не отдаёт ожидаемый HTML, можно вручную запустить отдельный видимый Chromium из Playwright:

```bash
# Однократно скачать Chromium, поставляемый Playwright
pnpm exec playwright install chromium

# Открыть отдельное окно Chromium и скачать HTML через него
pnpm exec tsx scripts/fetch-bosses.ts --provider mw2wiki --browser
```

Режим `--browser` доступен только для `mw2wiki`; он не запускает и не меняет системный Google Chrome или его профиль. Это ручной режим без обхода защиты, CAPTCHA и anti-DDoS. После успешного fetch скопируйте каталог `scripts/providers/mw2wiki/cache/` на production и выполните там обычный `pnpm exec tsx scripts/import-bosses.ts --provider mw2wiki`.

## Импорт боссов

Скрипт `scripts/import-bosses.ts` выполняет неразрушающий импорт данных боссов из провайдера. Он использует `node:util parseArgs` для CLI-аргументов.

### Использование

```bash
pnpm exec tsx scripts/import-bosses.ts [options]
```

### Опции

| Опция | Описание |
|---|---|
| `--provider <name>` | Провайдер данных (`mw2wiki` по умолчанию, `savhead`) |
| `--dry-run` | Логировать действия без записи в БД, копирования ассетов и бэкапа |
| `--purge-missing` | Установить `isPublic=false` для боссов, отсутствующих в данных провайдера (вместо удаления) |
| `--help`, `-h` | Показать справку |

### Поведение

1. **Бэкап** (не в `--dry-run`): перед любыми изменениями создаётся копия `backups/import-<ISO-timestamp>/` с:
   - SQLite БД (`db.sqlite`)
   - `public/assets/bosses/` → `assets/bosses/`
   - `public/assets/img/map.webp` (если существует)
   - При ошибке бэкапа скрипт прерывается без изменений.

2. **Дифф/upsert**: для каждого босса из провайдера:
   - Сравниваются скалярные поля, изображения (SHA-256 хэш) и дропы.
   - Изменённые/новые файлы изображений копируются в `public/assets/.bosses-import-<ts>/` (staging).
   - Дропы: отсутствующие `itemOrder` удаляются из БД и их иконки удаляются после коммита.

3. **Транзакция**: все операции БД выполняются в одной транзакции. При ошибке staging-директория удаляется.

4. **Слияние ассетов**: после коммита транзакции staging копируется в `public/assets/bosses/`.

5. **Пропущенные боссы**: боссы из БД, отсутствующие у провайдера, логируются как `keep` или `hide` (при `--purge-missing`).

### Примеры

```bash
# Импорт с mw2wiki (по умолчанию)
pnpm exec tsx scripts/import-bosses.ts

# Импорт с savhead
pnpm exec tsx scripts/import-bosses.ts --provider savhead

# Сухой прогон (только лог)
pnpm exec tsx scripts/import-bosses.ts --dry-run

# Импорт + скрыть отсутствующих боссов
pnpm exec tsx scripts/import-bosses.ts --purge-missing
```

### Исходный код

- `scripts/import-bosses.ts` — оркестратор (CLI, бэкап, транзакция, слияние)
- `scripts/import/diff.ts` — чистые helper-функции (хэширование, сравнение, staging, diff-дропов), доступны для тестов

---

## Бэкап и восстановление

```bash
bash scripts/db.sh backup                       # безопасный бэкап (sqlite3 .backup)
bash scripts/db.sh restore                      # восстановить из последнего
bash scripts/db.sh restore backups/sqlite_X.db  # из конкретного файла
bash scripts/db.sh list                         # список бэкапов
bash scripts/db.sh init-from-backup <file>      # новый инстанс из бэкапа + migrate
```

Хранятся последние **3 бэкапа**, старые удаляются автоматически.
`bash scripts/backup.sh` и `bash scripts/restore.sh` работают как раньше (вызывают `db.sh`).

### Автобэкап через cron (git push)

Скрипт `scripts/backup-cron.sh` делает бэкап и пушит в сиротскую ветку `backups` форс-пушем.
Ветка всегда содержит один коммит — история основной ветки не засоряется.
Рабочее дерево и текущая ветка не затрагиваются (git plumbing).

**Настройка:**

```bash
# Убедиться, что git push работает без пароля (SSH-ключ или credential helper)
git remote -v

# Открыть crontab
crontab -e
```

Добавить строку (каждый день в 03:00):

```
0 3 * * * /path/to/rb-monitor/scripts/backup-cron.sh >> /var/log/rb-backup.log 2>&1
```

Заменить `/path/to/rb-monitor` на реальный путь к проекту (узнать: `pwd`).

**Проверить вручную:**

```bash
bash scripts/backup-cron.sh
```

**Логи:**

```bash
tail -f /var/log/rb-backup.log
```

> **Миграция на PostgreSQL**: если нагрузка вырастет, Prisma поддерживает смену провайдера.
> Потребуется: новый `datasource` в схеме, перенос данных (`pg_dump` / скрипт), новые миграции.

---

## Временные зоны

Все время в БД хранится в **UTC**. Фронтенд автоматически конвертирует в локальную зону пользователя при отображении.

---

## Архитектура статусов

Статусы боссов вычисляются централизованно в `bossStore` через единый глобальный таймер. Компоненты читают готовые данные из store, не вычисляют статусы и countdown самостоятельно. Socket-обработчики обновляют store напрямую, без дополнительных HTTP-запросов.

## Сервисный слой

**Backend** (`src/backend/`):

| Файл                   | Назначение                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `services/prisma.ts`   | Singleton PrismaClient                                                                |
| `services/sessionAudit.ts` | Refresh-session audit: token hashing, IP/User-Agent capture, login events, revocation |
| `application/estimateBossKill.ts` | Use case расчётной отметки с обычными DTO и repository port |
| `services/prismaBossKillEstimateRepository.ts` | Чтение исходного цикла и атомарные CAS/Monitoring/Log через Prisma |
| `utils/bossMasking.ts` | Маскировка данных по правам (`maskBossForUser`, `canViewTimers`, `canViewMonitoring`) |
| `utils/socket.ts`      | `getIo()`, `emitBossEvent()` — **персональная маскировка для каждого socket-клиента** |

**Frontend** (`src/frontend/`):

| Файл                          | Назначение                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `services/bossApi.ts`         | Все HTTP-запросы к API (login, fetchBosses, setBossStatus, etc.)           |
| `services/httpInterceptor.ts` | Auto-refresh для HTTP 401 через refresh token                              |
| `services/socketService.ts`   | Socket transport lifecycle и EventBus-подписки; подписки не сбрасываются при reconnect |
| `stores/authStore.ts`         | Access token (`24h`), refresh token (`7d`), единый refresh-flow для HTTP/startup/socket |
| `composables/useI18n.ts`      | JSON-локализация фронтенда (`src/frontend/locales/en.json`, `ru.json`), сохранение языка в `localStorage` (`rb-monitor-locale`) и применение к `document.documentElement.lang` |

Store делегирует API-вызовы в `services/bossApi.ts`, оставляя только реактивное состояние и логику таймера.

## Резилентность

| Сценарий                                  | Обработка                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Вкладка в фоне                            | При возврате — `fetchBosses()`                                             |
| HTTP 401 из-за истёкшего access token     | Axios interceptor вызывает `/auth/refresh`, обновляет token pair и ретраит |
| WebSocket reconnect с истёкшим access JWT | `socket_connect_error` сначала пробует refresh; logout только если refresh не прошёл |
| Boss создан/удалён                        | Socket-события обновляют массив `bosses`                                   |


## Миграции

При изменении `prisma/schema.prisma`:

```bash
# Разработка — создание миграции
pnpm exec prisma migrate dev --name describe_change

# Продакшн — применение
pnpm exec prisma migrate deploy
```

---

## Логика статусов и прав доступа

### Статусы боссов

1. **UNKNOWN**: Данные отсутствуют или наступил конец эффективного окна + `ALIVE_TIMEOUT_HOURS`.
2. **DEAD**: Босс убит, идет время до минимального респауна.
3. **RESPAWNING**: «Окно» респауна (между мин. и макс. временем).
4. **ALIVE**: Наступил конец эффективного окна, но ещё не истёк таймаут до UNKNOWN, или статус выставлен вручную.

### Права доступа (RBAC)

- **VIEW_TIMERS**: Видеть все статусы и точное время убийства. Без этого права — всегда ALIVE.
- **MARK_STATUS**: Менять статус босса (DEAD, ALIVE, UNKNOWN). Удалять пользователей из мониторинга.
- **MANAGE_USERS**: Управление пользователями.
- **MANAGE_ROLES**: Управление ролями.

### Суперадмин

Пользователь с логином из `SUPERADMIN_LOGIN` (по умолчанию `admin`) — суперадмин. Обладает всеми правами неявно, его нельзя удалить или сменить ему роль.

### Дефолтные роли

| Роль       | Права                        |
| ---------- | ---------------------------- |
| **Admin**  | Все                          |
| **Leader** | `MARK_STATUS`, `VIEW_TIMERS` |
| **Member** | `VIEW_TIMERS`                |
| **Newbie** | Нет                          |

## Система мониторинга

- Пользователи с **VIEW_TIMERS** могут встать на мониторинг босса.
- Список мониторящих отображается в карточке босса.
- При переходе в **UNKNOWN** — мониторинг автоматически очищается.
- Боссы под мониторингом подсвечиваются на карте.

## Учет убийств

- `BossState.killedBy` хранит пользователя, который последним выставил боссу `DEAD` или задал kill-time.
- API возвращает `state.killedByUser.login/name` вместе с состоянием босса; UI показывает `name`, если он задан.

### Таймлайн респауна в карточке

Строка «Время респа» раскрывает таймлайн, обратный отсчёт и время убийства. По умолчанию аккордеон свёрнут; выбранное положение сохраняется в `localStorage`, как у списка дропа, и восстанавливается при выборе другого босса или перезагрузке страницы. На шкале отмечены убийство и границы окна, текущий момент показан только маркером без верхней подписи. Подсказки к точкам и цветным интервалам поясняют их смысл, показывают полные даты и время, а для расчётной отметки — дополнительное окно после «Убит по минимуму».

Обычное окно выделено жёлтым. После «Убит по минимуму» дополнительный участок до эффективного конца окна выделен оранжевым, а расчётное время убийства отмечено `*`. После конца окна появляется зелёный участок ALIVE; при переходе в UNKNOWN шкала скрывается. Положение маркера обновляется от общего таймера `bossStore.now`, без отдельного interval. Без `VIEW_TIMERS` шкала и строки времени недоступны.

### Расчётное убийство по минимуму

`POST <apiBase>/bosses/:id/kill-at-minimum` принимает только `{ "expectedRevision": 0 }` и требует одновременно `MARK_STATUS` и `VIEW_TIMERS`. Версия берётся из показанного состояния босса. При наличии исходного времени действие доступно от предыдущего минимума `T + min` до конца расчётного окна `T + 2max`, включая UNKNOWN до этой границы. При `now >= T + 2max` кнопка скрывается, а сервер отклоняет действие без записей; наличие мониторинга не влияет на доступность. Для уже принятой расчётной отметки используется эффективный конец окна по актуальным настройкам босса, а повторная отметка недоступна.

Для исходного убийства `T` и респауна `min–max` сервер сохраняет `lastKilledAt = T + min` и полное окно `[T + 2min; T + 2max]`. Время нажатия и исходный статус не сужают окно. `estimatedWindowStartAt`/`estimatedWindowEndAt` фиксируют принятые границы. `killedBy` остаётся null; автор хранится в Log с действием `ESTIMATE_KILL_AT_MINIMUM` и в `monitoredBy`. Существующая связь `monitorUser` передаёт только `id`, `login`, `name` в состоянии босса; таблица показывает автора для расчётной отметки, а для обычного убийства — `killedByUser`. Без `VIEW_TIMERS` состояние вместе с автором маскируется как null.

Prisma-транзакция условно обновляет состояние по `revision`, увеличивает её, удаляет Monitoring и создаёт Log. Потерянная версия не создаёт побочных записей; ошибка любой записи откатывает всю транзакцию. Любое обычное ручное время или статус, включая повтор прежнего timestamp, очищает обе границы и атомарно увеличивает версию. Отсутствующий или неизвестный ручной статус отклоняется с HTTP 400 до любых записей. Естественные переходы статуса сохраняют расчётную отметку.

Статус, countdown, At/сортировка и elapsed ALIVE используют `shared/bossStatus.ts`; UNKNOWN наступает от конца эффективного окна плюс настроенный таймаут. При коррекции настроек босса `lastKilledAt` сохраняется, а эффективное расчётное окно пересчитывается по текущим min/max: `[lastKilledAt + min; lastKilledAt + 2max − min]`. Сохранённые границы обозначают принятую расчётную отметку, а не замораживают таймер после коррекции. Расчётный RESPawning отличается цветом строки и полужирными At/ETA; в карточке расчётный таймер отмечен `*` в конце подписи времени респа. Диапазон часов вычисляется от `lastKilledAt` до начала и конца эффективного окна: исходные 8–12 ч дают 8–16 ч, коррекция на 9–13 ч — 9–17 ч. Отдельного блока дат и пояснения нет. Маркер карты сохраняет обычный цвет статуса.

Ошибки возвращают `code` для локализации:

| HTTP | Коды |
| --- | --- |
| 400 | `invalid_boss_id`, `invalid_expected_revision`, `invalid_payload` |
| 401 / 403 | Нет активной сессии / одного из обязательных разрешений |
| 404 | `boss_not_found` |
| 409 | `revision_conflict`, `already_estimated` |
| 422 | `missing_kill_time`, `minimum_not_reached`, `estimate_window_expired` |
| 500 | `estimate_failed` |

Клиент не сдвигает время оптимистично и не повторяет действие автоматически. После 409 он перечитывает босса и показывает локализованное сообщение. Ответ с меньшей `revision` не заменяет новое состояние; masked `state: null` очищает таймеры независимо от версии. Существующие ручные HTTP-мутации также возвращают null без `VIEW_TIMERS`. Повторный вход возобновляет общий таймер и сразу обновляет время проверки доступности кнопки.

При выкатке сервер и frontend должны обновляться совместно, а открытые клиенты — перезагрузиться: предыдущий frontend не учитывает сохранённые границы расчётного окна. До принятия расчётных отметок убедитесь, что участники обновили страницу.

После commit `boss_update` содержит optional `acceptedAction: { type: 'ESTIMATE_KILL_AT_MINIMUM', revision, actor: { id, login, name } }`, а `monitoring_update` сообщает о сбросе. `eventLogStore` отображает авторскую запись один раз на босса/версию, даже если статус не изменился. Без `VIEW_TIMERS` весь payload реконструируется как `{ bossId, state: null }`, без metadata. Дополнительный ручной звук ALIVE не отправляется; естественный переход использует сохранённый конец окна.

`tests/estimateBossKill.integration.test.ts` применяет миграции к временной SQLite и проверяет настоящую авторизацию, конкурентное принятие, сохранение, маскировку и rollback при ошибке Log. Рабочая база не используется.

## Имена пользователей

- `User.login` остаётся уникальным идентификатором для входа и служебных операций.
- `User.name` — optional display name. Пользователь может изменить своё имя через `PATCH /api/users/me/profile`; админ может менять имена через `PATCH /api/users/:id/name`.
- Auth API (`/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/telegram`) возвращает `user.name`.
- Auth/user API responses expose `user.hasPassword` for UI gating and never expose `passwordHash`.
- Local password users can change their own password with `PATCH /api/users/me/password` (`currentPassword`, `newPassword`); this keeps the current session and revokes other active sessions. Admins can reset another local user's password with `PATCH /api/users/:id/password` (`newPassword`); this revokes that user's active sessions.
- Telegram auth сохраняет `first_name + last_name` в `name`; если существующий Telegram-пользователь ещё без имени, оно дозаполняется при входе.
- `GET /api/monitoring/:bossId` возвращает `[{ login, name }]`; удаление из мониторинга по-прежнему использует `login`.

## Аудит сессий пользователей

- `UserSession` хранит хэш refresh token, IP, User-Agent, время создания, `lastSeenAt`, `expiresAt` и причину отзыва.
- `LoginEvent` хранит успешные и неуспешные входы с login, userId при наличии, IP, User-Agent и причиной.
- `/api/auth/login` и `/api/auth/telegram` создают `UserSession` и пишут `LoginEvent`; `/api/auth/refresh` проверяет сессию и ротирует refresh token; `/api/auth/logout` отзывает текущую сессию.
- Access JWT содержит `sessionId`; HTTP middleware и socket handshake проверяют, что `UserSession` не отозвана и не истекла.
- Админские endpoints: `GET /api/users/:id/security`, `POST /api/users/:id/sessions/:sessionId/revoke`, `POST /api/users/:id/sessions/revoke`, `PATCH /api/users/:id/password`.
- Single-session terminate эмитит `user_session_terminated` только в socket room этой сессии; смена роли, удаление пользователя и массовое завершение сессий отзывают refresh-сессии и эмитят событие пользователю целиком.
- Cleanup не удаляет активные сессии. Отозванные/истёкшие `UserSession` хранятся 90 дней и максимум 50 на пользователя; `LoginEvent` — 180 дней и максимум 300 на пользователя. Админский security endpoint возвращает последние 20 сессий и 50 событий входа.

---

## Безопасность socket-событий

### Персональная маскировка

Все socket-события (`boss_update`, `boss_created`, `boss_data_changed`) маскируются **индивидуально для каждого клиента**. При handshake сервер декодирует JWT-токен и сохраняет `permissions` в `socket.data`. Функция `emitBossEvent()` итерирует по всем подключённым сокетам и для каждого применяет `maskBossForUser()` на основе его прав.

### Что маскируется

| Событие             | Без `VIEW_TIMERS`                | Без прав мониторинга    |
| ------------------- | -------------------------------- | ----------------------- |
| `boss_update`       | `state = null`                   | —                       |
| `boss_created`      | `state = null`, `status = ALIVE` | `_count.monitoring = 0` |
| `boss_data_changed` | `state = null`, `status = ALIVE` | `_count.monitoring = 0` |

### Socket handshake

При подключении сервер декодирует JWT и сохраняет в `socket.data`: `userId`, `login`, `name`, `role`, `permissions`. Для суперадмина (`SUPERADMIN_LOGIN`) permissions расширяются до `ALL_PERMISSIONS` — аналогично HTTP-middleware.

Если активная вкладка проснулась после сна/offline и socket reconnect получил `Unauthorized: Invalid token`, фронтенд не разлогинивает пользователя сразу: `authStore` сначала обновляет access token через refresh token и пересоздаёт socket. EventBus-подписки живут отдельно от socket transport, поэтому `initSocket()`/`disconnectSocket()` не очищают зарегистрированные handlers; компоненты, которые подписываются напрямую через `onSocket`, должны отписываться в `onUnmounted`.

---

## Admin API (управление боссами)

Маршруты: `POST/PUT/DELETE /api/admin/bosses`

Требуют `MANAGE_USERS`. При изменениях эмитят socket-события:

| Метод    | Endpoint                | Действие                             | Socket-событие      |
| -------- | ----------------------- | ------------------------------------ | ------------------- |
| `POST`   | `/api/admin/bosses`     | Создание босса                       | `boss_created`      |
| `PUT`    | `/api/admin/bosses/:id` | Изменение (имя, description, respawn, координаты) | `boss_data_changed` |
| `DELETE` | `/api/admin/bosses/:id` | Удаление босса                       | `boss_deleted`      |

### Пример создания босса

```json
POST /api/admin/bosses
{
  "id": 999,
  "name": "New Boss",
  "description": "Dungeon guardian",
  "level": 50,
  "respawnMin": 2,
  "respawnMax": 4,
  "xPct": 45.5,
  "yPct": 60.2,
  "isEpic": false,
  "dropItems": [
    { "name": "Sword", "chance": "5%", "itemOrder": 1 }
  ]
}
```

Поле `description` nullable. Строковое значение нормализуется через `trim()`; пустая строка сохраняется как `null`. В `PUT` отсутствие `description` не меняет сохранённое значение, а `null` или пустая строка очищают его.

---

## Звуковые уведомления

Звук генерируется через **Web Audio API** (без внешних файлов). Двухтональный сигнал (880Hz → 660Hz).

| Сценарий             | Кто слышит           | Механизм                         |
| -------------------- | -------------------- | -------------------------------- |
| Таймер истёк → ALIVE | Все                  | `tickGlobalTimer()` в store      |
| Кнопка ALIVE нажата  | Все, кроме нажавшего | Socket `boss_alive_notification` |

Компосабл: `useSoundNotification` — `playNotificationSound()`, `toggleSound()`, `isSoundEnabled()`.
Состояние вкл/выкл сохраняется в `localStorage` (`sound_enabled`).
