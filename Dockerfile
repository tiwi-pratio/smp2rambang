FROM node:22-alpine

# git may be needed by some npm lifecycle scripts
RUN apk add --no-cache git

WORKDIR /app

# Install pnpm 9 (matches lockfileVersion: '9.0')
# npm global bin is already on PATH in official node images
RUN npm install -g pnpm@9

# Copy workspace config files first (for better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json ./

# Copy all package.json files so pnpm can resolve the full workspace
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/siakad/package.json artifacts/siakad/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY scripts/package.json scripts/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy all remaining source files
COPY . .

# Build frontend (React + Vite), BASE_PATH=/ for production
RUN BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/siakad run build

# Build backend (Express + esbuild)
RUN NODE_ENV=production pnpm --filter @workspace/api-server run build

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
