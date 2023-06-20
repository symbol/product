FROM node:lts-alpine AS runner
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 5001
CMD ["npm", "start"]
