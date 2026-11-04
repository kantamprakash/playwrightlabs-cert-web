# Builds the React app and serves it with Nginx, which also proxies /api to the gateway (or the API).
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runs as a non-root user on port 8080, as Kubernetes/OpenShift security policies expect.
FROM nginxinc/nginx-unprivileged:1.29.8-alpine
# Where /api/** goes; override with -e API_UPSTREAM=http://gateway:8080. The DNS server used to look it up
# is read from the container's /etc/resolv.conf (Docker's or the cluster's), see docker/nginx.conf.
ENV API_UPSTREAM=http://api:8080 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
