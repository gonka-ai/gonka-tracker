#!/bin/bash
# Quick script to check PostgreSQL database status

echo "=== Checking PostgreSQL Database ==="
echo ""

echo "1. Node Metrics Count:"
docker-compose exec -T postgres psql -U postgres -d gonka_tracker -c "SELECT COUNT(*) as total_records FROM node_metrics;"

echo ""
echo "2. Network Metrics Count:"
docker-compose exec -T postgres psql -U postgres -d gonka_tracker -c "SELECT COUNT(*) as total_records FROM network_metrics;"

echo ""
echo "3. Latest Node Metrics (last 5):"
docker-compose exec -T postgres psql -U postgres -d gonka_tracker -c "SELECT time, node_address, inference_count, missed_rate, node_healthy FROM node_metrics ORDER BY time DESC LIMIT 5;"

echo ""
echo "4. Latest Network Metrics (last 5):"
docker-compose exec -T postgres psql -U postgres -d gonka_tracker -c "SELECT time, total_nodes, active_nodes, avg_missed_rate FROM network_metrics ORDER BY time DESC LIMIT 5;"

echo ""
echo "5. Time Range of Data:"
docker-compose exec -T postgres psql -U postgres -d gonka_tracker -c "SELECT MIN(time) as earliest, MAX(time) as latest FROM node_metrics;"
