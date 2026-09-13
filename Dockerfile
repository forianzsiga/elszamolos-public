# elszamolos — static Vite PWA served from the NAS on a VPN-gated (tailnet-only)
# port. No auth proxy in front: Tailscale is the gate. The only Google auth left
# is the app's own, scoped to drive.file for user-data backup.
# Build context: repo root. The SPA is built with base '/elszamolos/' (same
# path-slug as the GitHub Pages deploy), so nginx serves it at /elszamolos/.
FROM node:22-alpine AS builder

WORKDIR /app
# .npmrc must be present BEFORE `npm ci`: @forianzsiga/homelab-ui resolves from
# the private GitLab package registry, not npmjs. The project is public on GitLab now,
# but we configure the registry URL if .npmrc is missing.
COPY package.json package-lock.json ./
RUN echo "@forianzsiga:registry=http://100.89.120.20:8089/gitlab/api/v4/projects/36/packages/npm/" > .npmrc
RUN npm ci

COPY . .

# Google Drive credentials are compiled INTO the bundle by Vite —
# src/services/googleDrive.ts reads them via import.meta.env at build time, so
# they cannot be supplied at container runtime. Without both values
# googleDriveService.isConfigured() is false and the Sync Settings page falls
# back to its "not configured" SetupView; the Drive backup feature is dead.
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_GOOGLE_API_KEY=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY

# Build provenance. public/version.json is a committed placeholder ("0.0.0",
# buildDate 2026-04-26) and .github/workflows/deploy.yml only rewrites it for the
# Pages deploy — so every container build served that placeholder. Overwrite it
# here, BEFORE the build, so Vite copies the truth into dist.
#
# Resolution order, first hit wins. Nothing is invented: when no real source is
# available the commit is recorded as "unknown" rather than faked.
#   1. APP_VERSION / APP_COMMIT — passed by the caller (CI, or a deploy step
#                                 reading `git describe` on the host)
#   2. git describe / rev-parse — when .git is inside the build context
#   3. package.json version
ARG APP_VERSION=
ARG APP_COMMIT=
ARG BUILD_DATE=
RUN set -eu; \
    VERSION="${APP_VERSION}"; \
    if [ -z "$VERSION" ]; then \
      VERSION="$(git describe --tags --always --dirty 2>/dev/null || true)"; \
    fi; \
    if [ -z "$VERSION" ]; then \
      VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo unversioned)"; \
    fi; \
    COMMIT="${APP_COMMIT}"; \
    if [ -z "$COMMIT" ]; then \
      COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"; \
    fi; \
    BUILT="${BUILD_DATE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"; \
    printf '{\n  "version": "%s",\n  "commit": "%s",\n  "buildDate": "%s"\n}\n' \
      "$VERSION" "$COMMIT" "$BUILT" > public/version.json; \
    cat public/version.json

RUN npm run build

FROM nginx:1.27-alpine

# All requests arrive at /elszamolos/*; strip the prefix so the PWA's
# base='/elszamolos/' assets resolve from the html root. History-router
# fallbacks go to /index.html (never back into this location -> no loop).
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]