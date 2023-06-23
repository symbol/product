FROM node:lts-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm install -g serve

EXPOSE 3000
CMD ["/bin/sh", "-c", "./scripts/docker/startup.sh"]
