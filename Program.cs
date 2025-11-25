using Microsoft.EntityFrameworkCore;
using System.Linq;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

// ==================== 서비스 등록 ====================

// SQLite DB 설정 (프로젝트 폴더 안에 scores.db 파일 생성)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=scores.db"));

// MongoDB 설정 (곡 정보 저장)
builder.Services.Configure<MongoSettings>(
    builder.Configuration.GetSection("Mongo"));
builder.Services.AddSingleton<SongRepository>();

// CORS: 프론트에서 자유롭게 호출할 수 있게 허용 (개발용)
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

// DefaultFiles 그대로 둠 (index.html 자동 선택)
app.UseDefaultFiles();

// ★ .weba 확장자를 audio/webm 으로 등록해서 정적 파일로 서빙
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".weba"] = "audio/webm";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypeProvider
});

// ==================== 초기화 (SQLite + Mongo 시드) ====================

using (var scope = app.Services.CreateScope())
{
    // 점수 DB 보장
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // 곡 DB 시드
    var songRepo = scope.ServiceProvider.GetRequiredService<SongRepository>();
    await SeedData.SeedSongsAsync(songRepo);
}

// ==================== API 엔드포인트 ====================

// 점수 저장 API
app.MapPost("/api/score", async (ScoreRecordDto dto, AppDbContext db) =>
{
    var entity = new ScoreRecord
    {
        PlayerName = string.IsNullOrWhiteSpace(dto.PlayerName) ? "NO NAME" : dto.PlayerName.Trim(),
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

// 랭킹 조회 API (곡+난이도별 Top N)
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

// 곡 목록 조회 API
app.MapGet("/api/songs", async (SongRepository repo) =>
{
    var songs = await repo.GetAllAsync();

    var dto = songs.Select(s => new
    {
        songId = s.SongId,
        title = s.Title,
        fileName = s.FileName,
        bpm = s.Bpm,
        offset = s.Offset,
        lengthSec = s.LengthSec,
        patterns = s.Patterns
    });

    return Results.Ok(dto);
});

// 개별 곡 조회 API
app.MapGet("/api/songs/{songId}", async (string songId, SongRepository repo) =>
{
    var song = await repo.GetBySongIdAsync(songId);
    if (song is null) return Results.NotFound();

    return Results.Ok(new
    {
        songId = song.SongId,
        title = song.Title,
        fileName = song.FileName,
        bpm = song.Bpm,
        offset = song.Offset,
        lengthSec = song.LengthSec,
        patterns = song.Patterns
    });
});

// 헬스체크
app.MapGet("/health", () => "Rhythm Backend is running");

app.Run();

// ==================== DTO 정의 ====================

// 점수 전송용 DTO (받는 데이터 형태)
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
