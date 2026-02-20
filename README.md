# Productboard MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the [Productboard API v2](https://developer.productboard.com). Enables AI assistants like Claude to read and manage your Productboard workspace — features, products, notes, objectives, key results, and releases.

## Tools

**21 tools** across 5 resource groups, all backed by the Productboard v2 API (`https://api.productboard.com/v2`).

### Features (5)
| Tool | Description |
|------|-------------|
| `pb_feature_list` | List features with optional filters (status, owner, tags, search) |
| `pb_feature_get` | Get detailed information about a specific feature |
| `pb_feature_create` | Create a new feature |
| `pb_feature_update` | Update an existing feature |
| `pb_feature_delete` | Delete or archive a feature |

### Products (3)
| Tool | Description |
|------|-------------|
| `pb_product_list` | List all products in the workspace |
| `pb_product_create` | Create a new product or sub-product |
| `pb_product_hierarchy` | Get the full product hierarchy tree |

### Notes (2)
| Tool | Description |
|------|-------------|
| `pb_note_list` | List customer feedback notes |
| `pb_note_create` | Create a customer feedback note |

### Objectives & Key Results (6)
| Tool | Description |
|------|-------------|
| `pb_objective_list` | List objectives |
| `pb_objective_create` | Create a new objective |
| `pb_objective_update` | Update an existing objective |
| `pb_keyresult_list` | List key results |
| `pb_keyresult_create` | Create a key result for an objective |
| `pb_keyresult_update` | Update an existing key result |

### Releases (5)
| Tool | Description |
|------|-------------|
| `pb_release_list` | List releases |
| `pb_release_create` | Create a new release |
| `pb_release_update` | Update a release |
| `pb_release_status_update` | Update release status and publish release notes |
| `pb_release_timeline` | Get release timeline with features and milestones |

## Quick Start

### Prerequisites

- Node.js 18+
- Productboard API token ([get one here](https://your-subdomain.productboard.com/settings/api-keys))
- MCP-compatible client (e.g. [Claude Desktop](https://claude.ai/download))

### Installation

```bash
git clone https://github.com/Enreign/productboard-mcp.git
cd productboard-mcp
npm install
npm run build
```

### Configuration

```bash
cp .env.example .env
# Set PRODUCTBOARD_API_TOKEN in .env
```

### Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "productboard": {
      "command": "node",
      "args": ["/path/to/productboard-mcp/dist/index.js"],
      "env": {
        "PRODUCTBOARD_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PRODUCTBOARD_API_TOKEN` | — | **Required.** Bearer token from Productboard settings |
| `PRODUCTBOARD_AUTH_TYPE` | `bearer` | Auth method: `bearer` or `oauth2` |
| `PRODUCTBOARD_API_BASE_URL` | `https://api.productboard.com/v2` | API base URL |
| `PRODUCTBOARD_API_TIMEOUT` | `10000` | Request timeout in ms |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `RATE_LIMIT_GLOBAL` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |

OAuth2 variables (only needed if `PRODUCTBOARD_AUTH_TYPE=oauth2`):

| Variable | Description |
|----------|-------------|
| `PRODUCTBOARD_OAUTH_CLIENT_ID` | OAuth2 client ID |
| `PRODUCTBOARD_OAUTH_CLIENT_SECRET` | OAuth2 client secret |
| `PRODUCTBOARD_OAUTH_REDIRECT_URI` | Redirect URI (default: `http://localhost:3000/callback`) |

## Development

```bash
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm test             # Run tests (~280 tests)
npm run test:watch   # Watch mode
npm run lint         # ESLint
npm run format       # Prettier
```

### Project Structure

```
src/
├── core/           # MCP server and tool registry
├── auth/           # Bearer token and OAuth2 authentication
├── api/            # Productboard API v2 client
├── tools/          # Tool implementations
│   ├── features/
│   ├── products/
│   ├── notes/
│   ├── objectives/
│   └── releases/
├── middleware/     # Rate limiting, validation
└── utils/          # Logger, config

tests/
├── unit/           # Unit tests
└── integration/    # Integration tests
```

## License

MIT
