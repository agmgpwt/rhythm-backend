using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

public class SongRepository
{
    private readonly IMongoCollection<SongDocument> _songs;

    public SongRepository(IOptions<MongoSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);
        _songs = database.GetCollection<SongDocument>("songs");
    }

    public Task<List<SongDocument>> GetAllAsync() =>
        _songs.Find(FilterDefinition<SongDocument>.Empty).ToListAsync();

    public Task<SongDocument?> GetBySongIdAsync(string songId) =>
        _songs.Find(s => s.SongId == songId).FirstOrDefaultAsync();

    public Task<long> CountAsync() =>
        _songs.EstimatedDocumentCountAsync();

    public Task UpsertAsync(SongDocument song) =>
        _songs.ReplaceOneAsync(
            s => s.SongId == song.SongId,
            song,
            new ReplaceOptions { IsUpsert = true });
}
