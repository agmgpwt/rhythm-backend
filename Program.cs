using Microsoft.EntityFrameworkCore;

// 점수 DTO
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

var builder = WebApplication.CreateBuilder(args);

// === SQLite (점수 저장용) ===
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=scores.db"));

// CORS (프론트에서 호출 허용)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors();

// --- 처음 한 번 DB 파일 & 테이블 생성 ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// === API ===

// 점수 저장
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
    };

    db.Scores.Add(entity);
    await db.SaveChangesAsync();

    return Results.Created($"/api/score/{entity.Id}", entity);
});

// 랭킹 조회
app.MapGet("/api/leaderboard", async (string songId, string difficulty, int? limit, AppDbContext db) =>
{
    var take = limit is > 0 and <= 100 ? limit.Value : 20;

    var query = db.Scores
        .Where(s => s.SongId == songId && s.Difficulty == difficulty)
        .OrderByDescending(s => s.Score)
        .ThenBy(s => s.CreatedAt)
        .Take(take);

    var list = await query.ToListAsync();
    return Results.Ok(list);
});

// 헬스 체크
app.MapGet("/", () => "Rhythm Backend is running");

// Render / 컨테이너용 포트 설정
var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
app.Urls.Add($"http://0.0.0.0:{port}");

app.Run();
