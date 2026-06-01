# node-huckleberry-mcp

A **Node.js/TypeScript MCP (Model Context Protocol) server** for the [Huckleberry baby tracker](https://huckleberrycare.com/), ported from the MIT-licensed Python projects:

- [`Woyken/py-huckleberry-api`](https://github.com/Woyken/py-huckleberry-api) — Firebase Auth + Firestore client
- [`bckenstler/py-huckleberry-mcp`](https://github.com/bckenstler/py-huckleberry-mcp) — FastMCP server exposing 22 tools

Expose Huckleberry's data (sleep, feeding, growth, diapers, solids) directly in [Claude Desktop](https://claude.ai/download), or integrate the MCP server into other AI applications.

## Installation

### Requirements

- **Node.js** 18+ (tested on 18.x, 20.x)
- **npm** 9+

### Quick Start

```bash
npm install -g node-huckleberry-mcp
```

Or use directly via `npx`:

```bash
npx node-huckleberry-mcp
```

### From source

```bash
git clone https://github.com/KenLSM/node-huckleberry-mcp.git
cd node-huckleberry-mcp
npm install
npm run build
node dist/index.js
```

## Configuration

### Environment Variables

The server reads credentials from environment variables:

```bash
HUCKLEBERRY_EMAIL=you@example.com
HUCKLEBERRY_PASSWORD=your-password
HUCKLEBERRY_TIMEZONE=America/New_York
```

Create a `.env` file in your project root (see `.env.example` for a template):

```bash
cp .env.example .env
# Edit .env with your Huckleberry credentials
```

**Note:** Never commit `.env` to version control. The `.gitignore` already excludes it.

### Claude Desktop Integration

To use this server with Claude Desktop, add it to your `claude_desktop_config.json`:

**macOS/Linux:** `~/.config/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "huckleberry": {
      "command": "npx",
      "args": ["node-huckleberry-mcp"],
      "env": {
        "HUCKLEBERRY_EMAIL": "you@example.com",
        "HUCKLEBERRY_PASSWORD": "your-password",
        "HUCKLEBERRY_TIMEZONE": "America/New_York"
      }
    }
  }
}
```

After updating the config, restart Claude Desktop. The Huckleberry tools will appear in the tool list.

## Tools

The server exposes **29 tools** across 6 categories:

### Child Management (2 tools)

| Tool        | Input       | Output                                |
| ----------- | ----------- | ------------------------------------- |
| `get_user`  | —           | User profile + child list             |
| `get_child` | `child_uid` | Child profile (name, birthDate, etc.) |

### Sleep (7 tools)

| Tool                | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `start_sleep`       | Begin active sleep session               |
| `pause_sleep`       | Pause active sleep                       |
| `resume_sleep`      | Resume paused sleep                      |
| `cancel_sleep`      | Cancel sleep session                     |
| `complete_sleep`    | Mark sleep as completed                  |
| `log_sleep`         | Log completed sleep with start/end times |
| `get_sleep_history` | Retrieve recent sleep sessions           |

### Feeding (9 tools)

| Tool                  | Purpose                     |
| --------------------- | --------------------------- |
| `start_feeding`       | Begin nursing session       |
| `pause_feeding`       | Pause active nursing        |
| `resume_feeding`      | Resume paused nursing       |
| `switch_feeding_side` | Switch sides during nursing |
| `complete_feeding`    | Mark nursing as completed   |
| `log_bottle`          | Log bottle feeding          |
| `log_pump`            | Log pumped milk             |
| `list_pump_intervals` | Retrieve pump sessions      |
| `get_feed_history`    | Retrieve feeding history    |

### Health (2 tools)

| Tool         | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `log_diaper` | Log diaper change (pee/poo/both/dry + color/consistency) |
| `log_potty`  | Log potty training activity                              |

### Growth (3 tools)

| Tool                 | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `log_growth`         | Log measurements (weight, height, head circumference) |
| `get_latest_growth`  | Get most recent growth record                         |
| `get_growth_history` | Retrieve growth history                               |

### Solids (4 tools)

| Tool                 | Purpose                     |
| -------------------- | --------------------------- |
| `list_curated_foods` | Fetch curated food database |
| `list_custom_foods`  | List custom foods for child |
| `create_custom_food` | Create custom food entry    |
| `log_solids`         | Log solids feeding          |

## Development

### Scripts

```bash
npm run build      # TypeScript → JavaScript (tsc)
npm run lint       # Lint with oxlint
npm run format     # Format with oxfmt
npm run format:check  # Check formatting without changes
npm test           # Run unit tests (Vitest)
npm run test:watch # Watch mode for tests
npm run dev        # Run in dev mode (tsx)
```

### Toolchain

- **TypeScript** 5.3+ with strict mode
- **oxc** (oxlint + oxfmt) — fast, Rust-based linting & formatting
- **Vitest** — unit test runner
- **Zod** — runtime data validation
- **Firebase JS SDK** — Firestore + Auth

### Architecture

```
src/
├── auth/            # Authentication (T1.1)
├── client/          # Huckleberry API operations (T1.2–T1.9)
├── models/          # Zod schemas for Firestore docs (T1.3)
├── server/          # MCP server framework (T2.1–T2.2)
├── tools/           # MCP tool implementations (T2.3–T2.8)
├── __tests__/       # Unit & smoke tests
└── index.ts         # Entry point
```

See [AGENTS.md](./AGENTS.md) for architecture details and conventions.

### Testing

Unit tests are in `src/__tests__/` and use Vitest with Firebase mocked:

```bash
npm test
```

Run a single test file:

```bash
npm test -- models.test.ts
```

Watch mode:

```bash
npm run test:watch
```

## Licensing & Attribution

This project is a Node.js port of two MIT-licensed projects:

- **`py-huckleberry-api`** © 2025 Woyken ([GitHub](https://github.com/Woyken/py-huckleberry-api), [MIT License](https://github.com/Woyken/py-huckleberry-api/blob/main/LICENSE))
- **`py-huckleberry-mcp`** © 2026 Huckleberry MCP Contributors ([GitHub](https://github.com/bckenstler/py-huckleberry-mcp), [MIT License](https://github.com/bckenstler/py-huckleberry-mcp/blob/main/LICENSE))

This port includes substantial design and implementation from both upstream projects. The full MIT license text is reproduced below.

### License (MIT)

```
MIT License

Copyright (c) 2025 KenLSM

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Safety & Privacy

- **No data is stored locally.** All operations are authenticated reads/writes to your Huckleberry Firestore database.
- **Credentials are environment-based.** Never commit `.env` or hardcode credentials.
- This is an **unofficial** client of a third-party service; the API is reverse-engineered and may change.

## Support

- **Documentation:** See [AGENTS.md](./AGENTS.md) for contributor guidance.
- **Issues:** Report bugs or request features on [GitHub Issues](https://github.com/KenLSM/node-huckleberry-mcp/issues).
- **Upstream:** For questions about Huckleberry data or API changes, see the original Python projects.

---

Built with ❤️ as a Node/TypeScript port of [`py-huckleberry-api`](https://github.com/Woyken/py-huckleberry-api) and [`py-huckleberry-mcp`](https://github.com/bckenstler/py-huckleberry-mcp).
