FROM node:lts-alpine AS builder
WORKDIR /client
COPY ./client .
RUN npm install && npm run build

FROM node:lts-alpine AS runner
ENV DATA_STORAGE_PATH=./data
WORKDIR /app
COPY . .
COPY --from=builder /client/build /app/client/build
RUN npm install
EXPOSE 5001
CMD ["npm", "start"]
