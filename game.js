import { CONFIG as DEFAULT_CONFIG } from "./constants.js";
// --- Canvas Setup ---
const storedConfig =
  JSON.parse(localStorage.getItem("gameConfig")) || DEFAULT_CONFIG;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gameWidth = canvas.width;
const gameHeight = canvas.height;

const newGameBtn = document.createElement("button");
newGameBtn.textContent = "New Game";
newGameBtn.style.position = "absolute";
newGameBtn.style.top = "60px";
newGameBtn.style.right = "20px";
newGameBtn.style.zIndex = "1000";
newGameBtn.style.fontSize = "16px";
newGameBtn.style.padding = "8px 12px";
document.body.appendChild(newGameBtn);
newGameBtn.onclick = () => {
  // Don't save score — reload
  resetGame();
};
newGameBtn.type = "button";

// --- Config ---
const config = {
  shootKey: storedConfig.shootKey,
  gameTimeSeconds: storedConfig.gameTime,
};

// --- Sounds ---
const backgroundMusic = new Audio("sounds/bg_music.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 1;
function playEnemyHitSound() {
  const sound = new Audio("sounds/enemy_hit.mp3");
  sound.volume = 1;
  sound.play();
}

const playerExplodesSound = new Audio("sounds/player_explodes.mp3");
playerExplodesSound.loop = false;
playerExplodesSound.volume = 1;
const loseSound = new Audio("sounds/you_lose.mp3");
loseSound.loop = false;
loseSound.volume = 1;

// --- Scoreboard ---
const currentPlayer = localStorage.getItem("loggedUser");
const scoreKey = `scoreHistory_${currentPlayer}`;

function saveScoreToHistory() {
  if (!currentPlayer) return;
  const history = JSON.parse(localStorage.getItem(scoreKey)) || [];
  history.push({
    player: currentPlayer,
    score,
    date: new Date().toLocaleString(),
  });
  history.sort((a, b) => b.score - a.score);
  localStorage.setItem(scoreKey, JSON.stringify(history));
  return history;
}
function drawScoreboard(history) {
  if (!history || history.length === 0) return;
  const rank = history.findIndex((h) => h.score === score) + 1;
  ctx.font = "24px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(
    `Your Rank: #${rank} of ${history.length}`,
    canvas.width / 2,
    canvas.height / 2 + 60
  );
  ctx.font = "18px Arial";
  ctx.fillText("Top 5 Scores:", canvas.width / 2, canvas.height / 2 + 90);
  history.slice(0, 5).forEach((entry, i) => {
    ctx.fillText(
      `${i + 1}. ${entry.player} – ${entry.score} pts – ${entry.date}`,
      canvas.width / 2,
      canvas.height / 2 + 120 + i * 25
    );
  });
}

// --- Images ---

const color = storedConfig.spaceshipColor || "purple";

const shipImg = new Image();
switch (color) {
  case "red":
    shipImg.src = "images/PlayerShipRed.png";
    break;
  case "blue":
    shipImg.src = "images/PlayerShipBlue.png";
    break;
  case "green":
    shipImg.src = "images/PlayerShipGreen.png";
    break;
  default:
    shipImg.src = "images/spaceship.png"; // purple/default
    break;
}

const enemyMissileImg = new Image();
enemyMissileImg.src = "images/enemy_missile.png";

const playerMissileImg = new Image();
playerMissileImg.src = "images/self_missile.png";

const explosionImg = new Image();
explosionImg.src = "images/Explosion.png";

const enemyImages = [
  "images/fourth_row_enemy.png",
  "images/third_row_enemy.png",
  "images/second_row_enemy.png",
  "images/first_row_enemy.png",
].map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

// --- Variables ---
let score = 0;
let lives = 3;
let gameOver = false;
let gameWon = false;
let speedBoosts = 0;
const maxSpeedBoosts = 4;
const speedBoostInterval = 5000; // 5 seconds
let timeLeft = config.gameTimeSeconds;
const BASE_ENEMY_SPEED = 2;
const BASE_MISSILE_SPEED = 2;
let currentEnemySpeed = BASE_ENEMY_SPEED;
let currentMissileSpeed = BASE_MISSILE_SPEED;
let speedBoostTimer = null;
// --- Ship ---
const movementAreaHeight = gameHeight * 0.4;
const ship = {
  width: 40,
  height: 50,
  x: Math.random() * (gameWidth - 50),
  y: gameHeight - 50,
  speed: 5,
  dx: 0,
  dy: 0,
};

