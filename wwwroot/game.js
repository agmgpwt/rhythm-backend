(function () {
  // ★ C# 백엔드 주소 (dotnet run 로그에서 확인한 포트 번호)
  const API_BASE = "";

  // DOM 요소
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const startButton = document.getElementById("startButton");
  const songSelect = document.getElementById("songSelect");
  const difficultySelect = document.getElementById("difficultySelect");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const maxComboEl = document.getElementById("maxCombo");
  const judgmentEl = document.getElementById("judgment");
  const music = document.getElementById("music");

  const resultOverlay = document.getElementById("resultOverlay");
  const resultSongTitleEl = document.getElementById("resultSongTitle");
  const resultDifficultyEl = document.getElementById("resultDifficulty");
  const resultScoreEl = document.getElementById("resultScore");
  const resultMaxComboEl = document.getElementById("resultMaxCombo");
  const resultAccuracyEl = document.getElementById("resultAccuracy");
  const resultRankEl = document.getElementById("resultRank");
  const resultPerfectEl = document.getElementById("resultPerfect");
  const resultGreatEl = document.getElementById("resultGreat");
  const resultGoodEl = document.getElementById("resultGood");
  const resultMissEl = document.getElementById("resultMiss");
  const retryButton = document.getElementById("retryButton");
  const backButton = document.getElementById("backButton");

  const leaderboardSongEl = document.getElementById("leaderboardSong");
  const leaderboardDiffEl = document.getElementById("leaderboardDifficulty");
  const leaderboardBodyEl = document.getElementById("leaderboardBody");

  // 버튼에 키보드 포커스 못가게 (Enter로 실수 클릭 방지)
  startButton.tabIndex = -1;
  retryButton.tabIndex = -1;
  backButton.tabIndex = -1;

  const LANES = 4;

  const KEY_TO_LANE = {
    a: 0,
    s: 1,
    d: 2,
    f: 3,
  };

  // ★ 곡 정보는 백엔드에서 받아와서 여기에 채운다
  let SONGS = {};

  const HIT_LINE_Y = canvas.height - 120;
  const NOTE_HEIGHT = 24;
  const NOTE_WIDTH = (canvas.width / LANES) * 0.7;
  const NOTE_SPEED = 380;
  const MISS_WINDOW = 0.25;

  const JUDGMENTS = [
    { name: "PERFECT", window: 0.06, score: 1000, color: "#ffe066" },
    { name: "GREAT", window: 0.12, score: 700, color: "#74c0fc" },
    { name: "GOOD", window: 0.2, score: 300, color: "#69db7c" },
  ];

  const state = {
    notes: [],
    started: false,
    startTime: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,

    totalNotes: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,

    requestId: null,
    judgmentTimeoutId: null,

    currentSongId: null,
    currentDifficulty: difficultySelect.value || "easy",

    playerName: "UNKNOWN",

    // ★ 결과창이 떠 있어야 하는 상태인지 표시
    resultVisible: false,
  };

  // ===== 곡 정보 관련 유틸 =====

  function getCurrentSong() {
    if (state.currentSongId && SONGS[state.currentSongId]) {
      return SONGS[state.currentSongId];
    }

    const keys = Object.keys(SONGS);
    if (keys.length > 0) {
      state.currentSongId = keys[0];
      if (songSelect) songSelect.value = state.currentSongId;
      return SONGS[state.currentSongId];
    }

    return null;
  }

  async function loadSongsFromApi() {
    try {
      const res = await fetch(`/api/songs`);
      if (!res.ok) {
        throw new Error(`곡 목록 불러오기 실패: HTTP ${res.status}`);
      }

      const list = await res.json();
      console.log("songs from api:", list);

      SONGS = {};
      songSelect.innerHTML = "";

      list.forEach((s, index) => {
        // 백엔드에서 내려온 songId/fileName/bpm 등을 JS에서 쓰기 좋은 형태로 재구성
        SONGS[s.songId] = {
          id: s.songId,
          title: s.title,
          file: s.fileName,
          bpm: s.bpm,
          offset: s.offset,
          lengthSec: s.lengthSec,
          patterns: s.patterns || {},
        };

        const opt = document.createElement("option");
        opt.value = s.songId;
        opt.textContent = s.title;
        songSelect.appendChild(opt);

        if (index === 0 && !state.currentSongId) {
          state.currentSongId = s.songId;
        }
      });

      if (state.currentSongId && SONGS[state.currentSongId]) {
        songSelect.value = state.currentSongId;
      }
    } catch (err) {
      console.error(err);
      alert("곡 목록을 불러오지 못했습니다. 백엔드를 확인하세요.");
    }
  }

  // ===== 일반 유틸 =====

  function difficultyLabel(diff) {
    if (diff === "easy") return "Easy";
    if (diff === "normal") return "Normal";
    if (diff === "hard") return "Hard";
    return diff;
  }

  function ensurePlayerName() {
    // 항상 닉네임을 한 번 물어보게 (지금 값이 있으면 기본값으로 보여줌)
    const current = state.playerName && state.playerName !== "NO NAME"
     ? state.playerName
     : "";

   const name = prompt("닉네임을 입력하세요 (빈칸이면 NO NAME):", current);

    if (!name) {
      state.playerName = "NO NAME";
    } else {
      state.playerName = name.trim() || "NO NAME";
    }

   console.log("playerName =", state.playerName);
  }


  function transformLanes(lanes, loopIndex) {
    if (!lanes || lanes.length === 0) return lanes;
    return lanes.map((lane) => {
      let newLane = lane;
      switch (loopIndex % 4) {
        case 0:
          newLane = lane;
          break;
        case 1:
          newLane = LANES - 1 - lane;
          break;
        case 2:
          newLane = (lane + 1) % LANES;
          break;
        case 3:
          newLane = (lane + 3) % LANES;
          break;
      }
      return newLane;
    });
  }

  function createBeatmap(song, difficulty) {
    const patterns = song.patterns || {};
    const basePattern = patterns[difficulty] || patterns["easy"] || [];
    const beatDuration = 60 / song.bpm;
    const notes = [];
    if (basePattern.length === 0) return notes;

    const targetLength = song.lengthSec || 180;
    const loopLengthSec = beatDuration * basePattern.length;

    let time = song.offset;
    let step = 0;

    while (time < targetLength) {
      const rawLanes = basePattern[step % basePattern.length];
      const loopIndex = Math.floor((time - song.offset) / loopLengthSec);
      const lanes = transformLanes(rawLanes, loopIndex);

      if (lanes && lanes.length > 0) {
        for (const lane of lanes) {
          if (lane < 0 || lane >= LANES) continue;
          notes.push({
            time,
            lane,
            judged: false,
            hit: false,
          });
        }
      }

      time += beatDuration;
      step++;
    }

    return notes;
  }

  function resetStats() {
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.perfect = 0;
    state.great = 0;
    state.good = 0;
    state.miss = 0;
  }

  function prepareGame() {
    const song = getCurrentSong();
    if (!song) {
      console.warn("준비할 곡 정보가 없습니다.");
      return;
    }

    state.notes = createBeatmap(song, state.currentDifficulty);
    state.totalNotes = state.notes.length;
    resetStats();
    state.started = false;
    updateScoreUI();
    showJudgment("");
    drawFrame(0);
  }

  function startGame() {
    const song = getCurrentSong();
    if (!song) {
      alert("플레이할 곡 정보가 없습니다. 백엔드를 확인하세요.");
      return;
    }

    if (state.requestId) {
      cancelAnimationFrame(state.requestId);
      state.requestId = null;
    }

    prepareGame();
    state.started = true;
    state.startTime = performance.now() / 1000;

    if (music) {
      try {
        music.src = song.file;
        music.load();
        music.currentTime = 0;
        music.play();
      } catch (err) {
        console.warn("오디오 자동 재생 실패 가능:", err);
      }
    }

    state.requestId = requestAnimationFrame(loop);
  }

  function loop() {
    if (!state.started) return;

    const now = performance.now() / 1000;
    const elapsed = now - state.startTime;

    update(elapsed);
    drawFrame(elapsed);

    state.requestId = requestAnimationFrame(loop);
  }

  // 음악이 끝났을 때 게임 종료 → 결과창 표시
  music.addEventListener("ended", () => {
    if (!state.started) return;

    // 남은 노트들 MISS 처리
    for (const note of state.notes) {
      if (!note.judged) {
        note.judged = true;
        note.hit = false;
        state.miss++;
      }
    }
    state.combo = 0;
    updateScoreUI();

    endGame();
  });

  function endGame() {
    state.started = false;
    if (state.requestId) {
      cancelAnimationFrame(state.requestId);
      state.requestId = null;
    }
    showResult();
  }

  function update(elapsed) {
    for (const note of state.notes) {
      if (!note.judged && elapsed - note.time > MISS_WINDOW) {
        applyMiss(note);
      }
    }
  }

  function drawFrame(elapsed) {
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#080b10";
    ctx.fillRect(0, 0, width, height);

    const laneWidth = width / LANES;
    for (let i = 0; i < LANES; i++) {
      const x = i * laneWidth;
      ctx.fillStyle =
        i % 2 === 0
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.02)";
      ctx.fillRect(x, 0, laneWidth, height);
    }

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(0, HIT_LINE_Y, width, 3);

    for (const note of state.notes) {
      const timeToHit = note.time - elapsed;
      const y = HIT_LINE_Y - timeToHit * NOTE_SPEED;

      if (y < -NOTE_HEIGHT || y > height + NOTE_HEIGHT) continue;

      const laneWidth2 = canvas.width / LANES;
      const laneX =
        note.lane * laneWidth2 + (laneWidth2 - NOTE_WIDTH) / 2;

      if (!note.judged) {
        ctx.fillStyle = "rgba(80, 200, 255, 0.9)";
      } else {
        ctx.fillStyle = note.hit
          ? "rgba(120, 220, 120, 0.7)"
          : "rgba(220, 80, 80, 0.4)";
      }

      const radius = 6;
      roundRect(ctx, laneX, y, NOTE_WIDTH, NOTE_HEIGHT, radius);
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    const lane = KEY_TO_LANE[key];
    if (lane === undefined) return;
    if (!state.started) return;

    e.preventDefault();

    const now = performance.now() / 1000;
    const elapsed = now - state.startTime;
    handleHit(lane, elapsed);
  }

  function handleHit(lane, elapsed) {
    let target = null;
    let bestDelta = Infinity;

    for (const note of state.notes) {
      if (note.lane !== lane || note.judged) continue;

      const delta = Math.abs(note.time - elapsed);
      if (delta < bestDelta) {
        bestDelta = delta;
        target = note;
      }
    }

    if (!target) return;

    const judgment = getJudgment(bestDelta);
    if (!judgment) return;

    applyHit(target, judgment);
  }

  function getJudgment(delta) {
    for (const j of JUDGMENTS) {
      if (delta <= j.window) {
        return j;
      }
    }
    return null;
  }

  function applyHit(note, judgment) {
    note.judged = true;
    note.hit = true;

    state.score += judgment.score;
    state.combo += 1;
    if (state.combo > state.maxCombo) {
      state.maxCombo = state.combo;
    }

    if (judgment.name === "PERFECT") state.perfect++;
    else if (judgment.name === "GREAT") state.great++;
    else if (judgment.name === "GOOD") state.good++;

    updateScoreUI();
    showJudgment(judgment.name, judgment.color);
  }

  function applyMiss(note) {
    note.judged = true;
    note.hit = false;
    state.combo = 0;
    state.miss++;
    updateScoreUI();
    showJudgment("MISS", "#ff6b6b");
  }

  function updateScoreUI() {
    scoreEl.textContent = state.score;
    comboEl.textContent = state.combo;
    maxComboEl.textContent = state.maxCombo;
  }

  function showJudgment(text, color) {
    if (state.judgmentTimeoutId) {
      clearTimeout(state.judgmentTimeoutId);
      state.judgmentTimeoutId = null;
    }

    if (!text) {
      judgmentEl.textContent = "";
      judgmentEl.classList.remove("show");
      return;
    }

    judgmentEl.textContent = text;
    if (color) {
      judgmentEl.style.color = color;
    }
    judgmentEl.classList.add("show");

    state.judgmentTimeoutId = setTimeout(() => {
      judgmentEl.classList.remove("show");
    }, 300);
  }

  function calcAccuracyAndRank() {
    const total = state.totalNotes || 0;
    const hitCount = state.perfect + state.great + state.good;
    const acc = total > 0 ? (hitCount / total) * 100 : 0;

    let rank = "D";
    if (acc >= 95) rank = "S";
    else if (acc >= 90) rank = "A";
    else if (acc >= 80) rank = "B";
    else if (acc >= 70) rank = "C";

    return {
      accuracy: acc.toFixed(2) + " %",
      rank,
    };
  }

  // ★★★ 결과창 띄우기 (여기서만 ON) ★★★
  function showResult() {
    // 혹시 버튼에 포커스가 잡혀 있으면 떼기 (자동 클릭 방지)
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    const song =
      getCurrentSong() || {
        id: "unknown",
        title: "Unknown",
      };

    const { accuracy, rank } = calcAccuracyAndRank();

    resultSongTitleEl.textContent = song.title;
    resultDifficultyEl.textContent = difficultyLabel(
      state.currentDifficulty
    );
    resultScoreEl.textContent = state.score;
    resultMaxComboEl.textContent = state.maxCombo;
    resultAccuracyEl.textContent = accuracy;
    resultRankEl.textContent = rank;

    resultPerfectEl.textContent = state.perfect;
    resultGreatEl.textContent = state.great;
    resultGoodEl.textContent = state.good;
    resultMissEl.textContent = state.miss;

    // 결과창을 "떠 있어야 하는 상태"로 표시
    state.resultVisible = true;
    resultOverlay.style.display = "flex";
    resultOverlay.classList.add("show");

    const accuracyNumber = parseFloat(accuracy);

    const payload = {
      playerName: state.playerName,
      songId: song.id,
      difficulty: state.currentDifficulty,
      score: state.score,
      maxCombo: state.maxCombo,
      accuracy: isNaN(accuracyNumber) ? 0 : accuracyNumber,
      perfect: state.perfect,
      great: state.great,
      good: state.good,
      miss: state.miss,
    };

    fetch(`/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          console.error("점수 전송 실패:", res.status);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          console.log("점수 저장 완료:", data);
        }
      })
      .catch((err) => {
        console.error("점수 전송 중 오류:", err);
      })
      .finally(() => {
        // 점수 저장 성공/실패와 상관없이 랭킹은 항상 새로 불러오기
        loadLeaderboard();
      });
  }

  // ★★★ 결과창 끄기 (버튼에서만 사용) ★★★
  function hideResult(source) {
    console.log("hideResult 호출:", source);

    // 허용된 버튼에서 온 호출만 진짜로 끈다
    const allowedSources = ["retryButton", "backButton", "startButton"];
    if (!allowedSources.includes(source)) {
      console.log("→ 허용되지 않은 source 이므로 무시");
      return;
    }

    state.resultVisible = false;
    resultOverlay.style.display = "none";
    resultOverlay.classList.remove("show");
  }

  function loadLeaderboard() {
    const song = getCurrentSong();
    const diff = state.currentDifficulty;

    if (!song) {
      leaderboardSongEl.textContent = "곡: (없음)";
      leaderboardDiffEl.textContent = `난이도: ${difficultyLabel(diff)}`;
      leaderboardBodyEl.innerHTML =
        '<tr><td colspan="4" class="lb-empty">곡 정보를 불러오지 못했습니다.</td></tr>';
      return;
    }

    leaderboardSongEl.textContent = `곡: ${song.title}`;
    leaderboardDiffEl.textContent = `난이도: ${difficultyLabel(diff)}`;

    fetch(
      `/api/leaderboard?songId=${song.id}&difficulty=${diff}&limit=10`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((list) => {
        leaderboardBodyEl.innerHTML = "";

        if (!Array.isArray(list) || list.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML =
            '<td colspan="4" class="lb-empty">기록이 없습니다.</td>';
          leaderboardBodyEl.appendChild(tr);
          return;
        }

        list.forEach((item, index) => {
          const tr = document.createElement("tr");
          const rank = index + 1;
          const name = item.playerName || "NO NAME";
          const score = item.score ?? 0;
          const maxCombo = item.maxCombo ?? 0;

          tr.innerHTML = `
            <td>${rank}</td>
            <td>${name}</td>
            <td>${score}</td>
            <td>${maxCombo}</td>
          `;
          leaderboardBodyEl.appendChild(tr);
        });
      })
      .catch((err) => {
        console.error("리더보드 불러오기 실패:", err);
        leaderboardBodyEl.innerHTML =
          '<tr><td colspan="4" class="lb-empty">리더보드를 불러오지 못했습니다.</td></tr>';
      });
  }

  // ===== 이벤트 =====

  startButton.addEventListener("click", () => {
    ensurePlayerName();
    if (state.resultVisible) {
      hideResult("startButton"); // 이전 결과창 떠 있으면 닫고 시작
    }
    startGame();
  });

  retryButton.addEventListener("click", () => {
    hideResult("retryButton");
    startGame();
  });

  backButton.addEventListener("click", () => {
    hideResult("backButton");
    state.started = false;
    prepareGame();
    loadLeaderboard();
  });

  songSelect.addEventListener("change", () => {
    state.currentSongId = songSelect.value;
    prepareGame();
    loadLeaderboard();
  });

  difficultySelect.addEventListener("change", () => {
    state.currentDifficulty = difficultySelect.value;
    prepareGame();
    loadLeaderboard();
  });

  window.addEventListener("keydown", onKeyDown);

  // ===== 결과창 강제 유지용 워치독 =====
  setInterval(() => {
    if (!state.resultVisible) return;

    const style = getComputedStyle(resultOverlay);
    const hiddenByDisplay = style.display === "none";
    const missingClass = !resultOverlay.classList.contains("show");

    if (hiddenByDisplay || missingClass) {
      console.log("⚠ 결과창이 자동으로 숨겨져서 다시 복구합니다.");
      resultOverlay.style.display = "flex";
      resultOverlay.classList.add("show");
    }
  }, 100);

  // ===== 초기 실행 =====
  // 1) 백엔드에서 곡 목록 가져오기
  // 2) 곡 정보 기반으로 게임/랭킹 준비
  loadSongsFromApi()
    .then(() => {
      prepareGame();
      loadLeaderboard();
    })
    .catch((err) => {
      console.error("초기 곡 로딩 실패:", err);
      prepareGame();
      loadLeaderboard();
    });
})();
