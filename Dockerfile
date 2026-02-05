FROM mcr.microsoft.com/playwright:v1.58.1-jammy

LABEL version="1.4.1"
LABEL author="rehiy"

WORKDIR /app

COPY app/ ./
RUN npm install --production

ENV TOKEN=your-token
ENV PORT=3000

CMD ["sh", "/app/boot.sh"]
