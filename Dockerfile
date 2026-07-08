FROM mcr.microsoft.com/playwright:v1.58.1-jammy

LABEL version="1.6.0"
LABEL author="rehiy"

WORKDIR /app

COPY app/ ./
RUN npm install --production
RUN chown -R pwuser:pwuser /app

ENV TOKEN=your-token
ENV PORT=3000

USER pwuser

CMD ["sh", "/app/boot.sh"]
