# Supabase Setup

This backend is now configured to use PostgreSQL through environment variables, which fits Supabase directly.

## 1. Create the Supabase project

Create a Supabase project and open:

- `Project Settings` -> `Database`
- copy the direct PostgreSQL connection string

Use the direct connection first. The transaction pooler is fine later, but direct mode is simpler while validating the migration.

## 2. Set environment variables

Export these before starting Spring Boot:

```bash
export SPRING_DATASOURCE_URL='jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require'
export SPRING_DATASOURCE_USERNAME='postgres'
export SPRING_DATASOURCE_PASSWORD='<your-db-password>'
export JWT_SECRET='<long-random-secret>'
export N8N_WEBHOOK_URL='<optional-webhook-url>'
```

If you use the Supabase pooler instead of the direct host, replace the URL with the pooler host and port from the Supabase dashboard.

## 3. Start the backend once

Run the backend so Hibernate creates the schema:

```bash
cd backend
./mvnw spring-boot:run
```

With `spring.jpa.hibernate.ddl-auto=update`, the tables will be created automatically on first boot.

## 4. Optional: load demo data

This project no longer auto-runs `data.sql` against cloud databases. If you want sample users/tasks, run:

```sql
\i /absolute/path/to/backend/src/main/resources/data.sql
```

Or paste the contents of [data.sql](/home/azin/n8n/deadline/backend/src/main/resources/data.sql) into the Supabase SQL editor.

Sample seeded accounts:

- `manager@gmail.com` / `123456`
- `user1@gmail.com` / `123456`

## 5. Frontend

The frontend still talks only to your Spring Boot API. Moving to Supabase as the database does not require frontend URL changes.

## Realtime note

Supabase supports realtime row changes, but this app is not wired to consume them yet. After the DB migration, you have two clean options:

1. Keep Spring Boot as the main API and add a WebSocket/SSE layer for live updates.
2. Subscribe from the frontend to Supabase Realtime for selected tables and refresh the affected views.

## Important changes in this repo

- Switched runtime driver from MySQL to PostgreSQL.
- Datasource now comes from environment variables.
- Cloud SQL auto-seeding is disabled by default.
- `Task.subtasks` is no longer serialized in the main task payload, which reduces unnecessary DB work on list endpoints.
