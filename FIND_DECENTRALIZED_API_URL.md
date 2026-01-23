# How to Find Your Testnet's Decentralized API URL

The decentralized API URL is the gateway that accepts signed inference requests and routes them to nodes. Here's how to find it for your testnet.

## Quick Methods

### Method 1: Check Docker Containers (If Running Locally)

```bash
# List all containers
docker ps

# Look for 'api' or 'decentralized-api' containers
docker ps | grep -E "api|decentralized"

# Check port mappings
docker port <api-container-name>

# Check environment variables
docker exec <api-container-name> env | grep -E "PUBLIC_URL|DAPI_API__PUBLIC_URL"
```

**Example output:**
```
9000/tcp -> 0.0.0.0:8000
DAPI_API__PUBLIC_URL=http://localhost:8000
```

### Method 2: Check Docker Compose Files

```bash
# Search for PUBLIC_URL in docker-compose files
grep -r "PUBLIC_URL\|DAPI_API__PUBLIC_URL" . --include="docker-compose*.yml"
```

**Example:**
```yaml
environment:
  - DAPI_API__PUBLIC_URL=http://your-domain.com:8000
  - PUBLIC_URL=http://your-domain.com:8000
```

### Method 3: Check Configuration Files

```bash
# Search for public_url in config files
grep -r "public_url\|PUBLIC_URL" . --include="config*.yaml" --include="*.env"
```

**Example config.yaml:**
```yaml
api:
  port: 8080
  public_url: http://your-domain.com:8080
```

### Method 4: Check Environment Variables

```bash
# Check if PUBLIC_URL is set
echo $PUBLIC_URL
echo $DAPI_API__PUBLIC_URL

# Or check in a specific directory
cd /path/to/your/testnet
source config.env  # or .env
echo $PUBLIC_URL
```

### Method 5: Check Kubernetes ConfigMaps (If Using K8s)

```bash
# List configmaps
kubectl get configmaps

# Check the config
kubectl get configmap <config-name> -o yaml | grep -i "public_url\|dapi"
```

### Method 6: Test Common Endpoints

The decentralized API typically runs on ports **8000**, **8080**, or **9000**:

```bash
# Test localhost
curl http://localhost:8000/health
curl http://localhost:8080/health
curl http://localhost:9000/health

# Test with your domain
curl http://your-domain.com:8000/health
```

If you get a response, that's likely your API URL!

## Understanding the Configuration

### Environment Variables

The decentralized API uses these environment variables:

- **`PUBLIC_URL`**: The public-facing URL (what clients use)
- **`DAPI_API__PUBLIC_URL`**: Same as PUBLIC_URL (internal format)
- **`DAPI_API__PUBLIC_SERVER_PORT`**: Port the API listens on (default: 9000)

### Configuration Files

In `config.yaml` files, look for:

```yaml
api:
  port: 8080
  public_url: http://your-domain.com:8080  # <-- This is your URL
```

### Docker Compose

In `docker-compose.yml`, look for:

```yaml
services:
  api:
    environment:
      - PUBLIC_URL=http://your-domain.com:8000  # <-- This is your URL
    ports:
      - "8000:9000"  # Maps host port 8000 to container port 9000
```

## Examples from Your Codebase

Based on your testnet setup files, here are examples:

### Example 1: From join scripts
```bash
# From gonka/test-net-cloud/nebius/join-additional/18227.sh
export PUBLIC_URL="http://xj7-5.s.filfox.io:19254"
```

### Example 2: From launch.py
```python
"PUBLIC_URL": "http://172.18.114.104:8000",  # Internal Docker IP
```

### Example 3: From config.yaml
```yaml
api:
  public_url: http://localhost:8080
```

## Using the Script

I've created a helper script that automates the search:

```bash
cd /Users/maria.mitina/MMD/DEV/gonka-tracker
chmod +x find_decentralized_api_url.sh
./find_decentralized_api_url.sh
```

This script will:
1. Check Docker containers for API services
2. Search docker-compose files
3. Search config files
4. Check environment variables
5. Test common ports

## Common Patterns

| Setup Type | Typical URL Pattern |
|------------|---------------------|
| **Local Docker** | `http://localhost:8000` |
| **Remote Testnet** | `http://<domain>:8000` or `http://<domain>:8080` |
| **Kubernetes** | `http://<service-name>:9000` (internal) or `http://<ingress-domain>` (external) |
| **Cloud Deployment** | `http://<public-ip>:8000` or `https://<domain>` |

## Important Notes

1. **Not a Node URL**: The decentralized API URL is different from node URLs
   - ❌ Node URL: `http://xj7-5.s.filfox.io:19254` (direct VLLM endpoint)
   - ✅ Decentralized API: `http://your-api-domain:8000` (gateway)

2. **Port Mapping**: If using Docker, check port mappings:
   ```bash
   docker port <api-container>
   # Output: 9000/tcp -> 0.0.0.0:8000
   # Use: http://localhost:8000 (not :9000)
   ```

3. **Internal vs External**: 
   - Internal Docker IPs (e.g., `172.18.x.x`) won't work from outside
   - Use the public/external URL or `localhost` if running locally

## Once You Find It

Set the environment variable:

```bash
export GONKA_API_URL="http://your-found-url:port"
```

Then test it:

```bash
python3 setup_client_example.py
```

## Troubleshooting

### "Connection timeout"
- The URL might be an internal Docker IP
- Find the external/public URL
- Check if the service is running: `docker ps | grep api`

### "Connection refused"
- The service might not be running
- Check if the port is correct
- Verify port mappings in docker-compose

### "Not Found" or "404"
- You might be using a node URL instead of the decentralized API
- The decentralized API should have `/v1/chat/completions` endpoint

## Quick Checklist

- [ ] Check Docker containers: `docker ps | grep api`
- [ ] Check environment variables: `docker exec <container> env | grep URL`
- [ ] Check config files: `grep -r "public_url" .`
- [ ] Check docker-compose: `grep -r "PUBLIC_URL" docker-compose*.yml`
- [ ] Test common ports: `curl http://localhost:8000/health`
- [ ] Verify it's the decentralized API (not a node): Should have `/v1/chat/completions`
