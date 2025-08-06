FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma/schema.prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]