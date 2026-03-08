# productboard-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for the [Productboard](https://www.productboard.com) API. Enables AI assistants (Claude, Cursor, etc.) to interact with your Productboard workspace.

## Tools

| Tool | Description |
|------|-------------|
| `pb_feature_list` | List features with filtering |
| `pb_feature_get` | Get a feature by ID |
| `pb_feature_create` | Create a new feature |
| `pb_feature_update` | Update an existing feature |
| `pb_feature_delete` | Delete a feature |
| `pb_product_list` | List products |
| `pb_product_create` | Create a product |
| `pb_product_hierarchy` | Get full product hierarchy |
| `pb_note_list` | List customer notes |
| `pb_note_create` | Create a customer note |
| `pb_objective_list` | List objectives |
| `pb_objective_create` | Create an objective |
| `pb_objective_update` | Update an objective |
| `pb_keyresult_list` | List key results |
| `pb_keyresult_create` | Create a key result |
| `pb_keyresult_update` | Update a key result |
| `pb_release_list` | List releases |
| `pb_release_create` | Create a release |
| `pb_release_update` | Update a release |
| `pb_release_status_update` | Update release status |
| `pb_release_timeline` | Get release timeline |

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "productboard": {
      "command": "npx",
      "args": ["-y", "@enreign/productboard-mcp"],
      "env": {
        "PRODUCTBOARD_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### Cursor / Other MCP Clients

```json
{
  "mcpServers": {
    "productboard": {
      "command": "npx",
      "args": ["-y", "@enreign/productboard-mcp"],
      "env": {
        "PRODUCTBOARD_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `PRODUCTBOARD_API_TOKEN` | Your Productboard API token (Bearer auth) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PRODUCTBOARD_AUTH_TYPE` | `bearer` | Auth type: `bearer` or `oauth2` |
| `PRODUCTBOARD_API_BASE_URL` | `https://api.productboard.com/v2` | API base URL |
| `PRODUCTBOARD_API_TIMEOUT` | `10000` | API request timeout (ms) |
| `API_RETRY_ATTEMPTS` | `3` | Number of retry attempts |
| `API_RETRY_DELAY` | `1000` | Delay between retries (ms) |
| `RATE_LIMIT_GLOBAL` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `CACHE_ENABLED` | `false` | Enable response caching |
| `CACHE_TTL` | `300` | Cache TTL (seconds) |
| `LOG_LEVEL` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |

### OAuth2 (optional)

| Variable | Description |
|----------|-------------|
| `PRODUCTBOARD_OAUTH_CLIENT_ID` | OAuth2 client ID |
| `PRODUCTBOARD_OAUTH_CLIENT_SECRET` | OAuth2 client secret |
| `PRODUCTBOARD_OAUTH_REDIRECT_URI` | OAuth2 redirect URI |

## Getting a Productboard API Token

1. Log in to your Productboard workspace
2. Go to **Profile & Settings** → **API Access**
3. Click **Generate API key** and copy the token

## License

MIT
