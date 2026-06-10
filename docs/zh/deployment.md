# 部署与备份

[English](../deployment.md) | **中文**

Skill Base 把所有状态放在一个数据目录里。备份这个目录就能恢复服务。

```text
data/
├── skills.db
└── skills/
    └── <skill-id>/
        ├── v20260406.101500.zip
        └── v20260407.143000.zip
```

## 启动参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--port` | `-p` | 监听端口 | `8000` |
| `--host` | `-h` | 绑定地址 | `0.0.0.0` |
| `--data-dir` | `-d` | 数据目录 | 包内 `data/` |
| `--base-path` | - | URL 前缀 | `/` |
| `--cache-max-mb` | - | 进程内 LRU 缓存（MB） | `50` |
| `--session-store` | - | `memory` 或 `sqlite` | `memory` |
| `--no-cappy` | - | 关闭终端 Cappy | 默认开启 |
| `--verbose` | `-v` | 调试日志 | 关闭 |
| `--daemon` | - | 后台运行（PID/日志写在数据目录；默认关闭 Cappy） | 关闭 |
| `--stop` | - | 停止 `--daemon` 进程 | - |
| `--status` | - | 查看后台进程是否在跑 | - |

不用 pm2 时，推荐固定数据目录并后台启动：

```bash
npx skill-base -d ./skill-data -p 8000 --daemon
npx skill-base -d ./skill-data --status
npx skill-base -d ./skill-data --stop
```

数据目录会生成 `skill-base.pid` 与 `skill-base.log`。`--stop` / `--status` 的 `-d` 必须与启动时一致。

### 多实例

后台进程的标识是**数据目录**（`-d` 解析后的绝对路径），不是端口。每个数据目录各自一份 PID/日志，互不影响：

```bash
npx skill-base -d ./team-a-data -p 8000 --daemon
npx skill-base -d ./team-b-data -p 8001 --daemon

npx skill-base -d ./team-a-data --status
npx skill-base -d ./team-b-data --stop
```

注意：

- 同一 `-d` 只能跑一个实例（共用一个 `skills.db`）；换端口再 `--daemon` 会报已在运行。
- 不同实例必须用不同端口，否则第二个进程会绑定失败。
- 未指定 `-d` 时，所有实例共用包内默认 `data/`，同样只能有一个后台进程。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CACHE_MAX_MB` | LRU 缓存上限 | `50` |
| `SESSION_STORE` | `memory` 或 `sqlite` | `memory` |
| `DEBUG` | 详细日志（同 `--verbose`） | 关闭 |
| `APP_BASE_PATH` | URL 前缀（Docker；同 `--base-path`） | `/` |
| `GITHUB_TOKEN` / `SKILL_BASE_GITHUB_TOKEN` | GitHub 导入 API 限额 | - |
| `SKILL_BASE_GITHUB_IMPORT_MAX_ZIP_MB` | GitHub zipball 体积上限 | `50` |
| `SKILL_BASE_GITHUB_CONNECTIVITY_TIMEOUT_MS` | GitHub 连通性探测超时 | `8000` |
| `SKILL_BASE_SQLITE3_PATH` | WAL 迁移用本机 `sqlite3` | - |
| `SKILL_BASE_WEBHOOK_TIMEOUT_MS` | 出站 webhook 超时 | 服务端默认 |

`GET /api/v1/health` 返回简化缓存统计。

## Session 存储

- **`memory`（默认）：** Session 在进程内存。重启后全部失效，用户重新登录。Session 读写不碰 SQLite。
- **`sqlite`：** Session 存在 `skills.db` 的 `sessions` 表。重启后仍在；多实例共享同一库文件时可共用 Session。

## Docker

```bash
docker build -t skill-base .
docker run -d -p 8000:8000 -v "$(pwd)/skill-data:/data" --name skill-base-server skill-base
```

持久化请用 `./skill-data` 这类独立目录。从源码跑 Docker 时，别默认挂载仓库自带的 `data/`，除非你就是要把 SQLite 写进工作区。

**部署前缀：**

```bash
docker run -d -p 8000:8000 -v "$(pwd)/skill-data:/data" \
  -e APP_BASE_PATH=/skills/ \
  --name skill-base-server skill-base
```

访问 `http://localhost:8000/skills/`，接口在 `http://localhost:8000/skills/api/v1/...`。反向代理的对外前缀要与 `APP_BASE_PATH` 一致。

**调试日志：**

```bash
docker run -d -p 8000:8000 -v "$(pwd)/skill-data:/data" \
  -e DEBUG=true \
  --name skill-base-server skill-base
```

**SQLite Session：**

```bash
docker run -d -p 8000:8000 -v "$(pwd)/skill-data:/data" \
  -e SESSION_STORE=sqlite \
  --name skill-base-server skill-base
```

## PM2

```bash
pnpm add -g pm2
pm2 start npx --name skill-base -- -y skill-base -d ./skill-data -p 8000
```

从仓库源码运行：

```bash
pm2 start bin/skill-base.js --name skill-base -- -d ./skill-data -p 8000
```

SQLite Session：

```bash
SESSION_STORE=sqlite pm2 start npx --name skill-base -- -y skill-base -d ./skill-data -p 8000
```

开机自启：

```bash
pm2 save
pm2 startup
```

## 备份

直接备份数据目录。索引和版本包在一起，恢复目录即可恢复服务。

若用 Git 管理内部基础设施：

```bash
git add .
git commit -m "backup skill-base data"
git push
```

## API

HTTP 接口详见 [api.md](api.md)。