// --- Controls ---
let controlsInitialized = false;

function setupControls() {
  if (controlsInitialized) return;
  controlsInitialized = true;

  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft":
        ship.dx = -ship.speed;
        break;
      case "ArrowRight":
        ship.dx = ship.speed;
        break;
      case "ArrowUp":
        ship.dy = -ship.speed;
        break;
      case "ArrowDown":
        ship.dy = ship.speed;
        break;
    }
    if (e.key === config.shootKey) {
      firePlayerBullet();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) ship.dx = 0;
    if (["ArrowUp", "ArrowDown"].includes(e.key)) ship.dy = 0;
  });
}

function updatePosition() {
  const newX = ship.x + ship.dx;
  const newY = ship.y + ship.dy;
  if (newX >= 0 && newX <= gameWidth - ship.width) ship.x = newX;
  const lowerBound = gameHeight - ship.height - 20;
  const upperBound = gameHeight - movementAreaHeight;
  if (newY >= upperBound && newY <= lowerBound) ship.y = newY;
  else if (newY < upperBound) ship.y = upperBound;
  else if (newY > lowerBound) ship.y = lowerBound;
}

// --- Player Bullets ---
let playerBullets = [];
let canShoot = true;

function firePlayerBullet() {
  if (!canShoot) return;

  playerBullets.push({
    x: ship.x + ship.width / 2 - 8,
    y: ship.y,
    width: 16,
    height: 32,
    speed: 5,
  });

  canShoot = false;
  setTimeout(() => {
    canShoot = true;
  }, 200);
}

function updatePlayerBullets() {
  for (let i = 0; i < playerBullets.length; i++) {
    const bullet = playerBullets[i];
    bullet.y -= bullet.speed;

    for (let j = 0; j < enemies.length; j++) {
      const enemy = enemies[j];
      if (!enemy.alive) continue;

      const enemyX = enemyGroup.x + enemy.x;
      const enemyY = enemyGroup.y + enemy.y;

      if (
        bullet.x < enemyX + enemyWidth &&
        bullet.x + bullet.width > enemyX &&
        bullet.y < enemyY + enemyHeight &&
        bullet.y + bullet.height > enemyY
      ) {
        playEnemyHitSound();
        explosions.push({
          x: enemyGroup.x + enemy.x + enemyWidth / 2 - 16,
          y: enemyGroup.y + enemy.y + enemyHeight / 2 - 16,
          frame: 0,
          frameDelay: 5,
          delayCount: 0,
        });

        explosions.push({
          x: enemyGroup.x + enemy.x + enemyWidth / 2 - 16,
          y: enemyGroup.y + enemy.y + enemyHeight / 2 - 16,
          frame: 0,
          frameDelay: 5,
          delayCount: 0,
        });

        // Scoring based on enemy row
        const row = enemy.rowIndex;
        if (row === 3) score += 5;
        else if (row === 2) score += 10;
        else if (row === 1) score += 15;
        else if (row === 0) score += 20;

        enemy.alive = false;
        playerBullets.splice(i, 1);
        i--;
      }
    }

    if (bullet && bullet.y + bullet.height < 0) {
      playerBullets.splice(i, 1);
      i--;
    }
  }
}

function drawPlayerBullets() {
  playerBullets.forEach((bullet) => {
    ctx.drawImage(
      playerMissileImg,
      bullet.x,
      bullet.y,
      bullet.width,
      bullet.height
    );
  });
}

// --- Enemies ---
const enemies = [];
const rows = 4;
const cols = 5;
const enemyWidth = 45;
const enemyHeight = 45;
const spacing = 24;
const enemyGroup = {
  x: 50,
  y: 50,
  dx: 1, // just direction: 1 or -1
  width: cols * (enemyWidth + spacing),
};

function createEnemies() {
  enemies.length = 0; // clear old ones

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      enemies.push({
        x: col * (enemyWidth + spacing),
        y: row * (enemyHeight + spacing),
        rowIndex: row,
        alive: true,
      });
    }
  }

  enemyGroup.x = 50;
  enemyGroup.dx = BASE_ENEMY_SPEED;
}

