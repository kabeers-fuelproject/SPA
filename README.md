# SPA Backend

Python backend that signs in to the SPA web app at `https://203.135.2.93/Login.aspx`
and exposes it as a REST API.

## How login works
The site is ASP.NET WebForms:
1. `GET /Login.aspx` to collect `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` + session cookies.
2. Username and password are encrypted with **AES-128-CBC** (key = iv = `9090808080809090`, as used by the page's own `SubmitsEncry()` JS) and posted base64-encoded in the `HDusername` / `HDPassword` fields.
3. Successful auth redirects to `/Welcome.aspx`.

## Run backend
```
cd backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```
Default credentials come from env vars `SPA_USERNAME` / `SPA_PASSWORD`
(default: `District.bahawalnagar` / `SPA@1139`).

## Run frontend (React + Vite)
```
cd frontend
npm install
npm run dev     # http://127.0.0.1:5173 (proxies /api -> backend :8000)
```
Or serve the production build: `npm run build && npm run preview`.


## API
| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | Log in to SPA, returns `{ "token": "...", "token_type": "bearer" }` |
| GET | `/api/session/check` | Verify the session is still alive |
| GET | `/api/session/cookies` | Current server session cookies |
| GET | `/api/pages/{path}` | Fetch any authenticated page (parsed: title, tables, text) |
| GET | `/api/complaints` | Complaint List page (`MembersArea/Complaints/ComplaintList.aspx`) |
| POST | `/api/logout` | End server-side session |
| GET | `/api/health` | Liveness check |

All authenticated endpoints require header: `Authorization: Bearer <token>`.

## Example
```bash
TOKEN=$(curl -sk -X POST http://127.0.0.1:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"District.bahawalnagar","password":"SPA@1139"}' | jq -r .token)

curl -sk http://127.0.0.1:8000/api/complaints -H "Authorization: Bearer $TOKEN"
```

> The SPA server uses a self-signed TLS certificate, so the client disables
> certificate verification (`verify=False`).
