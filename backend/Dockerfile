# 투데이 백엔드 컨테이너 이미지 (Railway / Fly.io / 모든 컨테이너 호스트 공용).
# 멀티스테이지: 1) 빌드(JDK+maven wrapper) → 2) 실행(JRE만).

# ---- build ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
# 의존성 캐시: pom + wrapper 먼저 복사해 go-offline (소스만 바뀌면 이 레이어 재사용)
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src ./src
RUN ./mvnw -q -B -DskipTests clean package

# ---- run ----
FROM eclipse-temurin:21-jre
WORKDIR /app
# 업로드 사진 저장 경로(휘발성 방지용 볼륨을 여기 마운트). UPLOAD_DIR 로 덮어쓸 수 있음.
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads
COPY --from=build /app/target/*.jar app.jar
# PaaS가 PORT를 주입한다(application.yml의 ${PORT:8083}).
ENV JAVA_OPTS=""
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
