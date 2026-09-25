FROM docker.io/node:24-alpine AS builder

ENV TZ="Europe/Helsinki"

WORKDIR /opt/app-root/src

ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA

ARG IMAGE_SHA
ENV IMAGE_SHA=$IMAGE_SHA

ARG RELEASE_VERSION
ENV RELEASE_VERSION=$RELEASE_VERSION

ARG STAGING
ENV STAGING=$STAGING

ARG CI
ENV CI=$CI

COPY .npmrc ./
COPY package* ./
RUN npm ci --no-audit --no-fund
COPY . .

RUN npm run build


FROM docker.io/node:24-alpine

ENV TZ="Europe/Helsinki"
ENV NODE_ENV=production

WORKDIR /opt/app-root/src

ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA

ARG IMAGE_SHA
ENV IMAGE_SHA=$IMAGE_SHA

ARG RELEASE_VERSION
ENV RELEASE_VERSION=$RELEASE_VERSION

ARG STAGING
ENV STAGING=$STAGING

COPY .npmrc ./
COPY package* ./
RUN npm ci --omit-dev --ignore-scripts --no-audit --no-fund

COPY --from=builder /opt/app-root/src/dist ./dist
COPY migrations ./migrations

EXPOSE 8000

CMD ["npm", "run", "prod"]
