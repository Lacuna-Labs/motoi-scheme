# A FOREMAN, ANYWHERE (LACUNA-1.3-DESIGN §32, B34) — the foreman and the language, nothing else: no brain, no keys, no
# Lacuna. Built from ~/code (the context holds lacuna/lacuna-foreman and lacuna/lacuna-scheme side by side):
#   docker build -f lacuna/lacuna-foreman/Dockerfile -t lacuna-foreman ~/code
# Run on Fly in its OWN app (never production's), reaching home over WireGuard; its token is a Fly secret.
FROM node:22-alpine
WORKDIR /srv
COPY lacuna/lacuna-scheme lacuna/lacuna-scheme
COPY lacuna/lacuna-foreman lacuna/lacuna-foreman
ENV FOREMAN_HOST=:: FOREMAN_PORT=1139 FOREMAN_DIR=/srv/state FOREMAN_TOKEN_FILE=/run/secrets/foreman-token \
    FOREMAN_IDLE_S=300 FOREMAN_MAX_LIFE_S=86400
RUN adduser -D foreman && mkdir -p /srv/state && chown foreman /srv/state
USER foreman
EXPOSE 1139
CMD ["node", "lacuna/lacuna-foreman/foreman.mjs"]
