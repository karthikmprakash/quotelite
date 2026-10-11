# Security

Do not open issues that include live keys, session cookies, or customer data.

Report a vulnerability by email to the repository owner. Rotate any exposed `STRIPE_SECRET_KEY` and session cookies before you write.

Production hosts should set `COOKIE_SECURE=1` behind HTTPS and keep `.env` off the image.
