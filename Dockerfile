# Node.js 22 Alpine LTS
FROM node:22-alpine

WORKDIR /app

# Paketlarni o'rnatish
COPY package*.json ./
RUN npm install --omit=dev

# Loyiha fayllarini nusxalash
COPY . .

# Xavfsiz port
EXPOSE 7122

ENV PORT=7122
ENV NODE_ENV=production

# Serverni ishga tushirish
CMD ["npm", "start"]
