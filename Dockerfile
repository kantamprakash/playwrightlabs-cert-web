# Builds the React app and serves it with Nginx, which also proxies /api to the gateway (or the API).
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
# Where /api/** goes; override with -e API_UPSTREAM=http://gateway:8080.
ENV API_UPSTREAM=http://api:8080
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
