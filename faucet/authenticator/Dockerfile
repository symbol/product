FROM node:lts-alpine AS runner
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 5002
CMD ["npm", "start"]
