#!/bin/bash
# Simulate block stagnation by stopping the blockchain node

echo "Simulating block stagnation..."
curl -X POST http://localhost/api/v1/test/simulate-block-stagnation


# Watch the logs for block height changes
docker compose logs backend -f | grep "Block height"

#...........................
# Wait for 10 seconds
sleep 350


#disable block stagnation
curl -X POST http://localhost/api/v1/test/disable-block-stagnation

# check the block height
curl http://localhost/api/v1/test/block-height-status