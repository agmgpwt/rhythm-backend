using System;

public class ScoreRecord
{
    public int Id { get; set; }

    public string PlayerName { get; set; } = "NO NAME";
    public string SongId { get; set; } = "";
    public string Difficulty { get; set; } = "";

    public int Score { get; set; }
    public int MaxCombo { get; set; }

    public double Accuracy { get; set; }

    public int Perfect { get; set; }
    public int Great { get; set; }
    public int Good { get; set; }
    public int Miss { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
