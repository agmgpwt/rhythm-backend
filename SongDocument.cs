using System.Collections.Generic;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

[BsonIgnoreExtraElements]  
public class SongDocument
{
    // ★ Id 프로퍼티 통째로 삭제
    // [BsonId]
    // [BsonRepresentation(BsonType.ObjectId)]
    // public string? Id { get; set; }

    public string SongId { get; set; } = string.Empty;   // "song1", "song2" 등
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty; // cat.weba, song2.mp3 ...
    public int Bpm { get; set; }
    public double Offset { get; set; }
    public double LengthSec { get; set; }

    public Dictionary<string, List<List<int>>> Patterns { get; set; } = new();
}
