using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

// ===== DB (SQLite) 등록 =====
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=scores.db"));

// ===== CORS (개발용: 전체 허용) =====
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

// CORS 사용
app.UseCors();

// SQLite DB 파일이 없으면 생성
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// wwwroot 정적 파일 서빙 (index.html, game.js, cat.weba 등)
app.UseDefaultFiles();

// .weba 같은 확장자도 서빙할 수 있게 ContentTypeProvider 확장
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".weba"] = "audio/webm";   // .weba -> audio/webm 으로 등록

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypeProvider
});


// ===== 점수 저장 API =====
app.MapPost("/api/score", async (ScoreRecordDto dto, AppDbContext db) =>
{
    var entity = new ScoreRecord
    {
        PlayerName = string.IsNullOrWhiteSpace(dto.PlayerName)
            ? "NO NAME"
            : dto.PlayerName.Trim(),
        SongId = dto.SongId,
        Difficulty = dto.Difficulty,
        Score = dto.Score,
        MaxCombo = dto.MaxCombo,
        Accuracy = dto.Accuracy,
        Perfect = dto.Perfect,
        Great = dto.Great,
        Good = dto.Good,
        Miss = dto.Miss,
        CreatedAt = DateTime.UtcNow
    };

    db.Scores.Add(entity);
    await db.SaveChangesAsync();

    return Results.Created($"/api/score/{entity.Id}", entity);
});

// ===== 리더보드 조회 API =====
app.MapGet("/api/leaderboard", async (
    string songId,
    string difficulty,
    int? limit,
    AppDbContext db) =>
{
    var take = limit is > 0 and <= 100 ? limit.Value : 20;

    var list = await db.Scores
        .Where(s => s.SongId == songId && s.Difficulty == difficulty)
        .OrderByDescending(s => s.Score)
        .ThenBy(s => s.CreatedAt)
        .Take(take)
        .ToListAsync();

    return Results.Ok(list);
});

// 루트 요청은 index.html로 리다이렉트
app.MapGet("/", () => Results.Redirect("/index.html"));

app.Run();

// ===== DTO =====
public record ScoreRecordDto(
    string PlayerName,
    string SongId,
    string Difficulty,
    int Score,
    int MaxCombo,
    double Accuracy,
    int Perfect,
    int Great,
    int Good,
    int Miss
);
