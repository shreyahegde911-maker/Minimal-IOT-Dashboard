# Minimal IoT Dashboard — Login UI starter

Copy `frontend/login.html`, `frontend/login.css`, and `frontend/login.js` into the repository's existing `frontend/` folder.

Open `/login.html` through the project's existing local frontend server. The page is styled to match the current dashboard and includes responsive layout, email/password fields, password visibility toggle, client-side validation, and feedback states.

## Before backend integration
Coordinate with the authentication teammate to confirm the login endpoint, request field names, response/error shape, session strategy, and admin/user redirect paths. Then set `LOGIN_API_URL` in `login.js` to the agreed endpoint and implement response handling using the agreed contract.

This starter deliberately does not fake successful login, hardcode credentials, store passwords in browser storage, or implement admin/user authorization. It is a UI-only starting point until the backend contract is confirmed.

## Suggested checks
- Empty fields and invalid email format
- Password show/hide toggle
- Keyboard focus and Enter-to-submit
- Mobile layout
- API error response
- Successful authentication and role redirect after integration
