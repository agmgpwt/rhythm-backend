# ----------- build stage -----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 전체 소스 복사
COPY . .

# 프로젝트 이름 명시해서 restore / publish
RUN dotnet restore "RhythmBackend.csproj"
RUN dotnet publish "RhythmBackend.csproj" -c Release -o /app/publish

# ----------- runtime stage -----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish .

# Render 기본 포트 10000
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000

ENTRYPOINT ["dotnet", "RhythmBackend.dll"]
