using System.Collections.Generic;
using System.Threading.Tasks;

public static class SeedData
{
    public static async Task SeedSongsAsync(SongRepository repo)
    {
        // 이미 곡이 있으면 시드 스킵
        if (await repo.CountAsync() > 0) return;

        var song1 = new SongDocument
        {
            SongId = "빌려온 고양이 - ILLIT",
            Title = "빌려온 고양이 - ILLIT",
            FileName = "cat.weba",
            Bpm = 170,
            Offset = 17,
            LengthSec = 186,
            Patterns = new Dictionary<string, List<List<int>>>
            {
                ["easy"] = new()
                {
                    new(){0}, new(){3}, new(){1}, new(){3},
                    new(){2}, new(){0}, new(){3}, new(){1},
                    new(){0}, new(){2}, new(){3}, new(){1},
                    new(){0}, new(){3}, new(){0}, new(){2},
                },
                ["normal"] = new()
                {
                    new(){0}, new(){1}, new(){2}, new(){3},
                    new(){0}, new(){1}, new(){1}, new(){3},
                    new(){2}, new(){2}, new(){3}, new(){1},
                    new(){0}, new(){1}, new(){2}, new(){3},
                },
                ["hard"] = new()
                {
                    new(){0,1}, new(){1,3}, new(){2,3}, new(){2},
                    new(){0,3}, new(){2}, new(){0,1}, new(){3},
                    new(){0,3}, new(){1}, new(){2}, new(){3},
                    new(){0,1,2}, new(){1,3}, new(){0,2}, new(){3},
                },
            }
        };

        var song2 = new SongDocument
        {
            SongId = "song2",
            Title = "샘플 곡 2",
            FileName = "song2.mp3",
            Bpm = 90,
            Offset = 2,
            LengthSec = 180,
            Patterns = new Dictionary<string, List<List<int>>>
            {
                ["easy"] = new()
                {
                    new(){1}, new(), new(), new(){2},
                    new(), new(){1}, new(), new(){2},
                    new(){0}, new(), new(), new(){3},
                    new(), new(){0}, new(), new(){3},
                },
                ["normal"] = new()
                {
                    new(){0}, new(){1}, new(), new(){2},
                    new(){1}, new(), new(){2}, new(){3},
                    new(){0}, new(), new(){1}, new(){2},
                    new(), new(){2}, new(){3}, new(),
                },
                ["hard"] = new()
                {
                    new(){0,2}, new(), new(){1,3}, new(),
                    new(){0}, new(){1}, new(){2}, new(){3},
                    new(){0,3}, new(), new(){1,2}, new(),
                    new(){0,1,2}, new(), new(){1,2,3}, new(),
                },
            }
        };

        await repo.UpsertAsync(song1);
        await repo.UpsertAsync(song2);
    }
}
