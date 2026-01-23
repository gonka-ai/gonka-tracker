#!/bin/bash
# Find the external URL for internal Docker IP 172.18.114.104:8000

echo "=" | tr -d '\n' | head -c 70 && echo ""
echo "Finding External URL for Internal Docker IP"
echo "=" | tr -d '\n' | head -c 70 && echo ""
echo ""
echo "Internal URL: http://172.18.114.104:8000"
echo ""

# Method 1: Check if this IP is accessible (it shouldn't be from outside)
echo "Method 1: Testing Internal IP"
echo "-----------------------------"
if curl -s --connect-timeout 2 "http://172.18.114.104:8000/health" > /dev/null 2>&1; then
    echo "✅ Internal IP is accessible (you're on the same network)"
    echo "   You can use: http://172.18.114.104:8000"
else
    echo "❌ Internal IP is NOT accessible (expected - it's a Docker internal IP)"
    echo ""
    echo "You need to find the external/public URL."
fi
echo ""

# Method 2: Check for port mappings in docker-compose
echo "Method 2: Check Docker Port Mappings"
echo "-------------------------------------"
echo "Looking for containers with port 8000..."
echo ""

CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)

if [ -n "$CONTAINERS" ]; then
    for container in $CONTAINERS; do
        PORT_MAP=$(docker port "$container" 2>/dev/null | grep -E "8000|9000" || echo "")
        if [ -n "$PORT_MAP" ]; then
            echo "Container: $container"
            echo "  Port mappings:"
            echo "$PORT_MAP" | sed 's/^/    /'
            
            # Extract host port
            HOST_PORT=$(echo "$PORT_MAP" | grep -oP '\d+:\d+' | cut -d: -f1 | head -1)
            if [ -n "$HOST_PORT" ]; then
                echo "  → Try: http://localhost:$HOST_PORT"
            fi
            echo ""
        fi
    done
else
    echo "No Docker containers found."
    echo ""
fi

# Method 3: Check for public domain/IP in config files
echo "Method 3: Check for Public Domain/IP"
echo "-------------------------------------"
echo "Searching for xj7-5.s.filfox.io or other public domains..."
echo ""

PUBLIC_URLS=$(grep -r "xj7-5\|filfox\|PUBLIC_URL" ../gonka/test-net-cloud/nebius/join*.sh 2>/dev/null | grep "PUBLIC_URL" | head -5)

if [ -n "$PUBLIC_URLS" ]; then
    echo "Found in join scripts:"
    echo "$PUBLIC_URLS" | sed 's/^/  /'
    echo ""
    echo "These are likely the external URLs you should use!"
else
    echo "No public URLs found in join scripts."
    echo ""
fi

# Method 4: Check if there's a proxy/nginx
echo "Method 4: Check for Proxy/Ingress"
echo "----------------------------------"
echo "Looking for nginx, traefik, or ingress configurations..."
echo ""

PROXY_FILES=$(find .. -name "*proxy*" -o -name "*ingress*" -o -name "*nginx*" 2>/dev/null | grep -E "\.(yml|yaml)$" | head -5)

if [ -n "$PROXY_FILES" ]; then
    for file in $PROXY_FILES; do
        if grep -q "8000\|172.18.114.104" "$file" 2>/dev/null; then
            echo "File: $file"
            grep -E "8000|172.18.114.104|host|domain" "$file" | head -5 | sed 's/^/  /'
            echo ""
        fi
    done
else
    echo "No proxy/ingress configs found."
    echo ""
fi

echo "=" | tr -d '\n' | head -c 70 && echo ""
echo "Summary"
echo "=" | tr -d '\n' | head -c 70 && echo ""
echo ""
echo "Internal URL: http://172.18.114.104:8000 (Docker internal - not accessible externally)"
echo ""
echo "To find the external URL:"
echo "1. Check docker port mappings (above)"
echo "2. Check join scripts for PUBLIC_URL (above)"
echo "3. Check if there's a public domain/IP for this host"
echo "4. Check if port 8000 is exposed on the host machine"
echo ""
echo "Common solutions:"
echo "  - If running locally: http://localhost:8000 (if port is mapped)"
echo "  - If on a server: http://<server-ip>:8000 (if port is exposed)"
echo "  - If using a domain: http://<domain>:8000"
echo "  - Check join scripts: They often have the public URL"
echo ""