function updateEnemies() {
  //// enemyGroup.x += enemyGroup.dx;
  // enemyGroup.x += currentEnemySpeed;
  // if (enemyGroup.x <= 0 || enemyGroup.x + enemyGroup.width >= canvas.width) {
  //   enemyGroup.dx *= -1;
  // }
  enemyGroup.x += currentEnemySpeed * enemyGroup.dx;

  if (enemyGroup.x <= 0 || enemyGroup.x + enemyGroup.width >= canvas.width) {
    enemyGroup.dx *= -1; // Flip direction
  }
  // Check if all enemies are dead - if so, game won
  if (!gameWon && enemies.every((e) => !e.alive)) {
    gameWon = true;
  }
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    if (enemy.alive) {
      const img = enemyImages[enemy.rowIndex];
      ctx.drawImage(
        img,
        enemyGroup.x + enemy.x,
        enemyGroup.y + enemy.y,
        enemyWidth,
        enemyHeight
      );
    }
  });
}
let enemyMissiles = [];
let missileTriggeredNext = false;

function fireEnemyMissile() {
  const aliveEnemies = enemies.filter((e) => e.alive);
  if (aliveEnemies.length === 0) return;
  const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
  enemyMissiles.push({
    x: enemyGroup.x + shooter.x + enemyWidth / 2 - 5,
    y: enemyGroup.y + shooter.y + enemyHeight,
    speed: currentMissileSpeed,
    width: 10,
    height: 20,
  });
}

function updateEnemyMissiles() {
  if (enemyMissiles.length === 0) {
    fireEnemyMissile();
    return;
  }

  for (let i = 0; i < enemyMissiles.length; i++) {
    const missile = enemyMissiles[i];
    missile.y += missile.speed;

    if (
      !missileTriggeredNext &&
      missile.y > canvas.height * 0.75 &&
      i === enemyMissiles.length - 1
    ) {
      missileTriggeredNext = true;
      setTimeout(() => {
        fireEnemyMissile();
        missileTriggeredNext = false;
      }, 300);
    }

    if (
      missile.x < ship.x + ship.width &&
      missile.x + missile.width > ship.x &&
      missile.y < ship.y + ship.height &&
      missile.y + missile.height > ship.y
    ) {
      playerExplodesSound.currentTime = 0;
      playerExplodesSound.play();
      explosions.push({
        x: ship.x + ship.width / 2 - 16,
        y: ship.y + ship.height / 2 - 16,
        frame: 0,
        frameDelay: 5,
        delayCount: 0,
      });
      enemyMissiles.splice(i, 1);
      i--;
      lives--;
      if (lives <= 0) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        setTimeout(() => {
          loseSound.currentTime = 0;
          loseSound.play();
        }, 500);
        gameOver = true;
      } else {
        ship.x = Math.random() * (gameWidth - ship.width);
        ship.y = gameHeight - ship.height - 20;
      }
    }

    if (missile.y > canvas.height) {
      enemyMissiles.splice(i, 1);
      i--;
    }
  }
}

function drawEnemyMissiles() {
  enemyMissiles.forEach((missile) => {
    ctx.drawImage(
      enemyMissileImg,
      missile.x,
      missile.y,
      missile.width,
      missile.height
    );
  });
}

// --- Explosions ---
let explosions = [];

function updateExplosions() {
  for (let i = 0; i < explosions.length; i++) {
    const exp = explosions[i];
    exp.delayCount++;
    if (exp.delayCount >= exp.frameDelay) {
      exp.frame++;
      exp.delayCount = 0;
    }
    if (exp.frame >= 8) {
      explosions.splice(i, 1);
      i--;
    }
  }
}

function drawExplosions() {
  explosions.forEach((exp) => {
    ctx.drawImage(
      explosionImg,
      exp.frame * 32,
      0,
      32,
      32,
      exp.x,
      exp.y,
      32,
      32
    );
  });
}

// --- Ship ---
function drawShip() {
  ctx.drawImage(shipImg, ship.x, ship.y, ship.width, ship.height);
}

function drawHUD() {
  // Score
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, 20, 30);

  // Lives
  ctx.fillText(`Lives: ${"❤️".repeat(lives)}`, 20, 60);

  // Timer
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  ctx.fillText(`Time Left: ${minutes}:${seconds}`, 20, 90);
}

function drawEndScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "36px Arial";
  ctx.textAlign = "center";

  let message = "";

  if (gameWon) {
    message = "Champion!";
  } else if (lives <= 0) {
    message = "You Lost!";
  } else if (timeLeft <= 0) {
    message = score < 100 ? `You can do better: ${score}` : "Winner!";
  }
  const history = saveScoreToHistory();
  drawScoreboard(history);
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 20);

  const button = document.createElement("button");
  button.textContent = "Play Again";
  button.style.position = "fixed";
  button.style.left = "50svw";
  button.style.top = "30svh";
  button.style.transform = "translate(-50%, -50%)";
  button.style.fontSize = "18px";
  button.style.padding = "10px 20px";
  document.body.appendChild(button);
  button.type = "button";
  button.onclick = () => {
    //location.reload();
    resetGame();
  };
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear Scoreboard";
  clearBtn.style.position = "fixed";
  clearBtn.style.left = "50svw";
  clearBtn.style.top = "40svh";
  clearBtn.style.transform = "translate(-50%, -50%)";
  clearBtn.style.fontSize = "16px";
  clearBtn.style.padding = "8px 16px";
  document.body.appendChild(clearBtn);

  clearBtn.onclick = () => {
    localStorage.removeItem(scoreKey);
    alert("Your scoreboard has been cleared.");

    // Clear the area where the scoreboard is shown
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw the end message
    ctx.fillStyle = "white";
    ctx.font = "36px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Scoreboard cleared.",
      canvas.width / 2,
      canvas.height / 2 - 20
    );

    // You can redraw the Play Again button text if needed
    ctx.font = "20px Arial";
    ctx.fillText(
      "Press 'Play Again' to start a new game.",
      canvas.width / 2,
      canvas.height / 2 + 20
    );
  };
}

// --- Game Loop ---
let gameLoopId;

function gameLoop() {
  updatePosition();
  updateEnemies();
  updateEnemyMissiles();
  updatePlayerBullets();
  updateExplosions();

  ctx.clearRect(0, 0, gameWidth, gameHeight);

  drawShip();
  drawEnemies();
  drawEnemyMissiles();
  drawPlayerBullets();
  drawExplosions();
  drawHUD();

  if (gameOver || gameWon) {
    drawEndScreen();
    return;
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

let timerInterval = null;

function startGame() {
  gameLoop();
  backgroundMusic.currentTime = 0;
  backgroundMusic.play();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameOver && !gameWon) {
      timeLeft--;
      if (timeLeft <= 0) {
        gameOver = true;
        clearInterval(timerInterval);
      }
    }
  }, 1000);
  scheduleSpeedBoosts();
}

shipImg.onload = () => {
  setupControls();
  createEnemies();
  startGame();
};

function resetGame() {
  // Stop existing loop and timer
  cancelAnimationFrame(gameLoopId);
  clearInterval(timerInterval);
  clearInterval(speedBoostTimer);
  currentEnemySpeed = BASE_ENEMY_SPEED;
  currentMissileSpeed = BASE_MISSILE_SPEED;

  // Reset state
  score = 0;
  lives = 3;
  gameOver = false;
  gameWon = false;
  speedBoosts = 0;
  timeLeft = config.gameTimeSeconds;

  ship.x = Math.random() * (gameWidth - ship.width);
  ship.y = gameHeight - ship.height - 20;
  ship.dx = 0;
  ship.dy = 0;

  playerBullets = [];
  enemyMissiles = [];
  explosions = [];

  createEnemies();

  backgroundMusic.currentTime = 0;
  backgroundMusic.play();

  // Clear buttons
  document.querySelectorAll("button").forEach((btn) => {
    if (
      btn.textContent === "Play Again" ||
      btn.textContent === "Clear Scoreboard"
    ) {
      btn.remove();
    }
  });

  // Restart game loop
  startGame();
}

function scheduleSpeedBoosts() {
  currentEnemySpeed = BASE_ENEMY_SPEED;
  currentMissileSpeed = BASE_MISSILE_SPEED;

  let boosts = 0;
  const boostAmount = 0.3; // subtle increase

  speedBoostTimer = setInterval(() => {
    boosts++;
    if (boosts > 4) {
      clearInterval(speedBoostTimer);
      return;
    }
    currentEnemySpeed += boostAmount;
    currentMissileSpeed += boostAmount;
  }, 5000); // every 5 seconds
}
