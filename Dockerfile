# ---------- 빌드 스테이지 ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# csproj 먼저 복사 후 복원
COPY *.csproj ./
RUN dotnet restore

# 나머지 소스 전부 복사
COPY . ./

# Release 빌드 & publish
RUN dotnet publish -c Release -o /app/publish

# ---------- 런타임 스테이지 ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# publish 결과만 복사 (wwwroot 포함)
COPY --from=build /app/publish .

# Render 기본 포트 10000에 바인딩
ENV ASPNETCORE_URLS=http://0.0.0.0:10000

EXPOSE 10000

ENTRYPOINT ["dotnet", "RhythmBackend.dll"]
