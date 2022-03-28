FROM node:12 AS builder
WORKDIR /client
COPY ./client .
RUN npm install && npm run build

FROM node:12 AS runner
WORKDIR /app
COPY . .
COPY --from=builder /client/build /app/client/build
RUN npm install
EXPOSE 5001
CMD ["npm", "start"]