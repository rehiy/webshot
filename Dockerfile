FROM mcr.microsoft.com/playwright:v1.58.1-jammy

LABEL version="1.6.0"
LABEL author="rehiy"

WORKDIR /app

COPY --chown=pwuser:pwuser app/package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --chown=pwuser:pwuser app/ ./

ENV TOKEN=your-token
ENV PORT=3000

USER pwuser

CMD ["sh", "/app/boot.sh"]
