FROM node:20-alpine
WORKDIR /app
RUN echo '{"name":"egp-placeholder","version":"0.0.1","private":true}' > package.json
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
