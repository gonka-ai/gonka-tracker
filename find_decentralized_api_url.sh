#!/bin/bash
# Script to find the decentralized API URL for your testnet

echo "=" | tr -d '\n' | head -c 70 && echo ""
echo "Finding Decentralized API URL for Your Testnet"
echo "=" | tr -d '\n' | head -c 70 && echo ""
echo ""

# Method 1: Check Docker containers
echo "Method 1: Check Docker Containers"
echo "---------------------------------"
echo ""
echo "Looking for 'api' or 'decentralized-api' containers..."
echo ""

API_CONTAINERS=$(docker ps --format "{{.Names}}" | grep -E "api|decentralized" || echo "")

if [ -n "$API_CONTAINERS" ]; then
    echo "Found API containers:"
    echo "$API_CONTAINERS"
    echo ""
    
    for container in $API_CONTAINERS; do
        echo "Container: $container"
        echo "  Port mappings:"
        docker port "$container" 2>/dev/null | sed 's/^/    /' || echo "    (no port mappings found)"
        
        echo "  Environment variables:"
        docker exec "$container" env 2>/dev/null | grep -E "PUBLIC_URL|DAPI_API__PUBLIC_URL|PUBLIC_SERVER_PORT" | sed 's/^/    /' || echo "    (not accessible or no relevant vars)"
        echo ""
    done
else
    echo "No API containers found."
    echo ""
fi

# Method 2: Check docker-compose files
echo "Method 2: Check Docker Compose Files"
echo "------------------------------------"
echo ""

COMPOSE_FILES=$(find . -name "docker-compose*.yml" -o -name "docker-compose*.yaml" 2>/dev/null | head -5)

if [ -n "$COMPOSE_FILES" ]; then
    echo "Found docker-compose files. Checking for PUBLIC_URL..."
    echo ""
    for file in $COMPOSE_FILES; do
        if grep -q "PUBLIC_URL\|DAPI_API__PUBLIC_URL" "$file" 2>/dev/null; then
            echo "File: $file"
            grep -E "PUBLIC_URL|DAPI_API__PUBLIC_URL" "$file" | sed 's/^/  /'
            echo ""
        fi
    done
else
    echo "No docker-compose files found in current directory."
    echo ""
fi

# Method 3: Check config files
echo "Method 3: Check Configuration Files"
echo "----------------------------------"
echo ""

CONFIG_FILES=$(find . -name "config*.yaml" -o -name "config*.yml" -o -name "*.env" 2>/dev/null | head -10)

if [ -n "$CONFIG_FILES" ]; then
    echo "Found config files. Checking for public_url..."
    echo ""
    for file in $CONFIG_FILES; do
        if grep -qi "public_url\|PUBLIC_URL" "$file" 2>/dev/null; then
            echo "File: $file"
            grep -i "public_url\|PUBLIC_URL" "$file" | sed 's/^/  /'
            echo ""
        fi
    done
else
    echo "No config files found in current directory."
    echo ""
fi

# Method 4: Check environment variables
echo "Method 4: Check Environment Variables"
echo "-------------------------------------"
echo ""

if [ -n "$PUBLIC_URL" ]; then
    echo "PUBLIC_URL is set: $PUBLIC_URL"
    echo ""
elif [ -n "$DAPI_API__PUBLIC_URL" ]; then
    echo "DAPI_API__PUBLIC_URL is set: $DAPI_API__PUBLIC_URL"
    echo ""
else
    echo "No PUBLIC_URL or DAPI_API__PUBLIC_URL found in environment."
    echo ""
fi

# Method 5: Check running services
echo "Method 5: Test Common Ports"
echo "---------------------------"
echo ""

COMMON_PORTS=(8000 8080 9000 30000)

for port in "${COMMON_PORTS[@]}"; do
    echo -n "Testing localhost:$port ... "
    if curl -s --connect-timeout 2 "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ Responds!"
        echo "  Try: http://localhost:$port"
    else
        echo "❌ No response"
    fi
done

echo ""
echo "=" | tr -d '\n' | head -c 70 && echo ""
echo "Summary"
echo "=" | tr -d '\n' | head -c 70 && echo ""
echo ""
echo "The decentralized API URL is typically:"
echo "  - Set via PUBLIC_URL or DAPI_API__PUBLIC_URL environment variable"
echo "  - Configured in config.yaml files (public_url field)"
echo "  - Exposed on port 8000, 8080, or 9000"
echo ""
echo "Common patterns:"
echo "  - http://<your-domain>:8000"
echo "  - http://<your-domain>:8080"
echo "  - http://<your-domain>:9000"
echo "  - http://localhost:8000 (if running locally)"
echo ""
echo "Once you find it, set:"
echo "  export GONKA_API_URL=\"<your-decentralized-api-url>\""
echo ""
