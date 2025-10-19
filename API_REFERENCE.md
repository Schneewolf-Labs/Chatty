# API Reference

Chatty provides a REST API for external control and monitoring.

## Configuration

Enable the API in `config.yml`:

```yaml
api:
  enabled: true
  port: 3000
```

Base URL: `http://localhost:3000`

## API Endpoints

### Send Message

Send a message to the bot and receive a response.

**Endpoint:** `POST /`

**Request Body:**
```json
{
  "event": "send_message",
  "data": "Hello, how are you?"
}
```

**Response:**
```json
{
  "event": "receive_message",
  "data": "I'm doing well, thank you for asking!"
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"event":"send_message","data":"Hello!"}'
```

**Example using JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'send_message',
    data: 'Hello!'
  })
});

const result = await response.json();
console.log(result.data);
```

**Example using Python:**
```python
import requests

response = requests.post(
    'http://localhost:3000/',
    json={'event': 'send_message', 'data': 'Hello!'}
)

print(response.json()['data'])
```

## Response Format

All API responses follow this format:

```json
{
  "event": "event_name",
  "data": "response_data"
}
```

### Event Types

| Event | Direction | Description |
|-------|-----------|-------------|
| `send_message` | Client → Server | Send message to bot |
| `receive_message` | Server → Client | Receive bot response |

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid JSON or missing fields)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": "Error description"
}
```

**Example Error:**
```json
{
  "error": "Invalid request format"
}
```

## Integration Examples

### OBS Browser Source

Create an HTML file for OBS:

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            background: transparent;
            color: white;
            font-family: Arial;
            font-size: 24px;
            padding: 20px;
        }
        #response {
            background: rgba(0,0,0,0.7);
            padding: 15px;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div id="response"></div>
    <script>
        async function sendMessage(text) {
            const res = await fetch('http://localhost:3000/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    event: 'send_message',
                    data: text
                })
            });
            const data = await res.json();
            document.getElementById('response').textContent = data.data;
        }

        // Example: send message every 10 seconds
        setInterval(() => {
            sendMessage('What are you thinking about?');
        }, 10000);
    </script>
</body>
</html>
```

### Stream Deck Integration

Use Stream Deck's "Website" action with HTTP request:

**URL:** `http://localhost:3000/`
**Method:** `POST`
**Headers:** `Content-Type: application/json`
**Body:**
```json
{
  "event": "send_message",
  "data": "Tell me a joke"
}
```

### Node.js Client Library

```javascript
class ChattyClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }

    async sendMessage(message) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'send_message',
                data: message
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.data;
    }
}

// Usage
const client = new ChattyClient();
const response = await client.sendMessage('Hello!');
console.log(response);
```

### Python Client Library

```python
import requests
from typing import Optional

class ChattyClient:
    def __init__(self, base_url: str = 'http://localhost:3000'):
        self.base_url = base_url

    def send_message(self, message: str) -> Optional[str]:
        try:
            response = requests.post(
                self.base_url,
                json={'event': 'send_message', 'data': message},
                timeout=30
            )
            response.raise_for_status()
            return response.json()['data']
        except requests.exceptions.RequestException as e:
            print(f'API error: {e}')
            return None

# Usage
client = ChattyClient()
response = client.send_message('Hello!')
print(response)
```

## Best Practices

### Rate Limiting

Respect the bot's `response-interval` setting (default 3500ms). Avoid sending messages faster than the bot can process them.

**Example with rate limiting:**
```javascript
class RateLimitedClient {
    constructor(baseUrl, minInterval = 3500) {
        this.client = new ChattyClient(baseUrl);
        this.minInterval = minInterval;
        this.lastRequest = 0;
    }

    async sendMessage(message) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;

        if (timeSinceLastRequest < this.minInterval) {
            await new Promise(resolve =>
                setTimeout(resolve, this.minInterval - timeSinceLastRequest)
            );
        }

        this.lastRequest = Date.now();
        return await this.client.sendMessage(message);
    }
}
```

### Error Handling

Always implement proper error handling:

```javascript
async function robustSendMessage(message) {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const response = await fetch('http://localhost:3000/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'send_message',
                    data: message
                }),
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            retries++;
            if (retries >= maxRetries) {
                console.error('Max retries exceeded:', error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
    }
}
```

### Timeouts

Set appropriate timeouts for requests:

```python
response = requests.post(
    url,
    json=data,
    timeout=30  # 30 second timeout
)
```

## CORS Configuration

If accessing the API from a browser on a different origin, you may need to enable CORS. This is currently not configurable and would require code modification.

## Security Considerations

- The API does not currently implement authentication
- Only bind to `localhost` unless you need external access
- Use a reverse proxy (nginx, Apache) for external access
- Implement authentication at the proxy level if needed

## Future API Features

Planned additions:
- Authentication/API keys
- WebSocket support for real-time events
- Additional endpoints for bot status and configuration
- Message history retrieval
- Response streaming

---

For configuration details, see [CONFIGURATION.md](./CONFIGURATION.md).
