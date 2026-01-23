# Getting API Keys/Access Tokens from Nodes

If you have SSH or direct access to the nodes, here's how to find or generate authentication credentials.

## Method 1: Check Environment Variables

Authentication credentials are often stored as environment variables. Check the running container/process:

### For Docker Containers

```bash
# List running containers
docker ps

# Check environment variables of the inference container
docker exec <container_name> env | grep -i -E "API|AUTH|TOKEN|KEY|SECRET"

# Or inspect the container
docker inspect <container_name> | grep -i -E "API|AUTH|TOKEN|KEY|SECRET" -A 2 -B 2
```

### For Kubernetes Pods

```bash
# List pods
kubectl get pods

# Check environment variables
kubectl exec <pod_name> -- env | grep -i -E "API|AUTH|TOKEN|KEY|SECRET"

# Check secrets
kubectl get secrets
kubectl describe secret <secret_name>
```

### For Direct Process Access

```bash
# Check process environment
ps aux | grep -i inference
cat /proc/<pid>/environ | tr '\0' '\n' | grep -i -E "API|AUTH|TOKEN|KEY|SECRET"
```

## Method 2: Check Configuration Files

### Common Configuration Locations

```bash
# Check for config files
find /app -name "*.yaml" -o -name "*.yml" -o -name "*.json" -o -name "*.env" 2>/dev/null

# Check common config locations
ls -la /app/config* /app/.env* /etc/inference* ~/.config/inference* 2>/dev/null

# Check for API key files
find /app -name "*key*" -o -name "*token*" -o -name "*secret*" 2>/dev/null
```

### Check Application Config

```bash
# If using Python/FastAPI
grep -r "API_KEY\|AUTH\|TOKEN" /app --include="*.py" --include="*.yaml" --include="*.yml" 2>/dev/null

# Check for .env files
cat /app/.env 2>/dev/null
cat ~/.env 2>/dev/null
```

## Method 3: Check Docker Compose / Kubernetes Manifests

### Docker Compose

```bash
# Check docker-compose.yml
cat docker-compose.yml | grep -i -E "API|AUTH|TOKEN|KEY|SECRET" -A 2 -B 2

# Check .env file used by docker-compose
cat .env | grep -i -E "API|AUTH|TOKEN|KEY|SECRET"
```

### Kubernetes

```bash
# Check deployment manifests
kubectl get deployment <deployment_name> -o yaml | grep -i -E "API|AUTH|TOKEN|KEY|SECRET" -A 2 -B 2

# Check configmaps
kubectl get configmaps
kubectl describe configmap <configmap_name>

# Check secrets
kubectl get secrets
kubectl get secret <secret_name> -o yaml
```

## Method 4: Check Application Logs

Sometimes authentication details are logged (though this is a security risk):

```bash
# Check application logs
docker logs <container_name> 2>&1 | grep -i -E "API|AUTH|TOKEN|KEY" | head -20

# Or for Kubernetes
kubectl logs <pod_name> | grep -i -E "API|AUTH|TOKEN|KEY" | head -20
```

## Method 5: Check Reverse Proxy / API Gateway Configuration

If there's a reverse proxy (nginx, traefik, etc.) in front of VLLM:

```bash
# Check nginx config
find /etc/nginx -name "*.conf" -exec grep -l "authorization\|api.*key" {} \;

# Check traefik config
cat /etc/traefik/traefik.yml | grep -i -E "auth|key|token"

# Check for middleware configs
find /etc -name "*middleware*" -o -name "*auth*" 2>/dev/null
```

## Method 6: Check VLLM Configuration

VLLM itself may have API key configuration:

```bash
# Check VLLM startup arguments
ps aux | grep vllm

# Check VLLM config files
find /app -name "*vllm*" -type f 2>/dev/null
```

## Method 7: Generate a New API Key (If You Control the Node)

If you have control over the node and need to set up authentication:

### Option A: Use a Simple API Key

1. Generate a secure random key:
   ```bash
   openssl rand -hex 32
   # or
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. Set it as an environment variable:
   ```bash
   export API_KEY="your-generated-key"
   ```

3. Configure your application to check for this key in the `Authorization` header

### Option B: Use JWT Tokens

1. Generate a JWT secret:
   ```bash
   openssl rand -base64 32
   ```

2. Use a JWT library to generate tokens for clients

### Option C: Disable Authentication (Development Only)

If this is a development/test node, you might be able to disable authentication:

1. Check if there's an environment variable to disable auth:
   ```bash
   # Look for flags like:
   DISABLE_AUTH=true
   AUTH_REQUIRED=false
   ```

2. Or modify the application configuration to remove auth middleware

## Method 8: Check Node Documentation

The node operator may have documentation:

```bash
# Check for README files
find /app -name "README*" -o -name "*.md" 2>/dev/null | head -10

# Check for documentation
cat /app/README.md 2>/dev/null
```

## Method 9: Direct Database/Config Store Check

Some systems store API keys in databases:

```bash
# Check if there's a database
docker ps | grep -i postgres\|mysql\|redis

# Check for database connection strings
env | grep -i DB
```

## Quick Diagnostic Script

Here's a script to check common locations:

```bash
#!/bin/bash
echo "=== Checking Environment Variables ==="
env | grep -i -E "API|AUTH|TOKEN|KEY|SECRET" | head -20

echo -e "\n=== Checking Config Files ==="
find /app -maxdepth 3 -name "*.yaml" -o -name "*.yml" -o -name "*.json" -o -name ".env" 2>/dev/null | head -10

echo -e "\n=== Checking Docker Environment ==="
if command -v docker &> /dev/null; then
    docker ps --format "{{.Names}}" | while read container; do
        echo "Container: $container"
        docker exec $container env 2>/dev/null | grep -i -E "API|AUTH|TOKEN|KEY|SECRET" | head -5
    done
fi

echo -e "\n=== Checking Process Environment ==="
ps aux | grep -i inference | head -3
```

## Important Security Notes

⚠️ **Warning**: 
- API keys and tokens are sensitive credentials
- Never commit them to version control
- Don't log them in plain text
- Use secure storage (secrets management systems)
- Rotate keys regularly

## If You Can't Find Credentials

1. **Contact the node operator** - They should provide access credentials
2. **Check if authentication is optional** - Some nodes allow unauthenticated access from certain IPs
3. **Use the public API** - If available, use the decentralized API which handles authentication
4. **Check network-level access** - Some nodes only require being on the same network

## Example: Finding API Key in Docker Container

```bash
# Step 1: Find the container
docker ps | grep inference

# Step 2: Check environment
docker exec inference-container env | grep API_KEY

# Step 3: If found, use it:
export API_KEY=$(docker exec inference-container env | grep API_KEY | cut -d= -f2)

# Step 4: Use in curl
curl -X POST "http://xj7-5.s.filfox.io:19254/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen2.5-7B-Instruct", "messages": [{"role": "user", "content": "Hello"}]}'
```
