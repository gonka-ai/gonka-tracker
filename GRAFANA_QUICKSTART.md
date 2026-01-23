# Grafana Quick Start

## TL;DR

1. **Add to config.env:**
   ```bash
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=gonka_tracker
   GRAFANA_ADMIN_USER=admin
   GRAFANA_ADMIN_PASSWORD=admin
   ```

2. **Start services:**
   ```bash
   docker-compose up -d postgres grafana
   ```

3. **Access Grafana:**
   - URL: `http://localhost/grafana`
   - Username: `admin`
   - Password: `admin`

4. **PostgreSQL is already configured** as a data source (auto-provisioned)

5. **Create dashboards** using the queries from `GRAFANA_SETUP.md`

## What's Included

- ✅ PostgreSQL with TimescaleDB extension
- ✅ Grafana with auto-configured PostgreSQL data source
- ✅ Dashboard provisioning directory
- ✅ All accessible via Traefik at `/grafana`

## Next Steps

1. Create database tables (see `GRAFANA_SETUP.md` Step 6)
2. Update backend to write metrics to PostgreSQL
3. Create your first dashboard in Grafana UI
4. Set up alert rules
5. Export dashboards as JSON to `grafana/dashboards/` for version control

## Full Documentation

See `GRAFANA_SETUP.md` for complete setup instructions, example queries, and alert configurations.
