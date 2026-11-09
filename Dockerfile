FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build
FROM gradle:8.14.3-jdk17 AS build
WORKDIR /app
COPY backend/ ./
COPY --from=web /web/dist/ src/main/resources/static/
RUN gradle test bootJar --no-daemon --max-workers=2
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /app/build/libs/*.jar app.jar
USER app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=55 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
